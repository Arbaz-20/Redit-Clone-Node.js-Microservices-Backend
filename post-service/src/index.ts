import 'dotenv/config';
import express from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, publishEvent, consumeEvents } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4004);

const DDL = `
  CREATE TABLE IF NOT EXISTS posts (
    id              UUID PRIMARY KEY,
    community_id    UUID NOT NULL,
    author_id       UUID NOT NULL,
    author_username VARCHAR(32) NOT NULL,
    title           VARCHAR(300) NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    vote_score      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id);
`;

const createSchema = Joi.object({
  communityId: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(300).required(),
  body: Joi.string().max(10000).allow('').default(''),
});

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  // Keep a denormalized score so feeds/listings don't need to call the vote service.
  await consumeEvents('post-service.events', ['vote.created'], async (_key, payload) => {
    if (payload.targetType === 'post' && payload.delta) {
      await query('UPDATE posts SET vote_score = vote_score + $1 WHERE id = $2', [payload.delta, payload.targetId]);
    }
  });

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'post-service' }));

  app.post('/posts', requireUser, async (req: AuthedRequest, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await query(
      'INSERT INTO posts (id, community_id, author_id, author_username, title, body) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, value.communityId, req.userId, req.username || 'unknown', value.title, value.body]
    );

    publishEvent('post.created', {
      id, communityId: value.communityId, authorId: req.userId,
      authorUsername: req.username, title: value.title, createdAt,
    });

    res.status(201).json({ id, communityId: value.communityId, authorId: req.userId, title: value.title, body: value.body, voteScore: 0, createdAt });
  });

  app.get('/posts', async (req, res) => {
    const { communityId } = req.query;
    const rows = communityId
      ? await query('SELECT * FROM posts WHERE community_id = $1 ORDER BY created_at DESC LIMIT 100', [communityId])
      : await query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  });

  app.get('/posts/:id', async (req, res) => {
    const rows = await query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json(rows[0]);
  });

  app.delete('/posts/:id', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    if (rows[0].author_id !== req.userId) return res.status(403).json({ error: 'Not your post' });
    await query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    publishEvent('post.deleted', { id: req.params.id });
    res.json({ deleted: true, id: req.params.id });
  });

  app.listen(PORT, () => logger.info(`Post service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Post service failed to start: ${err.message}`);
  process.exit(1);
});
