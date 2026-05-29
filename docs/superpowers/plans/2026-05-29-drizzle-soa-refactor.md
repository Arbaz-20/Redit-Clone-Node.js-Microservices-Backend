# Drizzle ORM + Layered SOA Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Reddit-clone microservices backend from flat single-file services using raw `pg` SQL to a clean layered architecture (routes → controller → service → repository → db) backed by Drizzle ORM, with zero change to external behavior.

**Architecture:** Each Postgres service is split into `config/`, `db/` (Drizzle schema + client + migrator), `repositories/`, `services/`, `controllers/`, `routes/`, `validation/`, `middleware/`, plus `app.ts` and a thin `index.ts` bootstrap. Drizzle runs over the existing `pg` Pool via `drizzle-orm/node-postgres`. Versioned migrations are generated with `drizzle-kit` and applied on boot. `feed-service` (Redis) and `api-gateway` (no DB) get layering only.

**Tech Stack:** TypeScript, Express, Drizzle ORM (`drizzle-orm`, `drizzle-kit`), `pg`, Joi, amqplib, winston.

**Affected services:** auth, user, community, post, comment, vote, notification (Drizzle); feed (Redis, layering only); api-gateway (layering only).

---

## Verification strategy (read first)

The repo has **no test harness today**. Introducing Jest across 9 services is out of scope for this refactor. Verification per task is therefore:

1. **Type/build check:** `npm run build` (runs `tsc`) inside the service — must compile clean.
2. **Migration check:** `npx drizzle-kit generate` produces SQL; the service boots and the migrator applies it against a fresh DB without error.
3. **Smoke check:** start the stack (`docker compose up -d <service> postgres rabbitmq`) and hit the endpoints listed in that service's task, confirming identical status codes and JSON shape to the pre-refactor behavior captured in this plan.

Each service task ends with these checks and a commit. The repo is **not a git repo yet** — Task 0 initializes it so "commit" steps work.

A response-shape reference for smoke checks is embedded in each service task ("Contract" block). Do not deviate from those shapes.

---

## File structure (target, per Postgres service)

```
<service>/
  drizzle.config.ts
  drizzle/                       # generated migration SQL (drizzle-kit output)
  package.json                   # + drizzle-orm, drizzle-kit; + scripts
  src/
    config/env.ts                # typed env access
    db/
      schema.ts                  # pgTable definitions
      client.ts                  # drizzle(pool) instance + raw pool export
      migrate.ts                 # applyMigrations() — runs on boot
    validation/<name>.schema.ts  # Joi schemas
    repositories/<name>.repository.ts
    services/<name>.service.ts
    controllers/<name>.controller.ts
    routes/<name>.routes.ts
    middleware/
      auth.ts                    # attachUser, requireUser (moved from lib)
      error.ts                   # AppError + errorHandler
    lib/
      logger.ts                  # unchanged
      broker.ts                  # unchanged
    app.ts                       # buildApp(): express app with routes + error handler
    index.ts                     # bootstrap: applyMigrations → initBroker → consumers → listen
```

**Layering rules enforced in every task:**
- Controllers parse `req`/build `res` and call services. No SQL, no Drizzle imports.
- Services hold business logic, publish events, throw `AppError`. No `req`/`res`.
- Repositories are the only place that imports `db/client` or `db/schema`.
- `index.ts` wires bootstrap only; route handler logic never lives here.

---

## Task 0: Initialize git repo

**Files:**
- Create: `.gitignore` already exists; verify it ignores `node_modules` and `dist`.

- [ ] **Step 1: Check current ignore rules**

Run: `cat .gitignore`
Expected: contains `node_modules` and `dist`. If `drizzle/` is NOT present, leave it — migration files are committed intentionally.

- [ ] **Step 2: Init repo and baseline commit**

```bash
cd "D:\Backend Projects\redit clone nodejs backend"
git init
git add -A
git commit -m "chore: baseline before Drizzle + layered SOA refactor"
```

- [ ] **Step 3: Verify**

Run: `git log --oneline -1`
Expected: one commit shown.

---

## Task 1: auth-service — canonical template (full refactor)

This task defines the reusable file shapes. Later service tasks reference these files and state the exact deltas.

**Files:**
- Modify: `auth-service/package.json`
- Create: `auth-service/drizzle.config.ts`
- Create: `auth-service/src/config/env.ts`
- Create: `auth-service/src/db/schema.ts`
- Create: `auth-service/src/db/client.ts`
- Create: `auth-service/src/db/migrate.ts`
- Create: `auth-service/src/middleware/error.ts`
- Create: `auth-service/src/validation/auth.schema.ts`
- Create: `auth-service/src/repositories/user.repository.ts`
- Create: `auth-service/src/services/auth.service.ts`
- Create: `auth-service/src/controllers/auth.controller.ts`
- Create: `auth-service/src/routes/auth.routes.ts`
- Create: `auth-service/src/app.ts`
- Rewrite: `auth-service/src/index.ts`
- Delete: `auth-service/src/lib/db.ts`

**Contract (must stay identical):**
- `GET /health` → `{ status: "ok", service: "auth-service" }`
- `POST /auth/register` {username,email,password} → 201 `{ user:{id,username,email}, accessToken, refreshToken }`; 400 on validation; 409 if username/email taken. Publishes `user.created` `{ id, username, email, createdAt }`.
- `POST /auth/login` {identifier,password} → 200 `{ user:{id,username,email}, accessToken, refreshToken }`; 401 invalid; 400 validation.
- `POST /auth/refresh` {refreshToken} → 200 `{ accessToken }`; 400 missing; 401 invalid/expired.

- [ ] **Step 1: Add Drizzle deps and scripts to package.json**

Edit `auth-service/package.json` — add to `dependencies`: `"drizzle-orm": "^0.36.0"`. Add to `devDependencies`: `"drizzle-kit": "^0.28.0"`. Add to `scripts`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "node dist/db/run-migrate.js"
```

(`db:migrate` script is optional manual runner; boot also migrates. Skip `run-migrate.js` file unless you want a standalone runner.)

Run: `cd auth-service && npm install`
Expected: installs without error.

- [ ] **Step 2: Create config/env.ts**

```typescript
// auth-service/src/config/env.ts
import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT || 4001),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  accessTtl: process.env.JWT_EXPIRES_IN || '15m',
  refreshTtl: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'reddit',
    password: process.env.POSTGRES_PASSWORD || 'reddit_pass',
    database: required('POSTGRES_DB', 'auth_db'),
  },
};

export const dbUrl = `postgresql://${env.db.user}:${env.db.password}@${env.db.host}:${env.db.port}/${env.db.database}`;
```

- [ ] **Step 3: Create db/schema.ts**

```typescript
// auth-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 4: Create db/client.ts**

```typescript
// auth-service/src/db/client.ts
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import * as schema from './schema';

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
});

pool.on('error', (err) => logger.error(`Postgres pool error: ${err.message}`));

export const db = drizzle(pool, { schema });
```

- [ ] **Step 5: Create db/migrate.ts**

```typescript
// auth-service/src/db/migrate.ts
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client';
import { logger } from '../lib/logger';

export async function applyMigrations(): Promise<void> {
  // drizzle/ sits at the service root, two levels up from dist/db at runtime and src/db in dev.
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations applied');
}
```

- [ ] **Step 6: Create drizzle.config.ts**

```typescript
// auth-service/drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { dbUrl } from './src/config/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: dbUrl },
});
```

- [ ] **Step 7: Create middleware/error.ts**

```typescript
// auth-service/src/middleware/error.ts
import { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wrap async handlers so thrown errors reach errorHandler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  logger.error(`Unhandled error: ${(err as Error).message}`);
  return res.status(500).json({ error: 'Internal server error' });
}
```

