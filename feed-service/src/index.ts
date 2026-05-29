// feed-service/src/index.ts
import { env } from './config/env';
import { logger } from './lib/logger';
import { initRedis } from './lib/redis';
import { initBroker } from './lib/broker';
import { startConsumers } from './events/feed.consumer';
import { buildApp } from './app';

async function bootstrap() {
  await initRedis();
  await initBroker();
  await startConsumers();
  const app = buildApp();
  app.listen(env.port, () => logger.info(`Feed service listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`Feed service failed to start: ${err.message}`);
  process.exit(1);
});
