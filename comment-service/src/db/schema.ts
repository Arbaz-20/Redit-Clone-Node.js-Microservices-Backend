// comment-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull(),
    authorUsername: varchar('author_username', { length: 32 }).notNull(),
    body: text('body').notNull(),
    voteScore: integer('vote_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index('idx_comments_post').on(t.postId),
    parentIdx: index('idx_comments_parent').on(t.parentId),
  })
);

export type CommentRow = typeof comments.$inferSelect;
