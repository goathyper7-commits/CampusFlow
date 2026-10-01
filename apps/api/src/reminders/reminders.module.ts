import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { TelegramModule } from '../telegram/telegram.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { RemindersProcessor } from './reminders.processor';
import { REMINDERS_QUEUE } from './reminders.constants';

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE }), NotificationsModule, TelegramModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule implements OnApplicationBootstrap {
  constructor(private reminders: RemindersService) {}

  onApplicationBootstrap(): void {
    this.reminders.registerSweepJob();
  }
}
