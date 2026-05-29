// vote-service/src/repositories/vote.repository.ts
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { votes } from '../db/schema';

export const voteRepository = {
  async currentValue(userId: string, targetType: string, targetId: string): Promise<number> {
    const rows = await db.select({ value: votes.value }).from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.targetType, targetType), eq(votes.targetId, targetId))).limit(1);
    return rows.length ? rows[0].value : 0;
  },
  async clear(userId: string, targetType: string, targetId: string) {
    await db.delete(votes).where(and(eq(votes.userId, userId), eq(votes.targetType, targetType), eq(votes.targetId, targetId)));
  },
  async upsert(id: string, userId: string, targetType: string, targetId: string, value: number) {
    await db.insert(votes).values({ id, userId, targetType, targetId, value })
      .onConflictDoUpdate({ target: [votes.userId, votes.targetType, votes.targetId], set: { value } });
  },
  async score(targetType: string, targetId: string): Promise<number> {
    const rows = await db.select({ score: sql<number>`COALESCE(SUM(${votes.value}), 0)::int` }).from(votes)
      .where(and(eq(votes.targetType, targetType), eq(votes.targetId, targetId)));
    return rows[0].score;
  },
};
