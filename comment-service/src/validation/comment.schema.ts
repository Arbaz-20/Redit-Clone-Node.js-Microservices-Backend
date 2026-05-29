// comment-service/src/validation/comment.schema.ts
import Joi from 'joi';
export const createCommentSchema = Joi.object({
  postId: Joi.string().uuid().required(),
  parentId: Joi.string().uuid().allow(null).default(null),
  body: Joi.string().min(1).max(10000).required(),
  replyToUserId: Joi.string().uuid().allow(null).default(null),
});
