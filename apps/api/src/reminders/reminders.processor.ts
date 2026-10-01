import { Logger } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { ChannelType } from '@campusflow/database';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  REMINDER_JOB_FIRE,
  REMINDER_JOB_SWEEP,
  REMINDERS_QUEUE,
  reminderJobId,
} from './reminders.constants';
import { queueOpWithTimeout } from './redis.util';

const MAX_DUE_PER_SWEEP = 500;

export function buildTaskMessage(task: { judul: string; deadline: Date }): string {
  const deadlineText = task.deadline.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (task.deadline.getTime() <= Date.now()) {
    return `Tugas "${task.judul}" sudah lewat deadline (${deadlineText}). Segera selesaikan!`;
  }
  return `Tugas "${task.judul}" akan deadline ${deadlineText}. Jangan sampai terlambat!`;
}

export function buildEventMessage(event: { judul: string; waktuMulai: Date }): string {
  const waktuText = event.waktuMulai.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (event.waktuMulai.getTime() <= Date.now()) {
    return `Aktivitas "${event.judul}" sudah dimulai (${waktuText}).`;
  }
  return `Aktivitas "${event.judul}" mulai ${waktuText}.`;
}

@Processor(REMINDERS_QUEUE, { concurrency: 5 })
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private telegram: TelegramService,
    @InjectQueue(REMINDERS_QUEUE) private queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === REMINDER_JOB_SWEEP) return this.sweep();
    if (job.name === REMINDER_JOB_FIRE) return this.fire(job.data.reminderId);
  }

  private async sweep() {
    const due = await this.prisma.reminder.findMany({
      where: { isSent: false, status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      take: MAX_DUE_PER_SWEEP,
    });
    for (const reminder of due) {
      await queueOpWithTimeout(
        () =>
          this.queue.add(
            REMINDER_JOB_FIRE,
            { reminderId: reminder.id },
            {
              jobId: reminderJobId(reminder.id),
              removeOnComplete: 1000,
              removeOnFail: 5000,
            },
          ),
        `gagal menjadwalkan ulang ${reminder.id}`,
      );
    }
  }

  private async fire(reminderId: string) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { task: true, event: true },
    });
    if (!reminder || reminder.isSent) return;
    if (reminder.status === 'CANCELLED') return;

    if (reminder.taskId && reminder.task?.status === 'SELESAI') {
      await this.markSent(reminder.id);
      return;
    }

    const judul = reminder.task?.judul ?? reminder.event?.judul ?? '';
    const waktuTujuan = reminder.task?.deadline ?? reminder.event?.waktuMulai;
    if (!judul || !waktuTujuan) {
      await this.markSent(reminder.id);
      return;
    }
    const pesan =
      reminder.taskId && reminder.task
        ? buildTaskMessage(reminder.task)
        : buildEventMessage(reminder.event!);

    try {
      const notif = await this.prisma.notification.create({
        data: {
          userId: reminder.userId,
          tipe: reminder.taskId ? 'REMINDER' : 'AKTIVITAS',
          channel: ChannelType.IN_APP,
          status: 'SENT',
          pesan,
          scheduledAt: reminder.scheduledAt,
          isSent: true,
          sentAt: new Date(),
          isRead: false,
          reminderId: reminder.id,
        },
      });

      const hasil = await this.telegram.sendReminder(reminder.id, {
        judul,
        waktuTujuan,
        kind: reminder.taskId ? 'TUGAS' : 'AKTIVITAS',
        taskId: reminder.taskId,
        eventId: reminder.eventId,
      });

      if (hasil.terkirim) {
        await this.prisma.notification.create({
          data: {
            userId: reminder.userId,
            tipe: reminder.taskId ? 'REMINDER' : 'AKTIVITAS',
            channel: ChannelType.TELEGRAM,
            status: 'SENT',
            pesan,
            scheduledAt: reminder.scheduledAt,
            isSent: true,
            sentAt: new Date(),
            providerMessageId: hasil.messageId ? String(hasil.messageId) : null,
          },
        });
      } else {
        await this.prisma.notification.create({
          data: {
            userId: reminder.userId,
            tipe: reminder.taskId ? 'REMINDER' : 'AKTIVITAS',
            channel: ChannelType.TELEGRAM,
            status: 'FAILED',
            pesan,
            scheduledAt: reminder.scheduledAt,
            isSent: false,
            error: hasil.alasan ?? 'tidak terkirim',
          },
        });
      }

      if (!hasil.terkirim) {
        this.logger.warn(
          `Pengingat ${reminder.id} tidak terkirim via Telegram (${hasil.alasan ?? 'tidak diketahui'}), memakai fallback in-app dan push`,
        );
      }

      await this.notifications.sendPush(reminder.userId, { id: notif.id, pesan });
      await this.markSent(reminder.id);
    } catch (err) {
      this.logger.error(
        `Gagal mengirim pengingat ${reminder.id}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }

  private async markSent(reminderId: string): Promise<void> {
    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { isSent: true, status: 'SENT', sentAt: new Date() },
    });
  }
}
