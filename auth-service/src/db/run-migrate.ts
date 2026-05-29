// auth-service/src/db/run-migrate.ts
import { applyMigrations } from './migrate';
import { logger } from '../lib/logger';

applyMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  });
