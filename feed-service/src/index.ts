import 'dotenv/config';
import express from 'express';
import { logger } from './lib/logger';
import { initBroker, consumeEvents } from './lib/broker';
import { redis, initRedis } from './lib/redis';

const PORT = Number(process.env.PORT || 4007);

const RANKED = 'feed:ranked'; // hot ranking (time-decayed)
const TOP = 'feed:score';     // raw score ranking
const postKey = (id: string) => `post:${id}`;

// Reddit "hot" style decay from the execution plan.
function hotRank(score: number, createdAtMs: number): number {
  const ageInHours = (Date.now() - createdAtMs) / 3_600_000;
  return score / Math.pow(ageInHours + 2, 1.5);
}

async function indexPost(p: { id: string; communityId: string; authorUsername: string; title: string; createdAt: string }) {
  const createdAtMs = new Date(p.createdAt).getTime();
  await redis.hSet(postKey(p.id), {
    id: p.id,
    communityId: p.communityId,
    authorUsername: p.authorUsername || 'unknown',
    title: p.title,
    createdAt: String(createdAtMs),
    score: '0',
  });
  await redis.zAdd(RANKED, { score: hotRank(0, createdAtMs), value: p.id });
  await redis.zAdd(TOP, { score: 0, value: p.id });
  logger.info(`Indexed post ${p.id} into feed`);
}

async function applyVote(postId: string, delta: number) {
  const exists = await redis.exists(postKey(postId));
  if (!exists) return; // post not indexed (e.g. vote arrived first) — ignore
  const newScore = await redis.hIncrBy(postKey(postId), 'score', delta);
  const createdAtMs = Number(await redis.hGet(postKey(postId), 'createdAt')) || Date.now();
  await redis.zAdd(RANKED, { score: hotRank(newScore, createdAtMs), value: postId });
  await redis.zAdd(TOP, { score: newScore, value: postId });
}

async function removePost(postId: string) {
  await redis.zRem(RANKED, postId);
  await redis.zRem(TOP, postId);
  await redis.del(postKey(postId));
}

async function hydrate(ids: string[]) {
  const out = [];
  for (const id of ids) {
    const h = await redis.hGetAll(postKey(id));
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

async function bootstrap() {
  await initRedis();
  await initBroker();

  await consumeEvents('feed-service.events', ['post.created', 'post.deleted', 'vote.created'], async (key, payload) => {
    if (key === 'post.created') await indexPost(payload);
    else if (key === 'post.deleted') await removePost(payload.id);
    else if (key === 'vote.created' && payload.targetType === 'post' && payload.delta) await applyVote(payload.targetId, payload.delta);
  });

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'feed-service' }));

  // Hot feed (time-decayed ranking). Optional ?communityId filter = lightweight personalization.
  app.get('/feed', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const ids = await redis.zRange(RANKED, 0, limit * 3, { REV: true });
    let posts = await hydrate(ids);
    if (req.query.communityId) posts = posts.filter((p) => p.communityId === req.query.communityId);
    res.json(posts.slice(0, limit));
  });

  // Top feed (raw vote score).
  app.get('/feed/top', async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const ids = await redis.zRange(TOP, 0, limit - 1, { REV: true });
    res.json(await hydrate(ids));
  });

  app.listen(PORT, () => logger.info(`Feed service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Feed service failed to start: ${err.message}`);
  process.exit(1);
});
