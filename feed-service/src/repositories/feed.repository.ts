// feed-service/src/repositories/feed.repository.ts
// The ONLY module that talks to Redis. All feed reads/writes go through here.
import { redis } from '../lib/redis';

const RANKED = 'feed:ranked'; // hot ranking (time-decayed)
const TOP = 'feed:score';     // raw score ranking
const postKey = (id: string) => `post:${id}`;

export interface PostHash {
  id: string;
  communityId: string;
  authorUsername: string;
  title: string;
  createdAt: string; // stored as epoch ms string
  score: string;
}

export class FeedRepository {
  public async setPost(p: PostHash): Promise<void> {
    await redis.hSet(postKey(p.id), {
      id: p.id,
      communityId: p.communityId,
      authorUsername: p.authorUsername,
      title: p.title,
      createdAt: p.createdAt,
      score: p.score,
    });
  }

  public async addToRanked(postId: string, rank: number): Promise<void> {
    await redis.zAdd(RANKED, { score: rank, value: postId });
  }

  public async addToTop(postId: string, score: number): Promise<void> {
    await redis.zAdd(TOP, { score, value: postId });
  }

  public async postExists(postId: string): Promise<boolean> {
    return (await redis.exists(postKey(postId))) === 1;
  }

  public async incrementScore(postId: string, delta: number): Promise<number> {
    return redis.hIncrBy(postKey(postId), 'score', delta);
  }

  public async getCreatedAt(postId: string): Promise<number> {
    return Number(await redis.hGet(postKey(postId), 'createdAt')) || Date.now();
  }

  public async removeFromRanked(postId: string): Promise<void> {
    await redis.zRem(RANKED, postId);
  }

  public async removeFromTop(postId: string): Promise<void> {
    await redis.zRem(TOP, postId);
  }

  public async deletePost(postId: string): Promise<void> {
    await redis.del(postKey(postId));
  }

  public async rankedIds(stop: number): Promise<string[]> {
    return redis.zRange(RANKED, 0, stop, { REV: true });
  }

  public async topIds(stop: number): Promise<string[]> {
    return redis.zRange(TOP, 0, stop, { REV: true });
  }

  public async getPost(postId: string): Promise<Record<string, string>> {
    return redis.hGetAll(postKey(postId));
  }
}
export const feedRepository = new FeedRepository();
