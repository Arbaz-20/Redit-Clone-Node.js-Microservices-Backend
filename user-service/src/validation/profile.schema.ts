// user-service/src/validation/profile.schema.ts
import Joi from 'joi';
export const updateProfileSchema = Joi.object({ bio: Joi.string().max(500).allow('').required() });