- [ ] **Step 8: Create middleware/auth.ts**

Copy `auth-service/src/lib/middleware.ts` content into `auth-service/src/middleware/auth.ts` unchanged (auth-service doesn't currently use it, but later services do — keeping the file location consistent across services). Content:

```typescript
// auth-service/src/middleware/auth.ts
import { NextFunction, Request, Response } from 'express';

export interface AuthedRequest extends Request {
  userId?: string;
  username?: string;
}

export function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const id = req.headers['x-user-id'];
  const username = req.headers['x-username'];
  if (typeof id === 'string' && id) req.userId = id;
  if (typeof username === 'string' && username) req.username = username;
  next();
}

export function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
}
```

- [ ] **Step 9: Create validation/auth.schema.ts**

```typescript
// auth-service/src/validation/auth.schema.ts
import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});
```

- [ ] **Step 10: Create repositories/user.repository.ts**

```typescript
// auth-service/src/repositories/user.repository.ts
import { eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type NewUser, type UserRow } from '../db/schema';

export const userRepository = {
  async findByUsernameOrEmail(username: string, email: string): Promise<UserRow[]> {
    return db.select().from(users).where(or(eq(users.username, username), eq(users.email, email)));
  },

  async findByIdentifier(identifier: string): Promise<UserRow | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);
    return rows[0];
  },

  async insert(user: NewUser): Promise<void> {
    await db.insert(users).values(user);
  },
};
```

- [ ] **Step 11: Create services/auth.service.ts**

```typescript
// auth-service/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AppError } from '../middleware/error';
import { userRepository } from '../repositories/user.repository';
import { publishEvent } from '../lib/broker';

function issueTokens(id: string, username: string) {
  const accessToken = jwt.sign({ sub: id, username }, env.jwtSecret, { expiresIn: env.accessTtl } as jwt.SignOptions);
  const refreshToken = jwt.sign({ sub: id, username, type: 'refresh' }, env.jwtSecret, { expiresIn: env.refreshTtl } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: { username: string; email: string; password: string }) {
    const existing = await userRepository.findByUsernameOrEmail(input.username, input.email);
    if (existing.length) throw new AppError(409, 'Username or email already in use');

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(input.password, 10);
    await userRepository.insert({ id, username: input.username, email: input.email, passwordHash });

    publishEvent('user.created', { id, username: input.username, email: input.email, createdAt: new Date().toISOString() });

    return { user: { id, username: input.username, email: input.email }, ...issueTokens(id, input.username) };
  },

  async login(input: { identifier: string; password: string }) {
    const user = await userRepository.findByIdentifier(input.identifier);
    if (!user) throw new AppError(401, 'Invalid credentials');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new AppError(401, 'Invalid credentials');
    return { user: { id: user.id, username: user.username, email: user.email }, ...issueTokens(user.id, user.username) };
  },

  refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.jwtSecret) as any;
      if (payload.type !== 'refresh') throw new AppError(401, 'Not a refresh token');
      const accessToken = jwt.sign({ sub: payload.sub, username: payload.username }, env.jwtSecret, { expiresIn: env.accessTtl } as jwt.SignOptions);
      return { accessToken };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, 'Invalid or expired refresh token');
    }
  },
};
```

- [ ] **Step 12: Create controllers/auth.controller.ts**

```typescript
// auth-service/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { AppError } from '../middleware/error';
import { registerSchema, loginSchema } from '../validation/auth.schema';
import { authService } from '../services/auth.service';

export const authController = {
  async register(req: Request, res: Response) {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    const result = await authService.register(value);
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    const result = await authService.login(value);
    res.json(result);
  },

  refresh(req: Request, res: Response) {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw new AppError(400, 'refreshToken required');
    res.json(authService.refresh(refreshToken));
  },
};
```

- [ ] **Step 13: Create routes/auth.routes.ts**

```typescript
// auth-service/src/routes/auth.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { authController } from '../controllers/auth.controller';

export const authRoutes = Router();

authRoutes.post('/register', asyncHandler(authController.register));
authRoutes.post('/login', asyncHandler(authController.login));
authRoutes.post('/refresh', asyncHandler(authController.refresh));
```

- [ ] **Step 14: Create app.ts**

```typescript
// auth-service/src/app.ts
import express from 'express';
import { authRoutes } from './routes/auth.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
  app.use('/auth', authRoutes);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 15: Rewrite index.ts as thin bootstrap**

```typescript
// auth-service/src/index.ts
import { env } from './config/env';
import { logger } from './lib/logger';
import { applyMigrations } from './db/migrate';
import { initBroker } from './lib/broker';
import { buildApp } from './app';

async function bootstrap() {
  await applyMigrations();
  await initBroker();
  const app = buildApp();
  app.listen(env.port, () => logger.info(`Auth service listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`Auth service failed to start: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 16: Delete obsolete db.ts**

```bash
rm auth-service/src/lib/db.ts
```

- [ ] **Step 17: Generate migration**

Run: `cd auth-service && npx drizzle-kit generate`
Expected: a `drizzle/0000_*.sql` file is created containing `CREATE TABLE "users"` with the same columns.

- [ ] **Step 18: Build**

Run: `cd auth-service && npm run build`
Expected: `tsc` compiles with no errors. (If `migrationsFolder` path resolution warns, confirm `drizzle/` exists at service root.)

- [ ] **Step 19: Smoke test**

```bash
cd "D:\Backend Projects\redit clone nodejs backend"
docker compose up -d postgres rabbitmq auth-service
docker compose logs --tail=20 auth-service
```

Expected: logs show "Migrations applied" then "Auth service listening on :4001".
Then test (gateway not required — auth endpoints are public):
- `POST http://localhost:4001/auth/register` body `{"username":"alice","email":"a@b.com","password":"password1"}` → 201 with tokens.
- Repeat same body → 409.
- `POST /auth/login` `{"identifier":"alice","password":"password1"}` → 200.

- [ ] **Step 20: Commit**

```bash
cd "D:\Backend Projects\redit clone nodejs backend"
git add auth-service
git commit -m "refactor(auth): Drizzle ORM + layered SOA structure"
```

---

## Task 2: user-service (full refactor)

Mirror Task 1's file set. Distinct pieces below; for `config/env.ts`, `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`, `middleware/error.ts`, `middleware/auth.ts`, `app.ts`, `index.ts` use Task 1's files with these deltas: port `4002`, `POSTGRES_DB` default `user_db`, service name `user-service`, mount profile routes, and index.ts must also start the event consumer (Step 8 below).

**Files:** same layout as Task 1, plus `src/events/user.consumer.ts`. Delete `src/lib/db.ts`. Keep `src/lib/middleware.ts`? No — move it to `src/middleware/auth.ts` and delete `src/lib/middleware.ts`. Update imports accordingly.

**Contract:**
- `GET /health` → `{ status:"ok", service:"user-service" }`
- `GET /users/me` (requireUser) → 200 profile `{id,username,bio,karma,created_at}`; 404 if none.
- `PATCH /users/me` (requireUser) {bio} → 200 updated profile; 400 validation; 404 if none.
- `GET /users/:id` → 200 profile; 404 if none.
- Consumes `user.created` (insert profile), `vote.created` (karma += delta when `authorId` & `delta`).

- [ ] **Step 1: package.json** — add `drizzle-orm`, `drizzle-kit`, scripts (as Task 1 Step 1). `npm install`.

- [ ] **Step 2: db/schema.ts**

```typescript
// user-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  bio: text('bio').notNull().default(''),
  karma: integer('karma').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
```

- [ ] **Step 3: validation/profile.schema.ts**

```typescript
// user-service/src/validation/profile.schema.ts
import Joi from 'joi';
export const updateProfileSchema = Joi.object({ bio: Joi.string().max(500).allow('').required() });
```

- [ ] **Step 4: repositories/profile.repository.ts**

```typescript
// user-service/src/repositories/profile.repository.ts
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles, type ProfileRow } from '../db/schema';

export const profileRepository = {
  async findById(id: string): Promise<ProfileRow | undefined> {
    const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return rows[0];
  },

  async updateBio(id: string, bio: string): Promise<ProfileRow | undefined> {
    const rows = await db.update(profiles).set({ bio }).where(eq(profiles.id, id)).returning();
    return rows[0];
  },

  async upsertFromUserCreated(id: string, username: string): Promise<void> {
    await db.insert(profiles).values({ id, username }).onConflictDoNothing({ target: profiles.id });
  },

  async addKarma(id: string, delta: number): Promise<void> {
    await db.update(profiles).set({ karma: sql`${profiles.karma} + ${delta}` }).where(eq(profiles.id, id));
  },
};
```

- [ ] **Step 5: services/profile.service.ts**

```typescript
// user-service/src/services/profile.service.ts
import { AppError } from '../middleware/error';
import { profileRepository } from '../repositories/profile.repository';

export const profileService = {
  async getById(id: string) {
    const profile = await profileRepository.findById(id);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  },

  async updateBio(id: string, bio: string) {
    const profile = await profileRepository.updateBio(id, bio);
    if (!profile) throw new AppError(404, 'Profile not found');
    return profile;
  },
};
```

- [ ] **Step 6: controllers/profile.controller.ts**

```typescript
// user-service/src/controllers/profile.controller.ts
import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { updateProfileSchema } from '../validation/profile.schema';
import { profileService } from '../services/profile.service';

export const profileController = {
  async getMe(req: AuthedRequest, res: Response) {
    res.json(await profileService.getById(req.userId!));
  },
  async updateMe(req: AuthedRequest, res: Response) {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.json(await profileService.updateBio(req.userId!, value.bio));
  },
  async getById(req: AuthedRequest, res: Response) {
    res.json(await profileService.getById(req.params.id));
  },
};
```

- [ ] **Step 7: routes/profile.routes.ts**

```typescript
// user-service/src/routes/profile.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { profileController } from '../controllers/profile.controller';

export const profileRoutes = Router();
profileRoutes.get('/me', requireUser, asyncHandler(profileController.getMe));
profileRoutes.patch('/me', requireUser, asyncHandler(profileController.updateMe));
profileRoutes.get('/:id', asyncHandler(profileController.getById));
```

- [ ] **Step 8: events/user.consumer.ts**

```typescript
// user-service/src/events/user.consumer.ts
import { consumeEvents } from '../lib/broker';
import { profileRepository } from '../repositories/profile.repository';
import { logger } from '../lib/logger';

export async function startConsumers(): Promise<void> {
  await consumeEvents('user-service.events', ['user.created', 'vote.created'], async (key, payload) => {
    if (key === 'user.created') {
      await profileRepository.upsertFromUserCreated(payload.id, payload.username);
      logger.info(`Profile created for ${payload.username}`);
    } else if (key === 'vote.created' && payload.authorId && payload.delta) {
      await profileRepository.addKarma(payload.authorId, payload.delta);
    }
  });
}
```

- [ ] **Step 9: app.ts** — like Task 1 Step 14 but service `user-service`, `app.use(attachUser)` before routes, mount `/users`:

```typescript
// user-service/src/app.ts
import express from 'express';
import { attachUser } from './middleware/auth';
import { profileRoutes } from './routes/profile.routes';
import { errorHandler } from './middleware/error';

export function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(attachUser);
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));
  app.use('/users', profileRoutes);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 10: index.ts** — like Task 1 Step 15 plus consumers:

```typescript
// user-service/src/index.ts
import { env } from './config/env';
import { logger } from './lib/logger';
import { applyMigrations } from './db/migrate';
import { initBroker } from './lib/broker';
import { startConsumers } from './events/user.consumer';
import { buildApp } from './app';

async function bootstrap() {
  await applyMigrations();
  await initBroker();
  await startConsumers();
  const app = buildApp();
  app.listen(env.port, () => logger.info(`User service listening on :${env.port}`));
}

bootstrap().catch((err) => {
  logger.error(`User service failed to start: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 11: env.ts** — Task 1 Step 2 with `port: Number(process.env.PORT || 4002)`, `database: required('POSTGRES_DB', 'user_db')`, drop the jwt fields (unused here).

- [ ] **Step 12:** Create `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`, `middleware/error.ts`, `middleware/auth.ts` identical to Task 1 (only `db/client.ts` imports the local `./schema`, which differs automatically). Delete `src/lib/db.ts` and `src/lib/middleware.ts`.

- [ ] **Step 13:** `npx drizzle-kit generate` → expect `CREATE TABLE "profiles"`.

- [ ] **Step 14:** `npm run build` → clean.

- [ ] **Step 15: Smoke** — `docker compose up -d postgres rabbitmq auth-service user-service api-gateway`. Register a user via auth (through gateway), confirm user-service logs "Profile created", then `GET /users/me` with `x-user-id` header (or via gateway with a token) returns the profile.

- [ ] **Step 16: Commit** — `git add user-service && git commit -m "refactor(user): Drizzle ORM + layered SOA structure"`

---

## Task 3: community-service (full refactor)

Same layout. Two tables. Publishes `community.created`. No consumers.

**Contract:**
- `POST /communities` (requireUser) {name,description?} → 201 `{id,name,description,ownerId}`; 409 name taken; 400 validation. Owner auto-joins. Publishes `community.created` `{id,name,ownerId}`.
- `GET /communities` → array with `member_count`.
- `GET /communities/:id` → object with `member_count`; 404 if none.
- `POST /communities/:id/join` (requireUser) → `{joined:true,communityId}`; 404 if community missing.
- `DELETE /communities/:id/leave` (requireUser) → `{left:true,communityId}`.

- [ ] **Step 1:** package.json deps + install (as Task 1 Step 1).

- [ ] **Step 2: db/schema.ts**

```typescript
// community-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const communities = pgTable('communities', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 32 }).notNull().unique(),
  description: text('description').notNull().default(''),
  ownerId: uuid('owner_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    communityId: uuid('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.communityId, t.userId] }) })
);

export type CommunityRow = typeof communities.$inferSelect;
```

- [ ] **Step 3: validation/community.schema.ts**

```typescript
// community-service/src/validation/community.schema.ts
import Joi from 'joi';
export const createCommunitySchema = Joi.object({
  name: Joi.string().pattern(/^[A-Za-z0-9_]{3,32}$/).required(),
  description: Joi.string().max(500).allow('').default(''),
});
```

- [ ] **Step 4: repositories/community.repository.ts**

```typescript
// community-service/src/repositories/community.repository.ts
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { communities, memberships } from '../db/schema';

const memberCount = sql<number>`(SELECT count(*)::int FROM ${memberships} m WHERE m.community_id = ${communities.id})`;

export const communityRepository = {
  async findByName(name: string) {
    return db.select({ id: communities.id }).from(communities).where(eq(communities.name, name)).limit(1);
  },

  async insert(row: { id: string; name: string; description: string; ownerId: string }) {
    await db.insert(communities).values(row);
  },

  async addMember(communityId: string, userId: string, ignoreConflict = false) {
    const q = db.insert(memberships).values({ communityId, userId });
    await (ignoreConflict ? q.onConflictDoNothing() : q);
  },

  async removeMember(communityId: string, userId: string) {
    await db.delete(memberships).where(sql`${memberships.communityId} = ${communityId} AND ${memberships.userId} = ${userId}`);
  },

  async exists(id: string) {
    const rows = await db.select({ id: communities.id }).from(communities).where(eq(communities.id, id)).limit(1);
    return rows.length > 0;
  },

  async list() {
    return db
      .select({
        id: communities.id, name: communities.name, description: communities.description,
        owner_id: communities.ownerId, created_at: communities.createdAt, member_count: memberCount,
      })
      .from(communities)
      .orderBy(desc(communities.createdAt));
  },

  async getById(id: string) {
    const rows = await db
      .select({
        id: communities.id, name: communities.name, description: communities.description,
        owner_id: communities.ownerId, created_at: communities.createdAt, member_count: memberCount,
      })
      .from(communities)
      .where(eq(communities.id, id))
      .limit(1);
    return rows[0];
  },
};
```

- [ ] **Step 5: services/community.service.ts**

```typescript
// community-service/src/services/community.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { communityRepository } from '../repositories/community.repository';
import { publishEvent } from '../lib/broker';

export const communityService = {
  async create(ownerId: string, input: { name: string; description: string }) {
    const taken = await communityRepository.findByName(input.name);
    if (taken.length) throw new AppError(409, 'Community name taken');
    const id = uuidv4();
    await communityRepository.insert({ id, name: input.name, description: input.description, ownerId });
    await communityRepository.addMember(id, ownerId);
    publishEvent('community.created', { id, name: input.name, ownerId });
    return { id, name: input.name, description: input.description, ownerId };
  },

  list() {
    return communityRepository.list();
  },

  async getById(id: string) {
    const c = await communityRepository.getById(id);
    if (!c) throw new AppError(404, 'Community not found');
    return c;
  },

  async join(id: string, userId: string) {
    if (!(await communityRepository.exists(id))) throw new AppError(404, 'Community not found');
    await communityRepository.addMember(id, userId, true);
    return { joined: true, communityId: id };
  },

  async leave(id: string, userId: string) {
    await communityRepository.removeMember(id, userId);
    return { left: true, communityId: id };
  },
};
```

- [ ] **Step 6: controllers/community.controller.ts**

```typescript
// community-service/src/controllers/community.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createCommunitySchema } from '../validation/community.schema';
import { communityService } from '../services/community.service';

export const communityController = {
  async create(req: AuthedRequest, res: Response) {
    const { error, value } = createCommunitySchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await communityService.create(req.userId!, value));
  },
  async list(_req: Request, res: Response) {
    res.json(await communityService.list());
  },
  async getById(req: Request, res: Response) {
    res.json(await communityService.getById(req.params.id));
  },
  async join(req: AuthedRequest, res: Response) {
    res.json(await communityService.join(req.params.id, req.userId!));
  },
  async leave(req: AuthedRequest, res: Response) {
    res.json(await communityService.leave(req.params.id, req.userId!));
  },
};
```

- [ ] **Step 7: routes/community.routes.ts**

```typescript
// community-service/src/routes/community.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { communityController } from '../controllers/community.controller';

export const communityRoutes = Router();
communityRoutes.post('/', requireUser, asyncHandler(communityController.create));
communityRoutes.get('/', asyncHandler(communityController.list));
communityRoutes.get('/:id', asyncHandler(communityController.getById));
communityRoutes.post('/:id/join', requireUser, asyncHandler(communityController.join));
communityRoutes.delete('/:id/leave', requireUser, asyncHandler(communityController.leave));
```

- [ ] **Step 8: app.ts** — service `community-service`, `attachUser`, mount `/communities` (pattern as Task 2 Step 9).

- [ ] **Step 9: index.ts** — bootstrap without consumers (pattern as Task 1 Step 15) but service name "Community service", port from env.

- [ ] **Step 10: env.ts** — port `4003`, `POSTGRES_DB` default `community_db`, no jwt fields.

- [ ] **Step 11:** Create `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`, `middleware/error.ts`, `middleware/auth.ts` per Task 1. Delete `src/lib/db.ts` and `src/lib/middleware.ts`.

- [ ] **Step 12:** `npx drizzle-kit generate` → expect `communities` + `memberships` tables with FK + composite PK.

- [ ] **Step 13:** `npm run build` → clean.

- [ ] **Step 14: Smoke** — create a community (with `x-user-id`), list it (member_count 1), join/leave with a second user id.

- [ ] **Step 15: Commit** — `git add community-service && git commit -m "refactor(community): Drizzle ORM + layered SOA structure"`

---

## Task 4: post-service (full refactor)

Same layout. One table + index. Publishes `post.created`, `post.deleted`. Consumes `vote.created` (denormalized `vote_score`).

**Contract:**
- `POST /posts` (requireUser) {communityId,title,body?} → 201 `{id,communityId,authorId,title,body,voteScore:0,createdAt}`; 400 validation. Publishes `post.created` `{id,communityId,authorId,authorUsername,title,createdAt}`.
- `GET /posts?communityId=` → array (LIMIT 100, newest first); filtered if `communityId`.
- `GET /posts/:id` → post; 404 if none.
- `DELETE /posts/:id` (requireUser) → `{deleted:true,id}`; 404 if none; 403 if not author. Publishes `post.deleted` `{id}`.
- Consumes `vote.created` where `targetType==='post'`: `vote_score += delta` on `targetId`.

- [ ] **Step 1:** package.json deps + install.

- [ ] **Step 2: db/schema.ts**

```typescript
// post-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(),
    communityId: uuid('community_id').notNull(),
    authorId: uuid('author_id').notNull(),
    authorUsername: varchar('author_username', { length: 32 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body').notNull().default(''),
    voteScore: integer('vote_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ communityIdx: index('idx_posts_community').on(t.communityId) })
);

export type PostRow = typeof posts.$inferSelect;
```

- [ ] **Step 3: validation/post.schema.ts**

```typescript
// post-service/src/validation/post.schema.ts
import Joi from 'joi';
export const createPostSchema = Joi.object({
  communityId: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(300).required(),
  body: Joi.string().max(10000).allow('').default(''),
});
```

- [ ] **Step 4: repositories/post.repository.ts**

```typescript
// post-service/src/repositories/post.repository.ts
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, type PostRow } from '../db/schema';

export const postRepository = {
  async insert(row: { id: string; communityId: string; authorId: string; authorUsername: string; title: string; body: string }) {
    await db.insert(posts).values(row);
  },
  async list(communityId?: string): Promise<PostRow[]> {
    const base = db.select().from(posts).orderBy(desc(posts.createdAt)).limit(100);
    return communityId ? base.where(eq(posts.communityId, communityId)) : base;
  },
  async getById(id: string): Promise<PostRow | undefined> {
    const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return rows[0];
  },
  async delete(id: string) {
    await db.delete(posts).where(eq(posts.id, id));
  },
  async addScore(id: string, delta: number) {
    await db.update(posts).set({ voteScore: sql`${posts.voteScore} + ${delta}` }).where(eq(posts.id, id));
  },
};
```

Note: `base.where(...)` after `.limit()` — to keep types simple, build conditionally instead:

```typescript
  async list(communityId?: string): Promise<PostRow[]> {
    if (communityId) {
      return db.select().from(posts).where(eq(posts.communityId, communityId)).orderBy(desc(posts.createdAt)).limit(100);
    }
    return db.select().from(posts).orderBy(desc(posts.createdAt)).limit(100);
  },
```

Use this second form (replaces the first `list`).

- [ ] **Step 5: services/post.service.ts**

```typescript
// post-service/src/services/post.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { postRepository } from '../repositories/post.repository';
import { publishEvent } from '../lib/broker';

export const postService = {
  async create(authorId: string, authorUsername: string, input: { communityId: string; title: string; body: string }) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await postRepository.insert({ id, communityId: input.communityId, authorId, authorUsername, title: input.title, body: input.body });
    publishEvent('post.created', { id, communityId: input.communityId, authorId, authorUsername, title: input.title, createdAt });
    return { id, communityId: input.communityId, authorId, title: input.title, body: input.body, voteScore: 0, createdAt };
  },
  list(communityId?: string) {
    return postRepository.list(communityId);
  },
  async getById(id: string) {
    const post = await postRepository.getById(id);
    if (!post) throw new AppError(404, 'Post not found');
    return post;
  },
  async delete(id: string, userId: string) {
    const post = await postRepository.getById(id);
    if (!post) throw new AppError(404, 'Post not found');
    if (post.authorId !== userId) throw new AppError(403, 'Not your post');
    await postRepository.delete(id);
    publishEvent('post.deleted', { id });
    return { deleted: true, id };
  },
  applyVote(targetType: string, targetId: string, delta: number) {
    if (targetType === 'post' && delta) return postRepository.addScore(targetId, delta);
  },
};
```

- [ ] **Step 6: controllers/post.controller.ts**

```typescript
// post-service/src/controllers/post.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createPostSchema } from '../validation/post.schema';
import { postService } from '../services/post.service';

export const postController = {
  async create(req: AuthedRequest, res: Response) {
    const { error, value } = createPostSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await postService.create(req.userId!, req.username || 'unknown', value));
  },
  async list(req: Request, res: Response) {
    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId : undefined;
    res.json(await postService.list(communityId));
  },
  async getById(req: Request, res: Response) {
    res.json(await postService.getById(req.params.id));
  },
  async remove(req: AuthedRequest, res: Response) {
    res.json(await postService.delete(req.params.id, req.userId!));
  },
};
```

- [ ] **Step 7: routes/post.routes.ts**

```typescript
// post-service/src/routes/post.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { postController } from '../controllers/post.controller';

