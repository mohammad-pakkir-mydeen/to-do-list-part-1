import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authContext } from "../auth";
import { db } from "../db";
import { sessions, users } from "../db/schema";

const sessionDurationSeconds = 7 * 24 * 60 * 60;
const isProduction = process.env.NODE_ENV === "production";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value: string) => {
  const email = value.trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
};

type PublicUser = { id: number; name: string; email: string };

function hasPublicProfile(
  user: { id: number; name: string | null; email: string | null } | undefined
): user is PublicUser {
  return Boolean(user?.name && user.email);
}

const publicUser = (user: PublicUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(authContext)
  .post(
    "/signup",
    async ({ body, set }) => {
      const name = body.name.trim();
      const email = normalizeEmail(body.email);

      if (name.length === 0 || !email) {
        set.status = 400;
        return { error: "Validation Error", message: "Name and valid email are required" };
      }

      const passwordHash = await Bun.password.hash(body.password);
      const [createdUser] = await db
        .insert(users)
        .values({ username: email, name, email, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
        });

      if (!hasPublicProfile(createdUser)) {
        set.status = 400;
        return { error: "Validation Error", message: "An account with this email already exists" };
      }

      set.status = 201;
      return { user: publicUser(createdUser) };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        email: t.String({ minLength: 1, maxLength: 254 }),
        password: t.String({ minLength: 8, maxLength: 1024 }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, cookie: { session }, set }) => {
      const email = normalizeEmail(body.email);
      if (!email) {
        set.status = 400;
        return { error: "Validation Error", message: "A valid email is required" };
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();

      if (
        !hasPublicProfile(user) ||
        !(await Bun.password.verify(body.password, user.passwordHash))
      ) {
        set.status = 401;
        return { error: "Unauthorized", message: "Invalid email or password" };
      }

      const sessionId = randomUUID();
      const expiresAt = new Date(
        Date.now() + sessionDurationSeconds * 1000
      ).toISOString();

      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        expiresAt,
      });

      session.set({
        value: sessionId,
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        path: "/",
        maxAge: sessionDurationSeconds,
      });

      return { user: publicUser(user) };
    },
    {
      body: t.Object({
        email: t.String({ minLength: 1, maxLength: 254 }),
        password: t.String({ minLength: 1, maxLength: 1024 }),
      }),
    }
  )
  .post("/logout", async ({ cookie: { session } }) => {
    if (typeof session.value === "string" && session.value.length > 0) {
      await db.delete(sessions).where(eq(sessions.id, session.value));
    }
    session.set({
      value: "",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
    });
    return { success: true };
  })
  .get("/me", ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized", message: "Not signed in" };
    }

    return { user: publicUser(user) };
  });
