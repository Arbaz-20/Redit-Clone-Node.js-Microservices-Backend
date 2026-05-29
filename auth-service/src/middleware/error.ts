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
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  logger.error(`Unhandled error: ${(err as Error).message}`);
  return res.status(500).json({ error: 'Internal server error' });
}
