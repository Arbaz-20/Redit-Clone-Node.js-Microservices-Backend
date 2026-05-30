// comment-service/src/repositories/comment.repository.ts
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { comments } from '../db/schema';

const commentProjection = {
  id: comments.id,
  post_id: comments.postId,
  parent_id: comments.parentId,
  author_id: comments.authorId,
  author_username: comments.authorUsername,
  body: comments.body,
  vote_score: comments.voteScore,
  created_at: comments.createdAt,
};

export class CommentRepository {
  public async parentOnPost(parentId: string, postId: string) {
    return db.select({ id: comments.id }).from(comments)
      .where(and(eq(comments.id, parentId), eq(comments.postId, postId))).limit(1);
  }

  public async insert(row: { id: string; postId: string; parentId: string | null; authorId: string; authorUsername: string; body: string }) {
    await db.insert(comments).values(row);
  }

  public async listByPost(postId: string) {
    return db.select(commentProjection).from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(asc(comments.createdAt))
      .limit(500);
  }

  public async getById(id: string) {
    const rows = await db.select(commentProjection).from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    return rows[0];
  }

  public async delete(id: string) {
    await db.delete(comments).where(eq(comments.id, id));
  }

  public async addScore(id: string, delta: number): Promise<void> {
    await db.update(comments).set({ voteScore: sql`${comments.voteScore} + ${delta}` }).where(eq(comments.id, id));
  }
}

export const commentRepository = new CommentRepository();
