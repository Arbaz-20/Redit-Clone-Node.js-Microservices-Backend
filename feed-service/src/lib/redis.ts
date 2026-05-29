import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis: RedisClientType = createClient({
  socket: { host: env.redis.host, port: env.redis.port },
});

redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));

export async function initRedis(): Promise<void> {
  await redis.connect();
  logger.info('Connected to Redis');
}
