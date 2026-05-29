// auth-service/src/validation/auth.schema.ts
import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});