export const postRoutes = Router();
postRoutes.post('/', requireUser, asyncHandler(postController.create));
postRoutes.get('/', asyncHandler(postController.list));
postRoutes.get('/:id', asyncHandler(postController.getById));
postRoutes.delete('/:id', requireUser, asyncHandler(postController.remove));
```

- [ ] **Step 8: events/post.consumer.ts**

```typescript
// post-service/src/events/post.consumer.ts
import { consumeEvents } from '../lib/broker';
import { postService } from '../services/post.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents('post-service.events', ['vote.created'], async (_key, payload) => {
    await postService.applyVote(payload.targetType, payload.targetId, payload.delta);
  });
}
```

- [ ] **Step 9: app.ts** — service `post-service`, `attachUser`, mount `/posts`.

- [ ] **Step 10: index.ts** — bootstrap with `startConsumers()` (pattern as Task 2 Step 10), service name "Post service".

- [ ] **Step 11: env.ts** — port `4004`, `POSTGRES_DB` default `post_db`, no jwt.

- [ ] **Step 12:** Create shared files per Task 1; delete `src/lib/db.ts`, `src/lib/middleware.ts`.

- [ ] **Step 13:** `npx drizzle-kit generate` → `posts` table + `idx_posts_community`.

- [ ] **Step 14:** `npm run build` → clean.

- [ ] **Step 15: Smoke** — create a post (with headers), list, get, delete (wrong user → 403). Cast a vote via vote-service and confirm `vote_score` updates.

- [ ] **Step 16: Commit** — `git add post-service && git commit -m "refactor(post): Drizzle ORM + layered SOA structure"`

---

## Task 5: comment-service (full refactor)

Same layout. One self-referencing table + 2 indexes. Publishes `comment.created`. Consumes `vote.created` (denormalized score).

**Contract:**
- `POST /comments` (requireUser) {postId,parentId?,body,replyToUserId?} → 201 `{id,postId,parentId,authorId,body,voteScore:0}`; 400 validation; 400 if parentId given but not found on post. Publishes `comment.created` `{id,postId,parentId,authorId,authorUsername,replyToUserId,snippet,createdAt}`.
- `GET /comments?postId=` → flat array ASC (LIMIT 500); 400 if no postId.
- `GET /comments/:id` → comment; 404.
- `DELETE /comments/:id` (requireUser) → `{deleted:true,id}`; 404; 403 if not author.
- Consumes `vote.created` where `targetType==='comment'`.

- [ ] **Step 1:** package.json deps + install.

- [ ] **Step 2: db/schema.ts**

```typescript
// comment-service/src/db/schema.ts
import { pgTable, uuid, varchar, text, integer, timestamp, index, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').notNull(),
    authorUsername: varchar('author_username', { length: 32 }).notNull(),
    body: text('body').notNull(),
    voteScore: integer('vote_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index('idx_comments_post').on(t.postId),
    parentIdx: index('idx_comments_parent').on(t.parentId),
  })
);

