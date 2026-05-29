import 'dotenv/config';
import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './lib/logger';
import { initSchema, query } from './lib/db';
import { initBroker, publishEvent } from './lib/broker';

const PORT = Number(process.env.PORT || 4001);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const ACCESS_TTL = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TTL = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY,
    username      VARCHAR(32) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

const loginSchema = Joi.object({
  identifier: Joi.string().required(), // username OR email
  password: Joi.string().required(),
});

function issueTokens(id: string, username: string) {
  const accessToken = jwt.sign({ sub: id, username }, JWT_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions);
  const refreshToken = jwt.sign({ sub: id, username, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TTL } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

async function bootstrap() {
  await initSchema(DDL);
  await initBroker();

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

  app.post('/auth/register', async (req: Request, res: Response) => {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, email, password } = value;
    const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.length) return res.status(409).json({ error: 'Username or email already in use' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    await query('INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)', [id, username, email, passwordHash]);

    // Tell the rest of the system a user now exists (User service creates a profile, etc.).
    publishEvent('user.created', { id, username, email, createdAt: new Date().toISOString() });

    const tokens = issueTokens(id, username);
    return res.status(201).json({ user: { id, username, email }, ...tokens });
  });

  app.post('/auth/login', async (req: Request, res: Response) => {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { identifier, password } = value;
    const rows = await query('SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1', [identifier]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const tokens = issueTokens(user.id, user.username);
    return res.json({ user: { id: user.id, username: user.username, email: user.email }, ...tokens });
  });

  app.post('/auth/refresh', (req: Request, res: Response) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as any;
      if (payload.type !== 'refresh') return res.status(401).json({ error: 'Not a refresh token' });
      const accessToken = jwt.sign({ sub: payload.sub, username: payload.username }, JWT_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions);
      return res.json({ accessToken });
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  app.listen(PORT, () => logger.info(`Auth service listening on :${PORT}`));
}

bootstrap().catch((err) => {
  logger.error(`Auth service failed to start: ${err.message}`);
  process.exit(1);
});
