import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, {
  WebPushError,
  type PushSubscription as VapidSubscription,
} from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private vapidReady(): boolean {
    return (
      !!this.config.get<string>('VAPID_PUBLIC_KEY') &&
      !!this.config.get<string>('VAPID_PRIVATE_KEY')
    );
  }

  async sendToUser(
    userId: string,
    notification: { id: string; pesan: string },
  ): Promise<void> {
    if (!this.vapidReady()) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return;

    webpush.setVapidDetails(
      this.config.get<string>(
        'VAPID_SUBJECT',
        'mailto:admin@campusflow.local',
      ),
      this.config.get<string>('VAPID_PUBLIC_KEY', ''),
      this.config.get<string>('VAPID_PRIVATE_KEY', ''),
    );

    const payload = JSON.stringify({
      id: notification.id,
      pesan: notification.pesan,
    });

    for (const sub of subscriptions) {
      const target: VapidSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys as { p256dh: string; auth: string },
      };
      try {
        await webpush.sendNotification(target, payload);
      } catch (err) {
        const status = (err as WebPushError).statusCode;
        if (status === 401 || status === 404 || status === 410) {
          await this.prisma.pushSubscription
            .deleteMany({ where: { id: sub.id } })
            .catch(() => undefined);
          continue;
        }
        this.logger.warn(
          `[push] gagal kirim ke user ${userId}: ${(err as Error).message}`,
        );
      }
    }
  }
}