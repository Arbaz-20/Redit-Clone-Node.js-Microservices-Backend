// community-service/src/controllers/community.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthedRequest } from '../middleware/auth';
import { createCommunitySchema } from '../validation/community.schema';
import { communityService } from '../services/community.service';

export class CommunityController {
  public Create = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const { error, value } = createCommunitySchema.validate(req.body);

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: error.details[0].message });
      } else {
        const result = await communityService.create(userId, value);
        res.status(StatusCodes.CREATED).json(result);
      }
    } catch (error: any) {
      console.error('Error in Create:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public List = async (_req: Request, res: Response) => {
    try {
      const result = await communityService.list();
      res.status(StatusCodes.OK).json(result);
    } catch (error: any) {
      console.error('Error in List:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public GetById = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;

      if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await communityService.getById(id);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in GetById:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Join = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const id = req.params.id;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await communityService.join(id, userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Join:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };

  public Leave = async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.userId;
      const id = req.params.id;

      if (!userId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'userId is required' });
      } else if (!id) {
        res.status(StatusCodes.BAD_REQUEST).json({ error: 'id is required' });
      } else {
        const result = await communityService.leave(id, userId);
        res.status(StatusCodes.OK).json(result);
      }
    } catch (error: any) {
      console.error('Error in Leave:', error);
      res.status(error.status || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  };
}

export const communityController = new CommunityController();
