// comment-service/src/config/env.ts
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 4005),
  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'reddit',
    password: process.env.POSTGRES_PASSWORD || 'reddit_pass',
    database: required('POSTGRES_DB', 'comment_db'),
  },
};

export const dbUrl = `postgresql://${env.db.user}:${env.db.password}@${env.db.host}:${env.db.port}/${env.db.database}`;
