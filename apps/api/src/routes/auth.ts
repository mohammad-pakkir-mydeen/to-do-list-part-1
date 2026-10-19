import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db";
import { users, sessions } from "../db/schema";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post(
    "/register",
    async ({ body, set }) => {
      const username = body.username.trim();
      const password = body.password.trim();

      // Check unique
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (existing) {
        set.status = 409;
        return { error: "Conflict", message: "Username already exists" };
      }

      // Hash password using Bun.password.hash (bcrypt)
      const passwordHash = await Bun.password.hash(password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          passwordHash,
        })
        .returning();

      set.status = 201;
      return {
        id: newUser.id,
        username: newUser.username,
        createdAt: newUser.createdAt,
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 6 }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, cookie: { session }, set }) => {
      const username = body.username.trim();
      const password = body.password.trim();

      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .get();

      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Invalid credentials" };
      }

      const isMatch = await Bun.password.verify(password, user.passwordHash);
      if (!isMatch) {
        set.status = 401;
        return { error: "Unauthorized", message: "Invalid credentials" };
      }

      // Create session (valid for 7 days)
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        expiresAt,
      });

      // Set HttpOnly cookie
      session.set({
        value: sessionId,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        user: {
          id: user.id,
          username: user.username,
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
    }
  )
  .post("/logout", async ({ cookie: { session } }) => {
    if (session.value) {
      await db.delete(sessions).where(eq(sessions.id as any, session.value));
      session.remove();
    }
    return { success: true };
  })
  .get("/me", async ({ cookie: { session }, set }) => {
    if (!session.value) {
      set.status = 401;
      return { error: "Unauthorized", message: "Not signed in" };
    }

    const currentSession = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id as any, session.value))
      .get();

    if (!currentSession || new Date(currentSession.expiresAt) < new Date()) {
      set.status = 401;
      return { error: "Unauthorized", message: "Session expired or invalid" };
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, currentSession.userId))
      .get();

    if (!user) {
      set.status = 401;
      return { error: "Unauthorized", message: "User not found" };
    }

    return {
      user: {
        id: user.id,
        username: user.username,
      },
    };
  });

