// api-gateway/src/middleware/auth.ts
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

interface JwtPayload {
  sub: string;
  username: string;
}

export interface AuthedRequest extends Request {
  userId?: string;
  username?: string;
}

// JWT validation: decode if present, attach identity, strip spoofed headers.
// A missing Authorization header is allowed through (downstream services
// enforce auth); only a present-but-invalid Bearer token is rejected with 401.
export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  // Never trust client-supplied identity headers.
  delete req.headers['x-user-id'];
  delete req.headers['x-username'];

  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
      (req as AuthedRequest).userId = payload.sub;
      (req as AuthedRequest).username = payload.username;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }
  next();
}
