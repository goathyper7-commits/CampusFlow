import { ConfigService } from '@nestjs/config';
import { ConnectionOptions } from 'bullmq';

export const REMINDERS_QUEUE = 'reminders';
export const REMINDER_JOB_FIRE = 'fire';
export const REMINDER_JOB_SWEEP = 'sweep';
export const REMINDER_SWEEP_JOB_ID = 'reminders-sweep';

export const SWEEP_INTERVAL_MS = Number(process.env.REMINDER_SWEEP_MS ?? 60000);

const REDIS_TIMEOUT_MS = 10000;

export function buildRedisConnection(config: ConfigService): ConnectionOptions {
  const base: ConnectionOptions = {
    connectTimeout: REDIS_TIMEOUT_MS,
    maxRetriesPerRequest: null,
    keepAlive: 30000,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  };
  const url = config.get<string>('REDIS_URL');
  if (url) return { ...base, url };
  return {
    ...base,
    host: config.get<string>('REDIS_HOST') ?? 'localhost',
    port: Number(config.get<string>('REDIS_PORT') ?? 6379),
  };
}

export function reminderJobId(reminderId: string): string {
  return `reminder-${reminderId}`;
}