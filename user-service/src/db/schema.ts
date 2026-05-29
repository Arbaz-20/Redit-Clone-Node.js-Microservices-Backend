// user-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  bio: text('bio').notNull().default(''),
  karma: integer('karma').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
