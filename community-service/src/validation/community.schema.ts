// community-service/src/validation/community.schema.ts
import Joi from 'joi';
export const createCommunitySchema = Joi.object({
  name: Joi.string().pattern(/^[A-Za-z0-9_]{3,32}$/).required(),
  description: Joi.string().max(500).allow('').default(''),
});
