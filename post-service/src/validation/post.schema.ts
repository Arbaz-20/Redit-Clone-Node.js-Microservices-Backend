// post-service/src/validation/post.schema.ts
import Joi from 'joi';
export const createPostSchema = Joi.object({
  communityId: Joi.string().uuid().required(),
  title: Joi.string().min(1).max(300).required(),
  body: Joi.string().max(10000).allow('').default(''),
});
