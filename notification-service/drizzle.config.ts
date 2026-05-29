// notification-service/drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { dbUrl } from './src/config/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: dbUrl },
});
