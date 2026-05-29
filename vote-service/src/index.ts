import 'dotenv/config';
import express from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, publishEvent } from './lib/broker';
import { AuthedRequest, attachUser, requireUser } from './lib/middleware';

const PORT = Number(process.env.PORT || 4006);

const DDL = `
  CREATE TABLE IF NOT EXISTS votes (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id   UUID NOT NULL,
    value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, target_type, target_id)
  );
  CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
`;

const voteSchema = Joi.object({
  targetType: Joi.string().valid('post', 'comment').required(),
  targetId: Joi.string().uuid().required(),
  value: Joi.number().valid(-1, 0, 1).required(), // 0 clears the vote
  authorId: Joi.string().uuid().allow(null).default(null), // content owner, for karma/notifications
});

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  const app = express();
  app.use(express.json());
  app.use(attachUser);

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'vote-service' }));

  app.post('/votes', requireUser, async (req: AuthedRequest, res) => {
    const { error, value } = voteSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { targetType, targetId, value: newValue, authorId } = value;
    const existing = await query('SELECT value FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3', [
      req.userId, targetType, targetId,
    ]);
    const oldValue = existing.length ? existing[0].value : 0;
    const delta = newValue - oldValue;

    if (newValue === 0) {
      await query('DELETE FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3', [req.userId, targetType, targetId]);
    } else {
      await query(
        `INSERT INTO votes (id, user_id, target_type, target_id, value) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET value = EXCLUDED.value`,
        [uuidv4(), req.userId, targetType, targetId, newValue]
      );
    }

    // Only emit when something actually changed; delta drives score/karma updates downstream.
    if (delta !== 0) {
      publishEvent('vote.created', {
        voterId: req.userId, targetType, targetId, value: newValue, delta, authorId,
        createdAt: new Date().toISOString(),
      });
    }

    res.json({ value: newValue, delta });
  });

  app.get('/votes/score', async (req, res) => {
    const { targetType, targetId } = req.query;
    if (!targetType || !targetId) return res.status(400).json({ error: 'targetType and targetId required' });
    const rows = await query('SELECT COALESCE(SUM(value), 0)::int AS score FROM votes WHERE target_type = $1 AND target_id = $2', [
      targetType, targetId,
    ]);
    res.json({ targetType, targetId, score: rows[0].score });
  });

  app.get('/votes/me', requireUser, async (req: AuthedRequest, res) => {
    const { targetType, targetId } = req.query;
    if (!targetType || !targetId) return res.status(400).json({ error: 'targetType and targetId required' });
    const rows = await query('SELECT value FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3', [
      req.userId, targetType, targetId,
    ]);
    res.json({ value: rows.length ? rows[0].value : 0 });
  });

  app.listen(PORT, () => logger.info(`Vote service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Vote service failed to start: ${err.message}`);
  process.exit(1);
});
