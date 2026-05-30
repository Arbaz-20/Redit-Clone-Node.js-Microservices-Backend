// post-service/src/repositories/post.repository.ts
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { posts } from '../db/schema';

const postProjection = {
  id: posts.id,
  community_id: posts.communityId,
  author_id: posts.authorId,
  author_username: posts.authorUsername,
  title: posts.title,
  body: posts.body,
  vote_score: posts.voteScore,
  created_at: posts.createdAt,
};

export class PostRepository {
  public async insert(row: { id: string; communityId: string; authorId: string; authorUsername: string; title: string; body: string }) {
    await db.insert(posts).values(row);
  }

  public async list(communityId?: string) {
    if (communityId) {
      return db.select(postProjection).from(posts).where(eq(posts.communityId, communityId)).orderBy(desc(posts.createdAt)).limit(100);
    }
    return db.select(postProjection).from(posts).orderBy(desc(posts.createdAt)).limit(100);
  }

  public async getById(id: string) {
    const rows = await db.select(postProjection).from(posts).where(eq(posts.id, id)).limit(1);
    return rows[0];
  }

  public async delete(id: string) {
    await db.delete(posts).where(eq(posts.id, id));
  }

  public async addScore(id: string, delta: number) {
    await db.update(posts).set({ voteScore: sql`${posts.voteScore} + ${delta}` }).where(eq(posts.id, id));
  }
}

export const postRepository = new PostRepository();
