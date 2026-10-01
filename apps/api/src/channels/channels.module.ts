import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChannelsController, TelegramWebhookController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { OtpModule } from '../otp/otp.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramUpdatesService } from '../telegram/telegram.updates';
import { TelegramService } from '../telegram/telegram.service';
import { RemindersModule } from '../reminders/reminders.module';

@Module({
  imports: [RemindersModule, OtpModule, TelegramModule],
  controllers: [ChannelsController, TelegramWebhookController],
  providers: [ChannelsService, TelegramUpdatesService],
  exports: [ChannelsService, TelegramModule],
})
export class ChannelsModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChannelsModule.name);

  constructor(
    private telegram: TelegramService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const base = this.config.get<string>('PUBLIC_API_URL');
    const secret = this.config.get<string>('TG_WEBHOOK_SECRET');
    if (!this.telegram.aktif()) {
      this.logger.log('TG_BOT_TOKEN kosong, bot Telegram dinonaktifkan');
      return;
    }
    if (!base || !secret) {
      this.logger.warn('PUBLIC_API_URL atau TG_WEBHOOK_SECRET kosong, webhook tidak dipasang');
      return;
    }
    const url = `${base.replace(/\/$/, '')}/api/telegram/webhook`;
    try {
      await this.telegram.setWebhook(url, secret);
      this.logger.log(`Webhook Telegram dipasang di ${url}`);
    } catch (galat) {
      this.logger.error(`Gagal memasang webhook: ${(galat as Error).message}`);
    }
  }
}
