import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RemindersModule } from '../reminders/reminders.module';
import { queueOpWithTimeout } from '../reminders/redis.util';
import { OverdueProcessor, OVERDUE_JOB_ID, OVERDUE_JOB_NAME, OVERDUE_QUEUE } from './overdue.processor';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    RemindersModule,
    BullModule.registerQueue({ name: OVERDUE_QUEUE }),
  ],
  controllers: [TasksController],
  providers: [TasksService, OverdueProcessor],
})
export class TasksModule implements OnApplicationBootstrap {
  constructor(@InjectQueue(OVERDUE_QUEUE) private queue: Queue) {}

  async onApplicationBootstrap() {
    await queueOpWithTimeout(
      () =>
        this.queue.add(
          OVERDUE_JOB_NAME,
          {},
          {
            repeat: { pattern: '0 0 * * *' },
            jobId: OVERDUE_JOB_ID,
            removeOnComplete: 100,
            removeOnFail: 1000,
          },
        ),
      'gagal mendaftarkan job overdue harian',
    );
  }
}