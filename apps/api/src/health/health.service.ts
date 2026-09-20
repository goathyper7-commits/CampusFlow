import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async check() {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    let redis = 'up';
    let redisClient: Redis | null = null;
    try {
      redisClient = new Redis(this.config.get<string>('REDIS_URL', ''), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
      });
      await redisClient.connect();
      await redisClient.ping();
    } catch {
      redis = 'down';
    } finally {
      if (redisClient) {
        try {
          await redisClient.quit();
        } catch {
          redisClient.disconnect();
        }
      }
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}