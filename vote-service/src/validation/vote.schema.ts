// vote-service/src/validation/vote.schema.ts
import Joi from 'joi';
export const voteSchema = Joi.object({
  targetType: Joi.string().valid('post', 'comment').required(),
  targetId: Joi.string().uuid().required(),
  value: Joi.number().valid(-1, 0, 1).required(),
  authorId: Joi.string().uuid().allow(null).default(null),
});