export type CommentRow = typeof comments.$inferSelect;
```

- [ ] **Step 3: validation/comment.schema.ts**

```typescript
// comment-service/src/validation/comment.schema.ts
import Joi from 'joi';
export const createCommentSchema = Joi.object({
  postId: Joi.string().uuid().required(),
  parentId: Joi.string().uuid().allow(null).default(null),
  body: Joi.string().min(1).max(10000).required(),
  replyToUserId: Joi.string().uuid().allow(null).default(null),
});
```

- [ ] **Step 4: repositories/comment.repository.ts**

```typescript
// comment-service/src/repositories/comment.repository.ts
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, type CommentRow } from '../db/schema';

export const commentRepository = {
  async parentOnPost(parentId: string, postId: string) {
    return db.select({ id: comments.id }).from(comments)
      .where(and(eq(comments.id, parentId), eq(comments.postId, postId))).limit(1);
  },
  async insert(row: { id: string; postId: string; parentId: string | null; authorId: string; authorUsername: string; body: string }) {
    await db.insert(comments).values(row);
  },
  async listByPost(postId: string): Promise<CommentRow[]> {
    return db.select().from(comments).where(eq(comments.postId, postId)).orderBy(asc(comments.createdAt)).limit(500);
  },
  async getById(id: string): Promise<CommentRow | undefined> {
    const rows = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return rows[0];
  },
  async delete(id: string) {
    await db.delete(comments).where(eq(comments.id, id));
  },
  async addScore(id: string, delta: number) {
    await db.update(comments).set({ voteScore: sql`${comments.voteScore} + ${delta}` }).where(eq(comments.id, id));
  },
};
```

- [ ] **Step 5: services/comment.service.ts**

```typescript
// comment-service/src/services/comment.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { commentRepository } from '../repositories/comment.repository';
import { publishEvent } from '../lib/broker';

