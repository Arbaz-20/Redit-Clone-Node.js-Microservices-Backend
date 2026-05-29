// notification-service/src/db/schema.ts
import { pgTable, uuid, varchar, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('idx_notifications_user').on(t.userId, t.read) })
);

export type NotificationRow = typeof notifications.$inferSelect;
