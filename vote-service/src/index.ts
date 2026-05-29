// vote-service/src/index.ts
import { env } from './config/env';
import { logger } from './lib/logger';
import { applyMigrations } from './db/migrate';
import { initBroker } from './lib/broker';
import { buildApp } from './app';

async function bootstrap() {
  await applyMigrations();
  await initBroker();
  const app = buildApp();
  app.listen(env.port, () => logger.info(`Vote service listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`Vote service failed to start: ${err.message}`);
  process.exit(1);
});
