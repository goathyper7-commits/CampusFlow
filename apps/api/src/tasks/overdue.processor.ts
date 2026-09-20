import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export const OVERDUE_QUEUE = 'overdue';
export const OVERDUE_JOB_NAME = 'mark-overdue';
export const OVERDUE_JOB_ID = 'overdue:daily';

@Processor(OVERDUE_QUEUE)
export class OverdueProcessor extends WorkerHost {
  private readonly logger = new Logger(OverdueProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    const now = new Date();
    const result = await this.prisma.task.updateMany({
      where: {
        status: { not: 'SELESAI' },
        deadline: { lt: now },
      },
      data: { status: 'TERLAMBAT' },
    });
    this.logger.log(`Tanda-lunas otomatis: ${result.count} tugas -> TERLAMBAT`);
    return { updated: result.count };
  }
}