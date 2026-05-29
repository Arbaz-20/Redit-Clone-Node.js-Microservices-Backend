// user-service/src/db/migrate.ts
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client';
import { logger } from '../lib/logger';

export async function applyMigrations(): Promise<void> {
  // drizzle/ sits at the service root, two levels up from dist/db at runtime and src/db in dev.
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations applied');
}
