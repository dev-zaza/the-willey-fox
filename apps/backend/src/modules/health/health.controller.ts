import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { getRedisConnectionOptions } from '../../config/redis-connection';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  async check() {
    const checks: Record<string, string> = {};

    // DB check
    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    // Redis check
    try {
      const redisClient = new Redis({
        ...getRedisConnectionOptions(this.configService),
        connectTimeout: 2000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await redisClient.connect();
      await redisClient.ping();
      redisClient.disconnect();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'safetag-api',
      checks,
    };
  }
}
