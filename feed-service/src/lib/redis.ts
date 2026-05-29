import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

export const redis: RedisClientType = createClient({
  socket: { host: process.env.REDIS_HOST || 'redis', port: Number(process.env.REDIS_PORT || 6379) },
});

redis.on('error', (err) => logger.error(`Redis error: ${err.message}`));

export async function initRedis(): Promise<void> {
  await redis.connect();
  logger.info('Connected to Redis');
}
