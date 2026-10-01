import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReminderStatus } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  REMINDERS_QUEUE,
  REMINDER_JOB_FIRE,
  REMINDER_JOB_SWEEP,
  REMINDER_SWEEP_JOB_ID,
  reminderJobId,
} from './reminders.constants';
import { queueOpWithTimeout } from './redis.util';
import {
  computeScheduledAt,
  isOffsetValid,
  REMINDER_OFFSETS_DEFAULT,
  snoozeTarget,
  SNOOZE_MINUTES,
} from '../common/waktu.util';

export interface ReminderDto {
  id: string;
  taskId: string | null;
  eventId: string | null;
  sumber: 'TUGAS' | 'AKTIVITAS';
  offsetMinutes: number;
  scheduledAt: string;
  status: ReminderStatus;
  isSent: boolean;
  sentAt: string | null;
  snoozeCount: number;
  judul: string;
  lokasi: string | null;
}

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private queue: Queue,
  ) {}

  async findAll(userId: string): Promise<ReminderDto[]> {
    const reminders = await this.prisma.reminder.findMany({
      where: { userId },
      include: { task: true, event: true },
      orderBy: { scheduledAt: 'asc' },
    });
    return reminders.map((r) =>
      this.toDto({
        ...r,
        judul: r.task?.judul ?? r.event?.judul ?? '',
        lokasi: r.event?.lokasi ?? null,
      }),
    );
  }

  async listByEvent(userId: string, eventId: string): Promise<ReminderDto[]> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: eventId, userId },
      select: { id: true },
    });
    if (!activity) throw new NotFoundException('Aktivitas tidak ditemukan');
    const reminders = await this.prisma.reminder.findMany({
      where: { userId, eventId },
      include: { task: true, event: true },
      orderBy: { offsetMinutes: 'desc' },
    });
    return reminders.map((r) =>
      this.toDto({ ...r, judul: r.event?.judul ?? '', lokasi: r.event?.lokasi ?? null }),
    );
  }

  async replaceForEvent(userId: string, eventId: string, offsets: number[]): Promise<ReminderDto[]> {
    const activity = await this.prisma.activity.findFirst({
      where: { id: eventId, userId },
    });
    if (!activity) throw new NotFoundException('Aktivitas tidak ditemukan');

    const valid = offsets.filter((o) => isOffsetValid(o));
    if (valid.length !== offsets.length) {
      throw new BadRequestException('Offset pengingat harus kelipatan 5 menit dan lebih dari 0');
    }
    if (new Set(valid).size !== valid.length) {
      throw new BadRequestException('Offset pengingat tidak boleh duplikat');
    }

    const existing = await this.prisma.reminder.findMany({
      where: { userId, eventId },
      include: { event: true },
    });
    const byOffset = new Map(existing.map((r) => [r.offsetMinutes, r]));

    for (const reminder of existing) {
      if (valid.includes(reminder.offsetMinutes)) continue;
      await this.cancel(userId, [reminder.id]);
      await this.prisma.reminder.delete({ where: { id: reminder.id } });
    }

    const hasil: ReminderDto[] = [];
    for (const offsetMinutes of valid) {
      const reminder = byOffset.get(offsetMinutes);
      if (reminder) {
        const fresh = await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            scheduledAt: computeScheduledAt(activity.waktuMulai, offsetMinutes),
            status: 'SCHEDULED',
            isSent: false,
            sentAt: null,
            cancelledAt: null,
          },
          include: { event: true },
        });
        await this.schedule(fresh);
        hasil.push(this.toDto({ ...fresh, judul: activity.judul, lokasi: activity.lokasi }));
        continue;
      }
      const dibuat = await this.prisma.reminder.create({
        data: {
          userId,
          eventId,
          offsetMinutes,
          scheduledAt: computeScheduledAt(activity.waktuMulai, offsetMinutes),
        },
        include: { event: true },
      });
      await this.schedule(dibuat);
      hasil.push(this.toDto({ ...dibuat, judul: activity.judul, lokasi: activity.lokasi }));
    }
    return hasil.sort((a, b) => b.offsetMinutes - a.offsetMinutes);
  }

  async create(
    userId: string,
    dto: { taskId?: string; eventId?: string; offsetMinutes: number },
  ): Promise<ReminderDto> {
    const sumber = this.resolveSumber(dto);
    if (!isOffsetValid(dto.offsetMinutes)) {
      throw new BadRequestException('Offset pengingat harus kelipatan 5 menit dan lebih dari 0');
    }
    const target = await this.resolveTarget(userId, sumber, dto);
    const reminder = await this.prisma.reminder.create({
      data: {
        userId,
        taskId: sumber === 'TUGAS' ? dto.taskId : null,
        eventId: sumber === 'AKTIVITAS' ? dto.eventId : null,
        offsetMinutes: dto.offsetMinutes,
        scheduledAt: computeScheduledAt(target, dto.offsetMinutes),
        status: 'SCHEDULED',
      },
    });
    await this.schedule(reminder);
    return this.toDto(reminder);
  }

  async update(userId: string, id: string, dto: { offsetMinutes?: number }): Promise<ReminderDto> {
    const existing = await this.ensureOwned(userId, id);
    if (dto.offsetMinutes !== undefined && !isOffsetValid(dto.offsetMinutes)) {
      throw new BadRequestException('Offset pengingat harus kelipatan 5 menit dan lebih dari 0');
    }
    const offsetMinutes = dto.offsetMinutes ?? existing.offsetMinutes;
    const target = existing.taskId
      ? existing.task!.deadline
      : existing.event!.waktuMulai;
    const updated = await this.prisma.reminder.update({
      where: { id },
      data: {
        offsetMinutes,
        scheduledAt: computeScheduledAt(target, offsetMinutes),
        status: 'SCHEDULED',
        isSent: false,
        sentAt: null,
        cancelledAt: null,
      },
      include: { task: { include: { course: true } }, event: true },
    });
    await this.schedule(updated);
    return this.toDto(updated);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.cancel(userId, [id]);
    await this.prisma.reminder.delete({ where: { id } });
    return { message: 'Pengingat berhasil dihapus' };
  }

  async syncTask(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { reminders: true },
    });
    if (!task || task.reminders.length === 0) return;
    if (task.status === 'SELESAI') {
      await this.cancel(
        task.userId,
        task.reminders.map((r) => r.id),
      );
      return;
    }
    for (const reminder of task.reminders) {
      if (reminder.status === 'CANCELLED') continue;
      const fresh = await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          scheduledAt: computeScheduledAt(task.deadline, reminder.offsetMinutes),
          status: 'SCHEDULED',
          isSent: false,
          sentAt: null,
          cancelledAt: null,
        },
        include: { task: { include: { course: true } }, event: true },
      });
      await this.schedule(fresh);
    }
  }

  async syncActivity(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { reminders: true },
    });
    if (!activity || activity.reminders.length === 0) return;
    for (const reminder of activity.reminders) {
      const fresh = await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          scheduledAt: computeScheduledAt(activity.waktuMulai, reminder.offsetMinutes),
          status: 'SCHEDULED',
          isSent: false,
          sentAt: null,
          cancelledAt: null,
        },
        include: { task: { include: { course: true } }, event: true },
      });
      await this.schedule(fresh);
    }
  }

  async ensureDefaultForTask(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { reminders: true },
    });
    if (!task || task.reminders.length > 0) return;
    for (const offsetMinutes of REMINDER_OFFSETS_DEFAULT) {
      const reminder = await this.prisma.reminder.create({
        data: {
          userId: task.userId,
          taskId: task.id,
          offsetMinutes,
          scheduledAt: computeScheduledAt(task.deadline, offsetMinutes),
        },
      });
      await this.schedule(reminder);
    }
  }

  async ensureDefaultForActivity(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { reminders: true },
    });
    if (!activity || activity.reminders.length > 0) return;
    for (const offsetMinutes of REMINDER_OFFSETS_DEFAULT) {
      const reminder = await this.prisma.reminder.create({
        data: {
          userId: activity.userId,
          eventId: activity.id,
          offsetMinutes,
          scheduledAt: computeScheduledAt(activity.waktuMulai, offsetMinutes),
        },
      });
      await this.schedule(reminder);
    }
  }

  async unscheduleTask(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { reminders: true },
    });
    if (!task) return;
    await this.cancel(
      task.userId,
      task.reminders.map((r) => r.id),
    );
  }

  async unscheduleActivity(activityId: string): Promise<void> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { reminders: true },
    });
    if (!activity) return;
    await this.cancel(
      activity.userId,
      activity.reminders.map((r) => r.id),
    );
  }

  async markTaskSelesai(userId: string, taskId: string): Promise<{ judul: string } | null> {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, userId } });
    if (!task) return null;
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'SELESAI' },
    });
    await this.syncTask(taskId);
    return { judul: task.judul };
  }

  async snooze(
    userId: string,
    reminderId: string,
  ): Promise<{ terkirim: boolean; alasan?: string; scheduledAt?: string }> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, userId },
      include: { task: true, event: true },
    });
    if (!reminder) return { terkirim: false, alasan: 'Pengingat tidak ditemukan' };
    if (!reminder.taskId && !reminder.eventId) {
      return { terkirim: false, alasan: 'Pengingat tidak punya sumber' };
    }
    const batas = reminder.taskId ? reminder.task!.deadline : reminder.event!.waktuMulai;
    const baru = snoozeTarget(reminder.scheduledAt, batas, SNOOZE_MINUTES);
    const updated = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        scheduledAt: baru,
        status: 'SCHEDULED',
        isSent: false,
        sentAt: null,
        snoozeCount: { increment: 1 },
      },
    });
    await this.schedule(updated);
    return { terkirim: true, scheduledAt: baru.toISOString() };
  }

  async cancel(userId: string, reminderIds: string[]): Promise<void> {
    if (reminderIds.length === 0) return;
    await this.prisma.reminder.updateMany({
      where: { id: { in: reminderIds }, userId, status: { in: ['SCHEDULED', 'SNOOZED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await Promise.allSettled(
      reminderIds.map((id) =>
        queueOpWithTimeout(
          () => this.queue.remove(reminderJobId(id)),
          `gagal membatalkan job ${id}`,
        ),
      ),
    );
  }

  async requeue(reminderId: string): Promise<void> {
    const reminder = await this.prisma.reminder.findUnique({ where: { id: reminderId } });
    if (!reminder || reminder.status === 'CANCELLED') return;
    await queueOpWithTimeout(
      () =>
        this.queue.add(
          REMINDER_JOB_FIRE,
          { reminderId: reminder.id },
          { jobId: reminderJobId(reminder.id), removeOnComplete: 1000, removeOnFail: 5000 },
        ),
      `gagal menjadwalkan ulang ${reminderId}`,
    );
  }

  registerSweepJob(): void {
    void queueOpWithTimeout(
      () =>
        this.queue.add(
          REMINDER_JOB_SWEEP,
          {},
          {
            repeat: { every: Number(process.env.REMINDER_SWEEP_MS ?? 60000) },
            jobId: REMINDER_SWEEP_JOB_ID,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        ),
      'gagal mendaftarkan job sweep',
    );
  }

  private async schedule(reminder: { id: string; scheduledAt: Date }): Promise<void> {
    const delay = Math.max(0, reminder.scheduledAt.getTime() - Date.now());
    await queueOpWithTimeout(
      () =>
        this.queue.add(
          REMINDER_JOB_FIRE,
          { reminderId: reminder.id },
          {
            jobId: reminderJobId(reminder.id),
            delay,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        ),
      'gagal menjadwalkan job',
    );
  }

  private resolveSumber(dto: { taskId?: string; eventId?: string }): 'TUGAS' | 'AKTIVITAS' {
    if (dto.taskId && dto.eventId) {
      throw new BadRequestException('Pilih salah satu: tugas atau aktivitas');
    }
    if (!dto.taskId && !dto.eventId) {
      throw new BadRequestException('taskId atau eventId wajib diisi');
    }
    return dto.taskId ? 'TUGAS' : 'AKTIVITAS';
  }

  private async resolveTarget(
    userId: string,
    sumber: 'TUGAS' | 'AKTIVITAS',
    dto: { taskId?: string; eventId?: string },
  ): Promise<Date> {
    if (sumber === 'TUGAS') {
      const task = await this.prisma.task.findFirst({ where: { id: dto.taskId, userId } });
      if (!task) throw new NotFoundException('Tugas tidak ditemukan');
      return task.deadline;
    }
    const activity = await this.prisma.activity.findFirst({ where: { id: dto.eventId, userId } });
    if (!activity) throw new NotFoundException('Aktivitas tidak ditemukan');
    return activity.waktuMulai;
  }

  private async ensureOwned(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
      include: { task: { include: { course: true } }, event: true },
    });
    if (!reminder) throw new NotFoundException('Pengingat tidak ditemukan');
    return reminder;
  }

  private toDto(reminder: {
    id: string;
    taskId: string | null;
    eventId: string | null;
    offsetMinutes: number;
    scheduledAt: Date;
    status: ReminderStatus;
    isSent: boolean;
    sentAt: Date | null;
    snoozeCount: number;
    judul?: string;
    lokasi?: string | null;
  }): ReminderDto {
    return {
      id: reminder.id,
      taskId: reminder.taskId,
      eventId: reminder.eventId,
      sumber: reminder.taskId ? 'TUGAS' : 'AKTIVITAS',
      offsetMinutes: reminder.offsetMinutes,
      scheduledAt: reminder.scheduledAt.toISOString(),
      status: reminder.status,
      isSent: reminder.isSent,
      sentAt: reminder.sentAt?.toISOString() ?? null,
      snoozeCount: reminder.snoozeCount,
      judul: reminder.judul ?? '',
      lokasi: reminder.lokasi ?? null,
    };
  }
}
