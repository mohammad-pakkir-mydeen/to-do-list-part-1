import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db, runMigrations } from "../src/db";
import { projects, sessions, todos, users } from "../src/db/schema";

const password = "correct-horse-battery";
const signup = (body: Record<string, unknown>) =>
  app.handle(
    new Request("http://localhost/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
const login = (body: Record<string, unknown>) =>
  app.handle(
    new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("Authentication API", () => {
  let email: string;

  beforeEach(async () => {
    runMigrations();
    await db.delete(todos);
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(users);
    email = `${randomUUID()}@example.test`;
  });

  describe("POST /auth/signup", () => {
    it("creates an account without signing the user in or exposing a password hash", async () => {
      const response = await signup({ name: "Avery Lee", email, password });
      expect(response.status).toBe(201);
      expect(response.headers.get("Set-Cookie")).toBeNull();

      const body = await response.json();
      expect(body.user).toEqual({
        id: expect.any(Number),
        name: "Avery Lee",
        email,
      });
      expect(JSON.stringify(body)).not.toContain("passwordHash");

      const savedUser = await db.select().from(users).get();
      expect(savedUser?.passwordHash).not.toBe(password);
      expect(await Bun.password.verify(password, savedUser!.passwordHash)).toBe(true);
      expect(await db.select().from(sessions)).toHaveLength(0);
    });

    it("normalizes email addresses before enforcing uniqueness", async () => {
      expect((await signup({ name: "Avery", email: `  ${email.toUpperCase()}  `, password })).status)
        .toBe(201);
      expect((await signup({ name: "Avery", email: email.toUpperCase(), password })).status)
        .toBe(400);
    });

    it("rejects missing fields, invalid email, and short passwords", async () => {
      expect((await signup({ email, password })).status).toBe(400);
      expect((await signup({ name: "Avery", email: "not-an-email", password })).status)
        .toBe(400);
      expect((await signup({ name: "Avery", email, password: "short" })).status)
        .toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await signup({ name: "Avery Lee", email, password });
    });

    it("signs in with email and sets a secure server-side session cookie", async () => {
      const response = await login({ email: email.toUpperCase(), password });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        user: {
          id: expect.any(Number),
          name: "Avery Lee",
          email,
        },
      });

      const cookie = response.headers.get("Set-Cookie");
      expect(cookie).toContain("session=");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("Max-Age=");
      expect(cookie).not.toContain(password);
      expect(await db.select().from(sessions)).toHaveLength(1);
    });

    it("uses a uniform error and creates no session for invalid credentials", async () => {
      const wrongPassword = await login({ email, password: "incorrect-password" });
      const missingUser = await login({
        email: "missing@example.test",
        password: "incorrect-password",
      });
      expect(wrongPassword.status).toBe(401);
      expect(missingUser.status).toBe(401);
      expect(await wrongPassword.json()).toEqual(await missingUser.json());
      expect(await db.select().from(sessions)).toHaveLength(0);
    });

    it("rejects malformed and missing login fields", async () => {
      expect((await login({ email: "bad-email", password })).status).toBe(400);
      expect((await login({ email })).status).toBe(400);
      expect((await login({ email, password: "" })).status).toBe(400);
    });
  });

  describe("Cookie sessions and sign-out", () => {
    async function signIn() {
      await signup({ name: "Avery Lee", email, password });
      const response = await login({ email, password });
      return response.headers.get("Set-Cookie")!.split(";")[0];
    }

    it("restores the public user on refresh and rejects missing or invalid sessions", async () => {
      const cookie = await signIn();
      const me = await app.handle(
        new Request("http://localhost/auth/me", { headers: { Cookie: cookie } })
      );
      expect(me.status).toBe(200);
      expect((await me.json()).user.email).toBe(email);

      const refreshed = await app.handle(
        new Request("http://localhost/auth/me", { headers: { Cookie: cookie } })
      );
      expect(refreshed.status).toBe(200);
      expect(
        (await app.handle(new Request("http://localhost/auth/me"))).status
      ).toBe(401);
      expect(
        (
          await app.handle(
            new Request("http://localhost/auth/me", {
              headers: { Cookie: "session=not-a-valid-session" },
            })
          )
        ).status
      ).toBe(401);
    });

    it("rejects expired sessions", async () => {
      const cookie = await signIn();
      const sessionId = cookie.slice("session=".length);
      await db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        .where(eq(sessions.id, sessionId));

      const response = await app.handle(
        new Request("http://localhost/auth/me", { headers: { Cookie: cookie } })
      );
      expect(response.status).toBe(401);
      expect(await db.select().from(sessions)).toHaveLength(0);
    });

    it("invalidates and clears a session on repeated sign-out", async () => {
      const cookie = await signIn();
      const logout = () =>
        app.handle(
          new Request("http://localhost/auth/logout", {
            method: "POST",
            headers: { Cookie: cookie },
          })
        );

      const response = await logout();
      expect(response.status).toBe(200);
      expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
      expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
      expect((await logout()).status).toBe(200);
      expect(
        (
          await app.handle(
            new Request("http://localhost/auth/me", { headers: { Cookie: cookie } })
          )
        ).status
      ).toBe(401);
    });
  });

  it("requires authentication for shared project and todo APIs and records creators", async () => {
    expect((await app.handle(new Request("http://localhost/todos"))).status).toBe(401);
    expect((await app.handle(new Request("http://localhost/projects"))).status).toBe(401);

    const signupResponse = await signup({ name: "Avery Lee", email, password });
    const firstUser = (await signupResponse.json()).user;
    const cookie = (await login({ email, password }))
      .headers.get("Set-Cookie")!
      .split(";")[0];
    const createdProject = await app.handle(
      new Request("http://localhost/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ name: "Shared project", isShared: true }),
      })
    );
    expect(createdProject.status).toBe(201);
    const projectData = await createdProject.json();
    expect(projectData.creator.name).toBe("Avery Lee");
    expect(projectData.userId).toBe(firstUser.id);

    const createdTodo = await app.handle(
      new Request("http://localhost/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          title: "Shared task",
          userId: 999999,
          isShared: true,
        }),
      })
    );
    expect(createdTodo.status).toBe(201);
    const todoData = await createdTodo.json();
    expect(todoData.creator.email).toBe(email);
    expect(todoData.userId).toBe(firstUser.id);

    const secondEmail = `${randomUUID()}@example.test`;
    await signup({ name: "Morgan Reed", email: secondEmail, password });
    const secondCookie = (await login({ email: secondEmail, password }))
      .headers.get("Set-Cookie")!
      .split(";")[0];
    const sharedTodos = await app.handle(
      new Request("http://localhost/todos", {
        headers: { Cookie: secondCookie },
      })
    );
    const sharedProjects = await app.handle(
      new Request("http://localhost/projects", {
        headers: { Cookie: secondCookie },
      })
    );
    expect((await sharedTodos.json())[0].creator.name).toBe("Avery Lee");
    expect((await sharedProjects.json())[0].creator.email).toBe(email);
  });

  it("rejects state-changing requests from untrusted origins", async () => {
    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify({ name: "Avery", email, password }),
      })
    );
    expect(response.status).toBe(403);
  });
});
