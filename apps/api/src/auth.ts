import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "./db";
import { sessions, users } from "./db/schema";

export const authContext = new Elysia({ name: "authContext" }).derive(
  { as: "global" },
  async ({ cookie: { session } }) => {
    const sessionId = session.value;
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      return { user: null };
    }

    const currentSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!currentSession) {
      return { user: null };
    }

    const expiresAt = Date.parse(currentSession.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await db.delete(sessions).where(eq(sessions.id, currentSession.id));
      return { user: null };
    }

    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, currentSession.userId))
      .get();

    if (!user?.name || !user.email) {
      return { user: null };
    }

    return { user: { id: user.id, name: user.name, email: user.email } };
  }
);