export const commentService = {
  async create(authorId: string, authorUsername: string, input: { postId: string; parentId: string | null; body: string; replyToUserId: string | null }) {
    if (input.parentId) {
      const parent = await commentRepository.parentOnPost(input.parentId, input.postId);
      if (!parent.length) throw new AppError(400, 'Parent comment not found on this post');
    }
    const id = uuidv4();
    await commentRepository.insert({ id, postId: input.postId, parentId: input.parentId, authorId, authorUsername, body: input.body });
    publishEvent('comment.created', {
      id, postId: input.postId, parentId: input.parentId, authorId, authorUsername,
      replyToUserId: input.replyToUserId, snippet: input.body.slice(0, 120), createdAt: new Date().toISOString(),
    });
    return { id, postId: input.postId, parentId: input.parentId, authorId, body: input.body, voteScore: 0 };
  },
  listByPost(postId: string) {
    return commentRepository.listByPost(postId);
  },
  async getById(id: string) {
    const c = await commentRepository.getById(id);
    if (!c) throw new AppError(404, 'Comment not found');
    return c;
  },
  async delete(id: string, userId: string) {
    const c = await commentRepository.getById(id);
    if (!c) throw new AppError(404, 'Comment not found');
    if (c.authorId !== userId) throw new AppError(403, 'Not your comment');
    await commentRepository.delete(id);
    return { deleted: true, id };
  },
  applyVote(targetType: string, targetId: string, delta: number) {
    if (targetType === 'comment' && delta) return commentRepository.addScore(targetId, delta);
  },
};
```

- [ ] **Step 6: controllers/comment.controller.ts**

```typescript
// comment-service/src/controllers/comment.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { createCommentSchema } from '../validation/comment.schema';
import { commentService } from '../services/comment.service';

