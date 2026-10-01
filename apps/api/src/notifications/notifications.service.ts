import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@campusflow/database';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationQueryDto,
  RemovePushSubscriptionDto,
  SavePushSubscriptionDto,
  UpdatePreferenceDto,
} from './dto';
import { PushService } from './push.service';

function toDto(
  notification: Prisma.NotificationGetPayload<{
    include: { reminder: { include: { task: true, event: true } } };
  }>,
) {
  return {
    id: notification.id,
    tipe: notification.tipe,
    channel: notification.channel,
    status: notification.status,
    pesan: notification.pesan,
    scheduledAt: notification.scheduledAt.toISOString(),
    createdAt: notification.createdAt.toISOString(),
    isSent: notification.isSent,
    isRead: notification.isRead,
    sentAt: notification.sentAt?.toISOString() ?? null,
    error: notification.error,
    reminderId: notification.reminderId,
    reminder: notification.reminder
      ? {
          id: notification.reminder.id,
          taskId: notification.reminder.taskId,
          eventId: notification.reminder.eventId,
          offsetMinutes: notification.reminder.offsetMinutes,
          scheduledAt: notification.reminder.scheduledAt.toISOString(),
          task: notification.reminder.task
            ? {
                id: notification.reminder.task.id,
                judul: notification.reminder.task.judul,
                deadline: notification.reminder.task.deadline.toISOString(),
                status: notification.reminder.task.status,
              }
            : null,
          event: notification.reminder.event
            ? {
                id: notification.reminder.event.id,
                judul: notification.reminder.event.judul,
                waktuMulai: notification.reminder.event.waktuMulai.toISOString(),
                lokasi: notification.reminder.event.lokasi,
              }
            : null,
        }
      : null,
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  async findAll(userId: string, query: NotificationQueryDto) {
    const unreadOnly =
      query.unreadOnly !== undefined && query.unreadOnly === 'true';

    const notifications = await this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      include: { reminder: { include: { task: true } } },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    });

    return notifications.map(toDto);
  }

  async markRead(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }

  async clearAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });
    return { deleted: result.count };
  }

  async saveSubscription(userId: string, dto: SavePushSubscriptionDto) {
    const keys = { p256dh: dto.p256dh, auth: dto.auth } as Prisma.InputJsonValue;
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, keys },
      update: { userId, keys },
    });
    return this.mapSubscription(
      await this.prisma.pushSubscription.findUniqueOrThrow({
        where: { endpoint: dto.endpoint },
      }),
    );
  }

  async removeSubscription(userId: string, dto: RemovePushSubscriptionDto) {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint: dto.endpoint },
    });
    return { deleted: result.count };
  }

  async getPreferences(userId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return pref ?? { autoRemindersEnabled: true, pushEnabled: true };
  }

  async updatePreferences(userId: string, dto: UpdatePreferenceDto) {
    const upsert = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        autoRemindersEnabled: dto.autoRemindersEnabled ?? true,
        pushEnabled: dto.pushEnabled ?? true,
      },
      update: {
        ...(dto.autoRemindersEnabled !== undefined
          ? { autoRemindersEnabled: dto.autoRemindersEnabled }
          : {}),
        ...(dto.pushEnabled !== undefined ? { pushEnabled: dto.pushEnabled } : {}),
      },
    });
    return {
      autoRemindersEnabled: upsert.autoRemindersEnabled,
      pushEnabled: upsert.pushEnabled,
    };
  }

  async sendPush(userId: string, notification: { id: string; pesan: string }) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (pref && !pref.pushEnabled) return;
    await this.push.sendToUser(userId, notification);
  }

  private mapSubscription(sub: {
    id: string;
    endpoint: string;
  }): { id: string; endpoint: string } {
    return { id: sub.id, endpoint: sub.endpoint };
  }

  private async ensureOwned(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) throw new NotFoundException('Notifikasi tidak ditemukan');
    return notification;
  }
}