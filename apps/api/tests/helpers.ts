import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db";
import { sessions } from "../src/db/schema";

export async function createTestSession() {
  const email = `${randomUUID()}@example.test`;
  const password = "test-password-123";
  const signupResponse = await app.handle(
    new Request("http://localhost/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test User", email, password }),
    })
  );
  if (signupResponse.status !== 201) {
    throw new Error("Unable to create test account");
  }

  const loginResponse = await app.handle(
    new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  );
  const cookie = loginResponse.headers.get("Set-Cookie")?.split(";")[0];
  if (loginResponse.status !== 200 || !cookie) {
    throw new Error("Unable to create test session");
  }
  return cookie;
}

export function withSession(request: Request, cookie: string) {
  const headers = new Headers(request.headers);
  headers.set("Cookie", cookie);
  return new Request(request, { headers });
}

export async function getTestUserId(cookie: string) {
  const sessionId = cookie.slice("session=".length);
  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Test session does not exist");
  return session.userId;
}