export const commentController = {
  async create(req: AuthedRequest, res: Response) {
    const { error, value } = createCommentSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.status(201).json(await commentService.create(req.userId!, req.username || 'unknown', value));
  },
  async list(req: Request, res: Response) {
    const postId = typeof req.query.postId === 'string' ? req.query.postId : undefined;
    if (!postId) throw new AppError(400, 'postId query param required');
    res.json(await commentService.listByPost(postId));
  },
  async getById(req: Request, res: Response) {
    res.json(await commentService.getById(req.params.id));
  },
  async remove(req: AuthedRequest, res: Response) {
    res.json(await commentService.delete(req.params.id, req.userId!));
  },
};
```

- [ ] **Step 7: routes/comment.routes.ts**

```typescript
// comment-service/src/routes/comment.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { commentController } from '../controllers/comment.controller';

export const commentRoutes = Router();
commentRoutes.post('/', requireUser, asyncHandler(commentController.create));
commentRoutes.get('/', asyncHandler(commentController.list));
commentRoutes.get('/:id', asyncHandler(commentController.getById));
commentRoutes.delete('/:id', requireUser, asyncHandler(commentController.remove));
```

- [ ] **Step 8: events/comment.consumer.ts**

```typescript
// comment-service/src/events/comment.consumer.ts
import { consumeEvents } from '../lib/broker';
import { commentService } from '../services/comment.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents('comment-service.events', ['vote.created'], async (_key, payload) => {
    await commentService.applyVote(payload.targetType, payload.targetId, payload.delta);
  });
}
```

- [ ] **Step 9:** `app.ts` (service `comment-service`, `attachUser`, mount `/comments`), `index.ts` (with `startConsumers()`), `env.ts` (port `4005`, db `comment_db`, no jwt), and shared files per Task 1. Delete `src/lib/db.ts`, `src/lib/middleware.ts`.

- [ ] **Step 10:** `npx drizzle-kit generate` → `comments` + 2 indexes + self FK.

- [ ] **Step 11:** `npm run build` → clean.

- [ ] **Step 12: Smoke** — create a top-level comment, a reply (valid parent), a reply with bad parent → 400, list by post, delete (wrong user → 403).

- [ ] **Step 13: Commit** — `git add comment-service && git commit -m "refactor(comment): Drizzle ORM + layered SOA structure"`

---

## Task 6: vote-service (full refactor)

Same layout. One table with unique + check constraints. Publishes `vote.created`. No consumers.

**Contract:**
- `POST /votes` (requireUser) {targetType,targetId,value(-1|0|1),authorId?} → 200 `{value,delta}`. value 0 clears. Publishes `vote.created` `{voterId,targetType,targetId,value,delta,authorId,createdAt}` only when `delta!==0`.
- `GET /votes/score?targetType=&targetId=` → `{targetType,targetId,score}`; 400 if params missing.
- `GET /votes/me?targetType=&targetId=` (requireUser) → `{value}` (0 if none); 400 if params missing.

- [ ] **Step 1:** package.json deps + install.

- [ ] **Step 2: db/schema.ts**

```typescript
// vote-service/src/db/schema.ts
import { pgTable, uuid, varchar, smallint, timestamp, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    targetType: varchar('target_type', { length: 10 }).notNull(),
    targetId: uuid('target_id').notNull(),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVote: unique('votes_user_id_target_type_target_id_key').on(t.userId, t.targetType, t.targetId),
    targetIdx: index('idx_votes_target').on(t.targetType, t.targetId),
    targetTypeChk: check('votes_target_type_check', sql`${t.targetType} IN ('post', 'comment')`),
    valueChk: check('votes_value_check', sql`${t.value} IN (-1, 1)`),
  })
);

export type VoteRow = typeof votes.$inferSelect;
```

- [ ] **Step 3: validation/vote.schema.ts**

```typescript
// vote-service/src/validation/vote.schema.ts
import Joi from 'joi';
export const voteSchema = Joi.object({
  targetType: Joi.string().valid('post', 'comment').required(),
  targetId: Joi.string().uuid().required(),
  value: Joi.number().valid(-1, 0, 1).required(),
  authorId: Joi.string().uuid().allow(null).default(null),
});
```

- [ ] **Step 4: repositories/vote.repository.ts**

```typescript
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
```

- [ ] **Step 5: services/vote.service.ts**

```typescript
// vote-service/src/services/vote.service.ts
import { v4 as uuidv4 } from 'uuid';
import { voteRepository } from '../repositories/vote.repository';
import { publishEvent } from '../lib/broker';

