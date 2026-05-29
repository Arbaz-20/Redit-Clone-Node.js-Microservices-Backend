// community-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const communities = pgTable('communities', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  description: text('description').notNull().default(''),
  ownerId: uuid('owner_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.communityId, t.userId] }) })
);

export type CommunityRow = typeof communities.$inferSelect;
