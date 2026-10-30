import { db } from './index.ts';
import { users, appStateRecords } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(
  uid: string,
  email: string,
  username?: string,
  position?: string
) {
  try {
    const resolvedUsername = username || email.split('@')[0] || 'user';
    const resolvedPosition = position || 'Outlet';

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        username: resolvedUsername,
        position: resolvedPosition,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile with database.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to fetch user profile from database.', { cause: error });
  }
}

export async function updateUserProfileByUid(
  uid: string,
  updates: {
    username?: string;
    email?: string;
    position?: string;
    placement?: string;
    outletName?: string;
    department?: string;
  }
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserProfileByUid:', error);
    throw new Error('Failed to update user profile in database.', { cause: error });
  }
}

export async function getAppStateRecord(stateKey: string) {
  try {
    const rows = await db
      .select()
      .from(appStateRecords)
      .where(eq(appStateRecords.stateKey, stateKey));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getAppStateRecord:', error);
    throw new Error('Failed to load application state from database.', { cause: error });
  }
}

export async function saveAppStateRecord(
  stateKey: string,
  stateJson: string,
  updatedByUid: string,
  userId?: number
) {
  try {
    const result = await db
      .insert(appStateRecords)
      .values({
        stateKey,
        stateJson,
        updatedByUid,
        userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appStateRecords.stateKey,
        set: {
          stateJson,
          updatedByUid,
          userId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in saveAppStateRecord:', error);
    throw new Error('Failed to save application state to database.', { cause: error });
  }
}
