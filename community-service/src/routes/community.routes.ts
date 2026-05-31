// community-service/src/routes/community.routes.ts
import { Router } from 'express';
import { requireUser } from '../middleware/auth';
import { communityController } from '../controllers/community.controller';

export const communityRoutes = Router();
communityRoutes.post('/', requireUser, communityController.Create);
communityRoutes.get('/', communityController.List);
communityRoutes.get('/:id', communityController.GetById);
communityRoutes.post('/:id/join', requireUser, communityController.Join);
communityRoutes.delete('/:id/leave', requireUser, communityController.Leave);
