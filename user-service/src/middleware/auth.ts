// user-service/src/middleware/auth.ts
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
