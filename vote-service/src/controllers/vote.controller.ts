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
