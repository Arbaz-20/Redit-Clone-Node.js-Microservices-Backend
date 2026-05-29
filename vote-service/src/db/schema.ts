// vote-service/src/db/schema.ts
import { pgTable, uuid, varchar, smallint, timestamp, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    targetType: varchar('target_type', { length: 10 }).notNull(),
    targetId: uuid('target_id').notNull(),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVote: unique('votes_user_id_target_type_target_id_key').on(t.userId, t.targetType, t.targetId),
    targetIdx: index('idx_votes_target').on(t.targetType, t.targetId),
    targetTypeChk: check('votes_target_type_check', sql`${t.targetType} IN ('post', 'comment')`),
    valueChk: check('votes_value_check', sql`${t.value} IN (-1, 1)`),
  })
);

export type VoteRow = typeof votes.$inferSelect;
