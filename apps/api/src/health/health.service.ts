import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private redis!: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    this.redis = url
      ? new Redis(url, {
          maxRetriesPerRequest: 1,
          connectTimeout: 1500,
          retryStrategy: () => null,
        })
      : new Redis({
          host: this.config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(this.config.get<string>('REDIS_PORT') ?? 6379),
          maxRetriesPerRequest: 1,
          connectTimeout: 1500,
          retryStrategy: () => null,
        });
    this.redis.on('error', () => {});
  }

  async check() {
    let database = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    let redis = 'up';
    try {
      await this.redis.ping();
    } catch {
      redis = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}