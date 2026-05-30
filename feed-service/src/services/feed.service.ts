// feed-service/src/services/feed.service.ts
import { feedRepository } from '../repositories/feed.repository';
import { logger } from '../lib/logger';

export interface FeedPost {
  id: string;
  communityId: string;
  authorUsername: string;
  title: string;
  score: number;
  createdAt: string;
}

export class FeedService {
  // Reddit "hot" style decay from the execution plan.
  private hotRank(score: number, createdAtMs: number): number {
    const ageInHours = (Date.now() - createdAtMs) / 3_600_000;
    return score / Math.pow(ageInHours + 2, 1.5);
  }

  private async hydrate(ids: string[]): Promise<FeedPost[]> {
    const out: FeedPost[] = [];
    for (const id of ids) {
      const h = await feedRepository.getPost(id);
      if (!h || !h.id) continue;
      out.push({
        id: h.id,
        communityId: h.communityId,
        authorUsername: h.authorUsername,
        title: h.title,
        score: Number(h.score),
        createdAt: new Date(Number(h.createdAt)).toISOString(),
      });
    }
    return out;
  }

  public async indexPost(p: { id: string; communityId: string; authorUsername: string; title: string; createdAt: string }) {
    const createdAtMs = new Date(p.createdAt).getTime();
    await feedRepository.setPost({
      id: p.id,
      communityId: p.communityId,
      authorUsername: p.authorUsername || 'unknown',
      title: p.title,
      createdAt: String(createdAtMs),
      score: '0',
    });
    await feedRepository.addToRanked(p.id, this.hotRank(0, createdAtMs));
    await feedRepository.addToTop(p.id, 0);
    logger.info(`Indexed post ${p.id} into feed`);
  }

  public async applyVote(postId: string, delta: number) {
    const exists = await feedRepository.postExists(postId);
    if (!exists) return; // post not indexed (e.g. vote arrived first) — ignore
    const newScore = await feedRepository.incrementScore(postId, delta);
    const createdAtMs = await feedRepository.getCreatedAt(postId);
    await feedRepository.addToRanked(postId, this.hotRank(newScore, createdAtMs));
    await feedRepository.addToTop(postId, newScore);
  }

  public async removePost(postId: string) {
    await feedRepository.removeFromRanked(postId);
    await feedRepository.removeFromTop(postId);
    await feedRepository.deletePost(postId);
  }

  // Hot feed (time-decayed ranking). Optional communityId filter = lightweight personalization.
  public async getHotFeed(limit: number, communityId?: string): Promise<FeedPost[]> {
    const ids = await feedRepository.rankedIds(limit * 3);
    let posts = await this.hydrate(ids);
    if (communityId) posts = posts.filter((p) => p.communityId === communityId);
    return posts.slice(0, limit);
  }

  // Top feed (raw vote score).
  public async getTopFeed(limit: number): Promise<FeedPost[]> {
    const ids = await feedRepository.topIds(limit - 1);
    return this.hydrate(ids);
  }
}
export const feedService = new FeedService();
