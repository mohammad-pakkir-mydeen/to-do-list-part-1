import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../src/app";
import { db, runMigrations } from "../src/db";
import { users, sessions, projects, todos } from "../src/db/schema";

describe("Users & Authentication API", () => {
  beforeEach(async () => {
    runMigrations();
    await db.delete(todos);
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(users);
  });

  describe("POST /auth/register", () => {
    it("registers a new user with hashed password", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "alice", password: "password123" }),
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.username).toBe("alice");
      expect(data.passwordHash).toBeUndefined(); // Must never return password

      // Check DB: password must be hashed, not plaintext
      const [saved] = await db.select().from(users);
      expect(saved.username).toBe("alice");
      expect(saved.passwordHash).not.toBe("password123");
    });

    it("returns 400 when username or password is too short", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "", password: "123" }),
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 when username already exists", async () => {
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "bob", password: "password123" }),
        })
      );

      const duplicateRes = await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "bob", password: "otherpassword" }),
        })
      );
      expect(duplicateRes.status).toBe(409);
    });
  });

  describe("POST /auth/login and sessions", () => {
    beforeEach(async () => {
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "charlie", password: "mypassword" }),
        })
      );
    });

    it("logs in with valid credentials and sets session cookie", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "charlie", password: "mypassword" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.username).toBe("charlie");

      // Verify Set-Cookie header exists and has HttpOnly
      const cookieHeader = response.headers.get("Set-Cookie");
      expect(cookieHeader).not.toBeNull();
      expect(cookieHeader).toContain("session=");
      expect(cookieHeader).toContain("HttpOnly");
    });

    it("returns 401 for incorrect password", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "charlie", password: "wrongpassword" }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("returns 401 for nonexistent user", async () => {
      const response = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "nonexistent", password: "password" }),
        })
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/me and POST /auth/logout", () => {
    it("returns current user when session cookie is provided, and 401 after logout", async () => {
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "dave", password: "password123" }),
        })
      );

      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "dave", password: "password123" }),
        })
      );

      const cookie = loginRes.headers.get("Set-Cookie")!.split(";")[0];

      // GET /auth/me with session cookie
      const meRes = await app.handle(
        new Request("http://localhost/auth/me", {
          headers: { Cookie: cookie },
        })
      );
      expect(meRes.status).toBe(200);
      const meData = await meRes.json();
      expect(meData.user.username).toBe("dave");

      // Logout
      const logoutRes = await app.handle(
        new Request("http://localhost/auth/logout", {
          method: "POST",
          headers: { Cookie: cookie },
        })
      );
      expect(logoutRes.status).toBe(200);

      // GET /auth/me after logout should now fail with 401
      const meAfterLogout = await app.handle(
        new Request("http://localhost/auth/me", {
          headers: { Cookie: cookie },
        })
      );
      expect(meAfterLogout.status).toBe(401);
    });

    it("returns 401 when GET /auth/me is called without session", async () => {
      const res = await app.handle(new Request("http://localhost/auth/me"));
      expect(res.status).toBe(401);
    });
  });

  describe("Creator attribution for to-dos and projects", () => {
    it("attributes created to-dos and projects to the logged-in user", async () => {
      await app.handle(
        new Request("http://localhost/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "eve", password: "password123" }),
        })
      );

      const loginRes = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "eve", password: "password123" }),
        })
      );

      const cookie = loginRes.headers.get("Set-Cookie")!.split(";")[0];

      // Create project with session
      const projRes = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ name: "Eve Project" }),
        })
      );
      expect(projRes.status).toBe(201);
      const projData = await projRes.json();
      expect(projData.creator).toBeDefined();
      expect(projData.creator.username).toBe("eve");

      // Create todo with session
      const todoRes = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ title: "Eve Task", projectId: projData.id }),
        })
      );
      expect(todoRes.status).toBe(201);
      const todoData = await todoRes.json();
      expect(todoData.creator).toBeDefined();
      expect(todoData.creator.username).toBe("eve");

      // Listing todos should include creator attribution
      const listTodosRes = await app.handle(
        new Request("http://localhost/todos", {
          headers: { Cookie: cookie },
        })
      );
      const todosList = await listTodosRes.json();
      expect(todosList[0].creator.username).toBe("eve");
    });
  });
});

