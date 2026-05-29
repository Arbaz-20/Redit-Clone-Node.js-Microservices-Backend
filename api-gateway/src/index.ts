// api-gateway/src/index.ts
import { env } from './config/env';
import { logger } from './logger';
import { buildApp } from './app';

async function bootstrap() {
  const app = await buildApp();
  app.listen(env.port, () => logger.info(`API Gateway listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`Gateway failed to start: ${err.message}`);
  process.exit(1);
});
