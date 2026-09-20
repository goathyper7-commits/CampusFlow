import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RemindersController } from './reminders.controller';
import { RemindersProcessor } from './reminders.processor';
import { RemindersService } from './reminders.service';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  REMINDER_JOB_SWEEP,
  REMINDER_SWEEP_JOB_ID,
  REMINDERS_QUEUE,
  SWEEP_INTERVAL_MS,
} from './reminders.constants';
import { queueOpWithTimeout } from './redis.util';

@Module({
  imports: [
    BullModule.registerQueue({ name: REMINDERS_QUEUE }),
    NotificationsModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersProcessor],
  exports: [RemindersService],
})
export class RemindersModule implements OnApplicationBootstrap {
  constructor(@InjectQueue(REMINDERS_QUEUE) private queue: Queue) {}

  async onApplicationBootstrap() {
    await queueOpWithTimeout(
      () =>
        this.queue.add(
          REMINDER_JOB_SWEEP,
          {},
          {
            repeat: { every: SWEEP_INTERVAL_MS },
            jobId: REMINDER_SWEEP_JOB_ID,
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        ),
      'gagal mendaftarkan job sweep',
    );
  }
}