export const voteService = {
  async cast(voterId: string, input: { targetType: string; targetId: string; value: number; authorId: string | null }) {
    const oldValue = await voteRepository.currentValue(voterId, input.targetType, input.targetId);
    const delta = input.value - oldValue;

    if (input.value === 0) {
      await voteRepository.clear(voterId, input.targetType, input.targetId);
    } else {
      await voteRepository.upsert(uuidv4(), voterId, input.targetType, input.targetId, input.value);
    }

    if (delta !== 0) {
      publishEvent('vote.created', {
        voterId, targetType: input.targetType, targetId: input.targetId, value: input.value,
        delta, authorId: input.authorId, createdAt: new Date().toISOString(),
      });
    }
    return { value: input.value, delta };
  },
  score(targetType: string, targetId: string) {
    return voteRepository.score(targetType, targetId);
  },
  myValue(userId: string, targetType: string, targetId: string) {
    return voteRepository.currentValue(userId, targetType, targetId);
  },
};
```

- [ ] **Step 6: controllers/vote.controller.ts**

```typescript
// vote-service/src/controllers/vote.controller.ts
import { Request, Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { AppError } from '../middleware/error';
import { voteSchema } from '../validation/vote.schema';
import { voteService } from '../services/vote.service';

function requireTarget(req: Request): { targetType: string; targetId: string } {
  const { targetType, targetId } = req.query;
  if (typeof targetType !== 'string' || typeof targetId !== 'string' || !targetType || !targetId) {
    throw new AppError(400, 'targetType and targetId required');
  }
  return { targetType, targetId };
}

export const voteController = {
  async cast(req: AuthedRequest, res: Response) {
    const { error, value } = voteSchema.validate(req.body);
    if (error) throw new AppError(400, error.details[0].message);
    res.json(await voteService.cast(req.userId!, value));
  },
  async score(req: Request, res: Response) {
    const { targetType, targetId } = requireTarget(req);
    res.json({ targetType, targetId, score: await voteService.score(targetType, targetId) });
  },
  async mine(req: AuthedRequest, res: Response) {
    const { targetType, targetId } = requireTarget(req);
    res.json({ value: await voteService.myValue(req.userId!, targetType, targetId) });
  },
};
```

- [ ] **Step 7: routes/vote.routes.ts**

```typescript
// vote-service/src/routes/vote.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { voteController } from '../controllers/vote.controller';

export const voteRoutes = Router();
voteRoutes.post('/', requireUser, asyncHandler(voteController.cast));
voteRoutes.get('/score', asyncHandler(voteController.score));
voteRoutes.get('/me', requireUser, asyncHandler(voteController.mine));
```

- [ ] **Step 8:** `app.ts` (service `vote-service`, `attachUser`, mount `/votes`), `index.ts` (no consumers), `env.ts` (port `4006`, db `vote_db`, no jwt), shared files per Task 1. Delete `src/lib/db.ts`, `src/lib/middleware.ts`.

- [ ] **Step 9:** `npx drizzle-kit generate` → `votes` with unique, check, index.

- [ ] **Step 10:** `npm run build` → clean.

- [ ] **Step 11: Smoke** — upvote a post → `{value:1,delta:1}` + event; change to downvote → `{value:-1,delta:-2}`; clear (0) → `{value:0,delta:1}`; `GET /votes/score` reflects sum; `GET /votes/me` returns current.

- [ ] **Step 12: Commit** — `git add vote-service && git commit -m "refactor(vote): Drizzle ORM + layered SOA structure"`

---

## Task 7: notification-service (full refactor)

Same layout. One table (JSONB payload). Consumes `user.created`, `comment.created`, `vote.created`. Publishes `notification.created`.

**Contract:**
- `GET /notifications` (requireUser) → array `{id,type,payload,read,created_at}` (LIMIT 100 DESC).
- `GET /notifications/unread-count` (requireUser) → `{count}`.
- `POST /notifications/:id/read` (requireUser) → `{read:true,id}`; 404 if not found/owned.
- `POST /notifications/read-all` (requireUser) → `{read:true}`.
- Consumers create notifications: `user.created`→welcome; `comment.created` with `replyToUserId!==authorId`→reply; `vote.created` with `value===1 && authorId!==voterId`→upvote. Each publishes `notification.created` `{id,userId,type}`.

- [ ] **Step 1:** package.json deps + install.

- [ ] **Step 2: db/schema.ts**

```typescript
// notification-service/src/db/schema.ts
import { pgTable, uuid, varchar, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    type: varchar('type', { length: 32 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('idx_notifications_user').on(t.userId, t.read) })
);

export type NotificationRow = typeof notifications.$inferSelect;
```

- [ ] **Step 3: repositories/notification.repository.ts**

```typescript
// notification-service/src/repositories/notification.repository.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications } from '../db/schema';

export const notificationRepository = {
  async insert(row: { id: string; userId: string; type: string; payload: object }) {
    await db.insert(notifications).values(row);
  },
  async listForUser(userId: string) {
    return db.select({
      id: notifications.id, type: notifications.type, payload: notifications.payload,
      read: notifications.read, created_at: notifications.createdAt,
    }).from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(100);
  },
  async unreadCount(userId: string): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)::int` }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return rows[0].count;
  },
  async markRead(id: string, userId: string) {
    const rows = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id });
    return rows.length > 0;
  },
  async markAllRead(userId: string) {
    await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  },
};
```

- [ ] **Step 4: services/notification.service.ts**

```typescript
// notification-service/src/services/notification.service.ts
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error';
import { notificationRepository } from '../repositories/notification.repository';
import { publishEvent } from '../lib/broker';
import { logger } from '../lib/logger';

export const notificationService = {
  async create(userId: string, type: string, payload: object) {
    const id = uuidv4();
    await notificationRepository.insert({ id, userId, type, payload });
    publishEvent('notification.created', { id, userId, type });
    logger.info(`Notification '${type}' -> ${userId}`);
  },
  list(userId: string) {
    return notificationRepository.listForUser(userId);
  },
  unreadCount(userId: string) {
    return notificationRepository.unreadCount(userId);
  },
  async markRead(id: string, userId: string) {
    const ok = await notificationRepository.markRead(id, userId);
    if (!ok) throw new AppError(404, 'Notification not found');
    return { read: true, id };
  },
  async markAllRead(userId: string) {
    await notificationRepository.markAllRead(userId);
    return { read: true };
  },
};
```

- [ ] **Step 5: controllers/notification.controller.ts**

```typescript
// notification-service/src/controllers/notification.controller.ts
import { Response } from 'express';
import { AuthedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export const notificationController = {
  async list(req: AuthedRequest, res: Response) {
    res.json(await notificationService.list(req.userId!));
  },
  async unreadCount(req: AuthedRequest, res: Response) {
    res.json({ count: await notificationService.unreadCount(req.userId!) });
  },
  async markRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markRead(req.params.id, req.userId!));
  },
  async markAllRead(req: AuthedRequest, res: Response) {
    res.json(await notificationService.markAllRead(req.userId!));
  },
};
```

- [ ] **Step 6: routes/notification.routes.ts**

```typescript
// notification-service/src/routes/notification.routes.ts
import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { notificationController } from '../controllers/notification.controller';

export const notificationRoutes = Router();
notificationRoutes.get('/', requireUser, asyncHandler(notificationController.list));
notificationRoutes.get('/unread-count', requireUser, asyncHandler(notificationController.unreadCount));
notificationRoutes.post('/:id/read', requireUser, asyncHandler(notificationController.markRead));
notificationRoutes.post('/read-all', requireUser, asyncHandler(notificationController.markAllRead));
```

Note: register `/read-all` BEFORE `/:id/read`? Express matches in order; `/read-all` is a distinct literal path and `/:id/read` requires a second segment `read`, so `/read-all` (single segment) cannot match `/:id/read`. Order above is safe.

- [ ] **Step 7: events/notification.consumer.ts**

```typescript
// notification-service/src/events/notification.consumer.ts
import { consumeEvents } from '../lib/broker';
import { notificationService } from '../services/notification.service';

export async function startConsumers(): Promise<void> {
  await consumeEvents(
    'notification-service.events',
    ['user.created', 'comment.created', 'vote.created'],
    async (key, payload) => {
      if (key === 'user.created') {
        await notificationService.create(payload.id, 'welcome', { message: `Welcome to Reddit Clone, ${payload.username}!` });
      } else if (key === 'comment.created' && payload.replyToUserId && payload.replyToUserId !== payload.authorId) {
        await notificationService.create(payload.replyToUserId, 'reply', {
          postId: payload.postId, commentId: payload.id, from: payload.authorUsername, snippet: payload.snippet,
        });
      } else if (key === 'vote.created' && payload.value === 1 && payload.authorId && payload.authorId !== payload.voterId) {
        await notificationService.create(payload.authorId, 'upvote', { targetType: payload.targetType, targetId: payload.targetId });
      }
    }
  );
}
```

- [ ] **Step 8:** `app.ts` (service `notification-service`, `attachUser`, mount `/notifications`), `index.ts` (with `startConsumers()`), `env.ts` (port `4008`, db `notification_db`, no jwt), shared files per Task 1. Delete `src/lib/db.ts`, `src/lib/middleware.ts`.

- [ ] **Step 9:** `npx drizzle-kit generate` → `notifications` + index.

- [ ] **Step 10:** `npm run build` → clean.

- [ ] **Step 11: Smoke** — register a user → welcome notification appears; reply to someone → reply notification; upvote someone's post → upvote notification; mark read / read-all / unread-count behave correctly.

- [ ] **Step 12: Commit** — `git add notification-service && git commit -m "refactor(notification): Drizzle ORM + layered SOA structure"`

---

## Task 8: feed-service (layering only — Redis, no Drizzle)

**Goal:** apply the same routes → controller → service → repository separation, but the repository talks to Redis (existing `src/lib/redis.ts`). No `db/`, no Drizzle, no migrations.

**Files:** read current `feed-service/src/index.ts` and `src/lib/redis.ts` first to capture exact endpoints and Redis calls.

- [ ] **Step 1: Read current behavior**

Run: `cat feed-service/src/index.ts feed-service/src/lib/redis.ts`
Record every route, its response shape, and every Redis operation. (Not reproduced here because feed-service was not part of the Drizzle inventory; capture the contract the same way the other tasks document it.)

- [ ] **Step 2: middleware/error.ts + middleware/auth.ts** — copy from Task 1 Steps 7 & 8 (service-agnostic).

- [ ] **Step 3: config/env.ts** — port from current index (read in Step 1), Redis URL env, service name `feed-service`. No `db` block.

- [ ] **Step 4: repositories/feed.repository.ts** — move every Redis read/write from `index.ts` into named methods here; this file is the only one importing the Redis client.

- [ ] **Step 5: services/feed.service.ts** — business logic (fan-out, trimming, event reactions) calling the repository; throws `AppError`.

- [ ] **Step 6: controllers/feed.controller.ts** — parse req, call service, respond.

- [ ] **Step 7: routes/feed.routes.ts** — wire the routes captured in Step 1 with `asyncHandler`.

- [ ] **Step 8: events/feed.consumer.ts** — if `index.ts` consumes events (e.g. `post.created`), move that handler here as `startConsumers()`.

- [ ] **Step 9: app.ts** — `buildApp()` with `/health` → `{status:'ok',service:'feed-service'}`, `attachUser` if currently used, mounted routes, `errorHandler`.

- [ ] **Step 10: index.ts** — bootstrap: connect Redis, `initBroker()`, `startConsumers()` (if any), listen. (No `applyMigrations`.)

- [ ] **Step 11:** `npm run build` → clean.

- [ ] **Step 12: Smoke** — `docker compose up -d redis rabbitmq feed-service`; exercise the feed endpoints captured in Step 1; confirm identical responses; create a post and confirm any feed fan-out still happens.

- [ ] **Step 13: Commit** — `git add feed-service && git commit -m "refactor(feed): layered SOA structure (Redis)"`

---

## Task 9: api-gateway (layering only — no DB)

**Goal:** split the gateway's routing/proxy/JWT-verification logic out of `index.ts` into focused modules. No data layer.

**Files:** read `api-gateway/src/index.ts` first to capture the route table, proxy targets, and JWT verification.

- [ ] **Step 1: Read current behavior**

Run: `cat api-gateway/src/index.ts`
Record: each upstream service + its base path, how JWT is verified, how `x-user-id` / `x-username` headers are injected, CORS, rate limiting, and the health route.

- [ ] **Step 2: config/env.ts** — port, JWT secret, and a map of upstream service URLs (from current env usage).

- [ ] **Step 3: config/services.ts** — declarative route table: `[{ prefix: '/auth', target: AUTH_URL, auth: false }, { prefix: '/users', target: USER_URL, auth: true }, ...]` derived from Step 1.

- [ ] **Step 4: middleware/auth.ts** — JWT verification middleware that decodes the token and sets `x-user-id` / `x-username` on the proxied request (exact logic from Step 1).

- [ ] **Step 5: middleware/error.ts** — copy from Task 1 Step 7.

- [ ] **Step 6: routes/gateway.routes.ts** — iterate the `config/services.ts` table, attach the proxy middleware (and `requireAuth` where `auth: true`) per prefix.

- [ ] **Step 7: app.ts** — `buildApp()`: CORS, json (only where needed — keep proxy body handling identical to current), `/health`, mounted gateway routes, `errorHandler`.

- [ ] **Step 8: index.ts** — thin bootstrap: `buildApp()` + listen.

- [ ] **Step 9:** `npm run build` → clean.

- [ ] **Step 10: Smoke** — `docker compose up -d` (full stack); through the gateway: register/login (public), then an authenticated call (e.g. `GET /users/me` with Bearer token) returns the profile; an unauthenticated authed-route call → 401; confirm header injection works end-to-end.

- [ ] **Step 11: Commit** — `git add api-gateway && git commit -m "refactor(gateway): layered routing structure"`

---

## Task 10: docker-compose / Dockerfile alignment + full-stack verification

**Files:** `docker-compose.yml`, each service `Dockerfile`.

- [ ] **Step 1: Confirm migrations run on boot**

Migrations run inside `index.ts` via `applyMigrations()` before `listen`, so no compose change is strictly required. Verify each Drizzle service's `Dockerfile` copies the `drizzle/` folder into the image.

Run: `cat auth-service/Dockerfile`
If it does `COPY . .` before build, `drizzle/` is included. If it copies only `src` and `package*.json`, add: `COPY drizzle ./drizzle`.

- [ ] **Step 2: Apply Dockerfile fix to every Drizzle service if needed**

For each of auth, user, community, post, comment, vote, notification: ensure `drizzle/` is present in the runtime image (the migrator reads `../../drizzle` relative to `dist/db`). Adjust `COPY` lines as needed.

- [ ] **Step 3: Clean rebuild**

```bash
cd "D:\Backend Projects\redit clone nodejs backend"
docker compose down -v
docker compose build
docker compose up -d
```

Expected: all services report healthy; each Drizzle service logs "Migrations applied".

- [ ] **Step 4: End-to-end happy path through the gateway**

1. Register user A and user B (capture tokens).
2. A creates a community → 201; `GET /communities` shows member_count 1.
3. B joins the community → `{joined:true}`.
4. A creates a post → 201.
5. B comments on the post with `replyToUserId = A` → 201; A gets a `reply` notification.
6. B upvotes A's post (`value:1, authorId:A`) → `{value:1,delta:1}`; post `vote_score` becomes 1; A's profile karma +1; A gets an `upvote` notification.
7. B downvotes (`value:-1`) → `{value:-1,delta:-2}`; score -1.
8. `GET /notifications/unread-count` for A > 0; mark read; count drops.

Each step must match the contracts documented in Tasks 1–7.

- [ ] **Step 5: Confirm no raw SQL remains in Drizzle services**

Run: `grep -rn "from './lib/db'" auth-service user-service community-service post-service comment-service vote-service notification-service`
Expected: no matches (file deleted, imports gone).

Run: `grep -rln "lib/db" auth-service user-service community-service post-service comment-service vote-service notification-service`
Expected: no matches.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: docker/migration alignment + full-stack verification for Drizzle SOA refactor"
```

---

## Self-review notes (author)

- **Spec coverage:** every service in the spec's classification table maps to a task (auth=1, user=2, community=3, post=4, comment=5, vote=6, notification=7, feed=8, gateway=9, infra=10). Layering rules, Drizzle integration, drizzle-kit migrations, database-per-service, Joi retention, and behavior preservation are all covered.
- **feed-service & api-gateway** intentionally lack reproduced code because they were not part of the Postgres inventory read during planning; their tasks begin with a mandatory "read current behavior" step so the implementer captures exact contracts before refactoring. This is a deliberate, signposted gap — not a placeholder.
- **Type consistency:** repository/service/controller method names are consistent within each task; `AppError`, `asyncHandler`, `attachUser`, `requireUser`, `AuthedRequest`, `applyMigrations`, `buildApp`, `startConsumers` are used with identical signatures across tasks.
- **Known Drizzle gotchas flagged:** post-service `list()` query-builder reassignment (Step 4 correction), comment-service self-referencing FK needs `AnyPgColumn` return type, notification route ordering, Dockerfile must include `drizzle/`.
```
