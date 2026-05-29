import 'dotenv/config';
import express from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, publishEvent, consumeEvents } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4005);

const DDL = `
  CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY,
    post_id         UUID NOT NULL,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL,
    author_username VARCHAR(32) NOT NULL,
    body            TEXT NOT NULL,
    vote_score      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
`;

const createSchema = Joi.object({
  postId: Joi.string().uuid().required(),
  parentId: Joi.string().uuid().allow(null).default(null),
  body: Joi.string().min(1).max(10000).required(),
  // Author of the post/comment being replied to — lets the notification service alert them.
  replyToUserId: Joi.string().uuid().allow(null).default(null),
});

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  await consumeEvents('comment-service.events', ['vote.created'], async (_key, payload) => {
    if (payload.targetType === 'comment' && payload.delta) {
      await query('UPDATE comments SET vote_score = vote_score + $1 WHERE id = $2', [payload.delta, payload.targetId]);
    }
  });

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'comment-service' }));

  app.post('/comments', requireUser, async (req: AuthedRequest, res) => {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.parentId) {
      const parent = await query('SELECT id FROM comments WHERE id = $1 AND post_id = $2', [value.parentId, value.postId]);
      if (!parent.length) return res.status(400).json({ error: 'Parent comment not found on this post' });
    }

    const id = uuidv4();
    await query(
      'INSERT INTO comments (id, post_id, parent_id, author_id, author_username, body) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, value.postId, value.parentId, req.userId, req.username || 'unknown', value.body]
    );

    publishEvent('comment.created', {
      id, postId: value.postId, parentId: value.parentId, authorId: req.userId,
      authorUsername: req.username, replyToUserId: value.replyToUserId,
      snippet: value.body.slice(0, 120), createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id, postId: value.postId, parentId: value.parentId, authorId: req.userId, body: value.body, voteScore: 0 });
  });

  // Returns a flat list ordered for client-side tree building (parent_id links replies).
  app.get('/comments', async (req, res) => {
    const { postId } = req.query;
    if (!postId) return res.status(400).json({ error: 'postId query param required' });
    const rows = await query(
      'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC LIMIT 500',
      [postId]
    );
    res.json(rows);
  });

  app.get('/comments/:id', async (req, res) => {
    const rows = await query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Comment not found' });
    res.json(rows[0]);
  });

  app.delete('/comments/:id', requireUser, async (req: AuthedRequest, res) => {
    const rows = await query('SELECT author_id FROM comments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Comment not found' });
    if (rows[0].author_id !== req.userId) return res.status(403).json({ error: 'Not your comment' });
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ deleted: true, id: req.params.id });
  });

  app.listen(PORT, () => logger.info(`Comment service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Comment service failed to start: ${err.message}`);
  process.exit(1);
});
