import { Pool } from 'pg';
import { logger } from './logger';

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'reddit',
  password: process.env.POSTGRES_PASSWORD || 'reddit_pass',
  database: process.env.POSTGRES_DB,
});

pool.on('error', (err) => logger.error(`Postgres pool error: ${err.message}`));

// Runs CREATE TABLE IF NOT EXISTS statements on boot (migration-on-start).
export async function initSchema(ddl: string): Promise<void> {
  await pool.query(ddl);
  logger.info('Database schema ready');
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
