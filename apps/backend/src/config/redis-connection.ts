import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

function optionsFromRedisUrl(urlString: string): RedisOptions {
  let u: URL;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error('REDIS_URL is not a valid URL');
  }

  const protocol = u.protocol.replace(':', '');
  const port = u.port ? parseInt(u.port, 10) : 6379;

  const opts: RedisOptions = {
    host: u.hostname,
    port,
  };

  if (u.password) {
    opts.password = decodeURIComponent(u.password);
  }
  if (u.username) {
    opts.username = decodeURIComponent(u.username);
  }
  if (protocol === 'rediss') {
    opts.tls = {};
  }

  return opts;
}

/**
 * Prefer REDIS_URL (e.g. Render Key Value). Otherwise REDIS_HOST + REDIS_PORT.
 */
export function getRedisConnectionOptions(
  configService: ConfigService,
): RedisOptions {
  const url = configService.get<string>('REDIS_URL')?.trim();
  if (url) {
    return optionsFromRedisUrl(url);
  }

  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: Number(configService.get('REDIS_PORT', 6379)),
  };
}
