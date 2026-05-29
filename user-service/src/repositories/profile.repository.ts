// user-service/src/repositories/profile.repository.ts
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles, type ProfileRow } from '../db/schema';

export const profileRepository = {
  async findById(id: string): Promise<ProfileRow | undefined> {
    const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return rows[0];
  },

  async updateBio(id: string, bio: string): Promise<ProfileRow | undefined> {
    const rows = await db.update(profiles).set({ bio }).where(eq(profiles.id, id)).returning();
    return rows[0];
  },

  async upsertFromUserCreated(id: string, username: string): Promise<void> {
    await db.insert(profiles).values({ id, username }).onConflictDoNothing({ target: profiles.id });
  },

  async addKarma(id: string, delta: number): Promise<void> {
    await db.update(profiles).set({ karma: sql`${profiles.karma} + ${delta}` }).where(eq(profiles.id, id));
  },
};
