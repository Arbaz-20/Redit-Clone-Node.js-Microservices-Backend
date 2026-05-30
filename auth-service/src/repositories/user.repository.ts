// auth-service/src/repositories/user.repository.ts
import { eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type NewUser, type UserRow } from '../db/schema';

export class UserRepository {
  public async findByUsernameOrEmail(username: string, email: string): Promise<UserRow[]> {
    return db.select().from(users).where(or(eq(users.username, username), eq(users.email, email)));
  }

  public async findByIdentifier(identifier: string): Promise<UserRow | undefined> {
    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);
    return rows[0];
  }

  public async insert(user: NewUser): Promise<void> {
    await db.insert(users).values(user);
  }
}

export const userRepository = new UserRepository();
