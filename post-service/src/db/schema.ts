// post-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(),
    communityId: uuid('community_id').notNull(),
    authorId: uuid('author_id').notNull(),
    authorUsername: varchar('author_username', { length: 32 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body').notNull().default(''),
    voteScore: integer('vote_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ communityIdx: index('idx_posts_community').on(t.communityId) })
);

export type PostRow = typeof posts.$inferSelect;
