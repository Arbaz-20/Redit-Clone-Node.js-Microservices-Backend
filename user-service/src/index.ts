// user-service/src/index.ts
import { env } from './config/env';
import { logger } from './lib/logger';
import { applyMigrations } from './db/migrate';
import { initBroker } from './lib/broker';
import { startConsumers } from './events/user.consumer';
import { buildApp } from './app';

async function bootstrap() {
  await applyMigrations();
  await initBroker();
  await startConsumers();
  const app = buildApp();
  app.listen(env.port, () => logger.info(`User service listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`User service failed to start: ${err.message}`);
  process.exit(1);
});
