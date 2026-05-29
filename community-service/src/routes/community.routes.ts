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
