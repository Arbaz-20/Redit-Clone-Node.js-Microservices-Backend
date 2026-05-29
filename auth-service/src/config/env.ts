// auth-service/src/config/env.ts
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 4001),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  accessTtl: process.env.JWT_EXPIRES_IN || '15m',
  refreshTtl: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'reddit',
    password: process.env.POSTGRES_PASSWORD || 'reddit_pass',
    database: required('POSTGRES_DB', 'auth_db'),
  },
};

export const dbUrl = `postgresql://${env.db.user}:${env.db.password}@${env.db.host}:${env.db.port}/${env.db.database}`;
