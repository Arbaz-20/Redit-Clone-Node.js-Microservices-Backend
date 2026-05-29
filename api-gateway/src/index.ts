// api-gateway/src/index.ts
import { createClient } from 'redis';
import { env } from './config/env';
import { logger } from './logger';
import { buildApp } from './app';

async function bootstrap() {
  const redisClient = createClient({
    socket: { host: env.redis.host, port: env.redis.port },
  });
  redisClient.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  await redisClient.connect();

  const app = buildApp(redisClient);
  app.listen(env.port, () => logger.info(`API Gateway listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`Gateway failed to start: ${err.message}`);
  process.exit(1);
});
