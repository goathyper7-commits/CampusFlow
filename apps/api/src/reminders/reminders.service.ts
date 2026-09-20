import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto, UpdateReminderDto } from './dto';
import {
  REMINDER_JOB_FIRE,
  REMINDERS_QUEUE,
  reminderJobId,
} from './reminders.constants';
import { queueOpWithTimeout } from './redis.util';

const HOUR_MS = 60 * 60 * 1000;

function computeScheduledAt(deadline: Date, offsetHours: number): Date {
  return new Date(deadline.getTime() - offsetHours * HOUR_MS);
}

function toDto(reminder: {
  id: string;
  offsetHours: number;
  scheduledAt: Date;
  isSent: boolean;
  sentAt: Date | null;
  task: {
    id: string;
    judul: string;
    deadline: Date;
    status: string;
    course: { id: string; kode: string; namaMatkul: string; sks: number; dosen: string | null } | null;
  };
}) {
  return {
    id: reminder.id,
    offsetHours: reminder.offsetHours,
    scheduledAt: reminder.scheduledAt.toISOString(),
    isSent: reminder.isSent,
    sentAt: reminder.sentAt?.toISOString() ?? null,
    task: {
      id: reminder.task.id,
      judul: reminder.task.judul,
      deadline: reminder.task.deadline.toISOString(),
      status: reminder.task.status,
      course: reminder.task.course,
    },
  };
}

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private queue: Queue,
  ) {}

  async findAll(userId: string) {
    const reminders = await this.prisma.reminder.findMany({
      where: { task: { userId } },
      include: { task: { include: { course: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
    return reminders.map(toDto);
  }

  async create(userId: string, dto: CreateReminderDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: dto.taskId, userId },
    });
    if (!task) throw new NotFoundException('Tugas tidak ditemukan');

    const reminder = await this.prisma.reminder.create({
      data: {
        taskId: dto.taskId,
        offsetHours: dto.offsetHours,
        scheduledAt: computeScheduledAt(task.deadline, dto.offsetHours),
      },
      include: { task: { include: { course: true } } },
    });

    await this.schedule(reminder);
    return toDto(reminder);
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    const existing = await this.ensureOwned(userId, id);
    const offsetHours = dto.offsetHours ?? existing.offsetHours;
    const scheduledAt = computeScheduledAt(existing.task.deadline, offsetHours);

    const reminder = await this.prisma.reminder.update({
      where: { id },
      data: { offsetHours, scheduledAt, isSent: false, sentAt: null },
      include: { task: { include: { course: true } } },
    });

    await this.schedule(reminder);
    return toDto(reminder);
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.removeJob(id);
    await this.prisma.reminder.delete({ where: { id } });
    return { message: 'Reminder berhasil dihapus' };
  }

  async syncTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { reminders: true },
    });
    if (!task || task.reminders.length === 0) return;

    if (task.status === 'SELESAI') {
      await Promise.allSettled(
        task.reminders.map((r) => this.removeJob(r.id)),
      );
      return;
    }

    for (const reminder of task.reminders) {
      const scheduledAt = computeScheduledAt(task.deadline, reminder.offsetHours);
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { scheduledAt },
      });
      const fresh = await this.prisma.reminder.findUniqueOrThrow({
        where: { id: reminder.id },
        include: { task: { include: { course: true } } },
      });
      await this.schedule(fresh);
    }
  }

  async unscheduleTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { reminders: true },
    });
    if (!task) return;
    await Promise.allSettled(
      task.reminders.map((r) => this.removeJob(r.id)),
    );
  }

  private async schedule(reminder: { id: string; scheduledAt: Date }) {
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

  private async removeJob(reminderId: string) {
    await queueOpWithTimeout(
      () => this.queue.remove(reminderJobId(reminderId)),
      `gagal menghapus job ${reminderId}`,
    );
  }

  private async ensureOwned(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, task: { userId } },
      include: { task: true },
    });
    if (!reminder) throw new NotFoundException('Reminder tidak ditemukan');
    return reminder;
  }
}