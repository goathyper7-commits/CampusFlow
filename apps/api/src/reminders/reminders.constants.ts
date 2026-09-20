import { ConfigService } from '@nestjs/config';
import { ConnectionOptions } from 'bullmq';

export const REMINDERS_QUEUE = 'reminders';
export const REMINDER_JOB_FIRE = 'fire';
export const REMINDER_JOB_SWEEP = 'sweep';
export const REMINDER_SWEEP_JOB_ID = 'reminders-sweep';

export const SWEEP_INTERVAL_MS = Number(process.env.REMINDER_SWEEP_MS ?? 60000);

export function buildRedisConnection(config: ConfigService): ConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) return { url };
  return {
    host: config.get<string>('REDIS_HOST') ?? 'localhost',
    port: Number(config.get<string>('REDIS_PORT') ?? 6379),
  };
}

export function reminderJobId(reminderId: string): string {
  return `reminder-${reminderId}`;
}