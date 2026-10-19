import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { sessions, users } from "./db/schema";

export const authContext = new Elysia({ name: "authContext" })
  .derive({ as: "global" }, async ({ cookie: { session }, headers }) => {
    let sessionToken = session?.value;
    if (!sessionToken && headers.cookie) {
      const match = headers.cookie.match(/session=([^;]+)/);
      if (match) {
        sessionToken = match[1];
      }
    }

    if (!sessionToken) {
      return { user: null };
    }

    const currentSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id as any, sessionToken))
      .get();

    if (!currentSession || new Date(currentSession.expiresAt) < new Date()) {
      return { user: null };
    }

    const user = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, currentSession.userId))
      .get();

    return { user: user || null };
  });

