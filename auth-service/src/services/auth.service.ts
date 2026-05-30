// auth-service/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { AppError } from '../middleware/error';
import { userRepository } from '../repositories/user.repository';
import { publishEvent } from '../lib/broker';

interface JwtPayload {
  sub: string;
  username: string;
  type?: string;
}

export class AuthService {
  private issueTokens(id: string, username: string) {
    const accessToken = jwt.sign({ sub: id, username }, env.jwtSecret, { expiresIn: env.accessTtl } as jwt.SignOptions);
    const refreshToken = jwt.sign({ sub: id, username, type: 'refresh' }, env.jwtSecret, { expiresIn: env.refreshTtl } as jwt.SignOptions);
    return { accessToken, refreshToken };
  }

  public async register(input: { username: string; email: string; password: string }) {
    const existing = await userRepository.findByUsernameOrEmail(input.username, input.email);
    if (existing.length) throw new AppError(409, 'Username or email already in use');

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(input.password, 10);
    await userRepository.insert({ id, username: input.username, email: input.email, passwordHash });

    publishEvent('user.created', { id, username: input.username, email: input.email, createdAt: new Date().toISOString() });

    return { user: { id, username: input.username, email: input.email }, ...this.issueTokens(id, input.username) };
  }

  public async login(input: { identifier: string; password: string }) {
    const user = await userRepository.findByIdentifier(input.identifier);
    if (!user) throw new AppError(401, 'Invalid credentials');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new AppError(401, 'Invalid credentials');
    return { user: { id: user.id, username: user.username, email: user.email }, ...this.issueTokens(user.id, user.username) };
  }

  public refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, env.jwtSecret) as JwtPayload;
      if (payload.type !== 'refresh') throw new AppError(401, 'Not a refresh token');
      const accessToken = jwt.sign({ sub: payload.sub, username: payload.username }, env.jwtSecret, { expiresIn: env.accessTtl } as jwt.SignOptions);
      return { accessToken };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(401, 'Invalid or expired refresh token');
    }
  }
}

export const authService = new AuthService();
