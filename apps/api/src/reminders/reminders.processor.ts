import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  REMINDER_JOB_FIRE,
  REMINDER_JOB_SWEEP,
  REMINDERS_QUEUE,
  reminderJobId,
} from './reminders.constants';
import { queueOpWithTimeout } from './redis.util';

const MAX_DUE_PER_SWEEP = 500;

export function buildMessage(task: { judul: string; deadline: Date }): string {
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

@Processor(REMINDERS_QUEUE, { concurrency: 5 })
export class RemindersProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
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
      where: { isSent: false, scheduledAt: { lte: new Date() } },
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
      include: { task: true },
    });
    if (!reminder || reminder.isSent) return;

    try {
      if (reminder.task.status !== 'SELESAI') {
        const notif = await this.prisma.notification.create({
          data: {
            userId: reminder.task.userId,
            tipe: 'REMINDER',
            pesan: buildMessage(reminder.task),
            scheduledAt: reminder.scheduledAt,
            isSent: true,
            isRead: false,
            reminderId: reminder.id,
          },
        });
        await this.notifications.sendPush(reminder.task.userId, {
          id: notif.id,
          pesan: notif.pesan,
        });
      }
      await this.prisma.reminder.update({
        where: { id: reminder.id },
        data: { isSent: true, sentAt: new Date() },
      });
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        // Notification untuk reminder ini sudah dibuat oleh job lain — abaikan.
        return;
      }
      throw err;
    }
  }
}