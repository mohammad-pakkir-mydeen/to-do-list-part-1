import { describe, expect, it, beforeEach } from "bun:test";
import { app as api } from "../src/app";
import { db, runMigrations } from "../src/db";
import { projects, sessions, todos, users } from "../src/db/schema";
import { createTestSession, getTestUserId, withSession } from "./helpers";

let sessionCookie = "";
let userId = 0;
const app = {
  handle: (request: Request) =>
    api.handle(withSession(request, sessionCookie)),
};
const handleWithCookie = (request: Request, cookie: string) =>
  api.handle(withSession(request, cookie));

describe("To-Do API", () => {
  beforeEach(async () => {
    runMigrations();
    await db.delete(todos);
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(users);
    sessionCookie = await createTestSession();
    userId = await getTestUserId(sessionCookie);
  });

  describe("POST /todos", () => {
    it("creates a new todo with default completed = false", async () => {
      const response = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Buy groceries" }),
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.title).toBe("Buy groceries");
      expect(data.completed).toBe(false);
      expect(data.createdAt).toBeDefined();
    });

    it("returns 400 when title is missing or empty", async () => {
      const emptyTitleResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "" }),
        })
      );
      expect(emptyTitleResponse.status).toBe(400);

      const noTitleResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(noTitleResponse.status).toBe(400);
    });
  });

  describe("GET /todos", () => {
    it("returns list of todos", async () => {
      await db.insert(todos).values([
        { title: "Task 1", completed: false, userId },
        { title: "Task 2", completed: true, userId },
      ]);

      const response = await app.handle(new Request("http://localhost/todos"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(2);
    });

    it("filters by active todos", async () => {
      await db.insert(todos).values([
        { title: "Active task", completed: false, userId },
        { title: "Done task", completed: true, userId },
      ]);

      const response = await app.handle(
        new Request("http://localhost/todos?filter=active")
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Active task");
      expect(data[0].completed).toBe(false);
    });

    it("filters by completed todos", async () => {
      await db.insert(todos).values([
        { title: "Active task", completed: false, userId },
        { title: "Done task", completed: true, userId },
      ]);

      const response = await app.handle(
        new Request("http://localhost/todos?filter=completed")
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Done task");
      expect(data[0].completed).toBe(true);
    });

    it("returns all todos when filter=all", async () => {
      await db.insert(todos).values([
        { title: "Active task", completed: false, userId },
        { title: "Done task", completed: true, userId },
      ]);

      const response = await app.handle(
        new Request("http://localhost/todos?filter=all")
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(2);
    });
  });

  describe("PATCH /todos/:id", () => {
    it("edits the todo title", async () => {
      const [inserted] = await db
        .insert(todos)
        .values({ title: "Original title", completed: false, userId })
        .returning();

      const response = await app.handle(
        new Request(`http://localhost/todos/${inserted.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated title" }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.title).toBe("Updated title");
      expect(data.completed).toBe(false);
    });

    it("completes and reactivates a todo", async () => {
      const [inserted] = await db
        .insert(todos)
        .values({ title: "Toggle me", completed: false, userId })
        .returning();

      // Complete
      const completeRes = await app.handle(
        new Request(`http://localhost/todos/${inserted.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        })
      );
      expect(completeRes.status).toBe(200);
      const completedData = await completeRes.json();
      expect(completedData.completed).toBe(true);

      // Reactivate
      const reactivateRes = await app.handle(
        new Request(`http://localhost/todos/${inserted.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: false }),
        })
      );
      expect(reactivateRes.status).toBe(200);
      const reactivatedData = await reactivateRes.json();
      expect(reactivatedData.completed).toBe(false);
    });

    it("returns 404 when updating nonexistent todo", async () => {
      const response = await app.handle(
        new Request("http://localhost/todos/9999", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Nonexistent" }),
        })
      );
      expect(response.status).toBe(404);
    });

    it("returns 400 when title is empty string", async () => {
      const [inserted] = await db
        .insert(todos)
        .values({ title: "Valid title", completed: false, userId })
        .returning();

      const response = await app.handle(
        new Request(`http://localhost/todos/${inserted.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "" }),
        })
      );
      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /todos/:id", () => {
    it("deletes a todo by id", async () => {
      const [inserted] = await db
        .insert(todos)
        .values({ title: "To be deleted", completed: false, userId })
        .returning();

      const response = await app.handle(
        new Request(`http://localhost/todos/${inserted.id}`, {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify deletion from db
      const remaining = await db.select().from(todos);
      expect(remaining.length).toBe(0);
    });

    it("returns 404 when deleting nonexistent todo", async () => {
      const response = await app.handle(
        new Request("http://localhost/todos/9999", {
          method: "DELETE",
        })
      );
      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /todos/completed (clear completed)", () => {
    it("deletes all completed todos and preserves active ones", async () => {
      await db.insert(todos).values([
        { title: "Active 1", completed: false, userId },
        { title: "Done 1", completed: true, userId },
        { title: "Done 2", completed: true, userId },
      ]);

      const response = await app.handle(
        new Request("http://localhost/todos/completed", {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deletedCount).toBe(2);

      const remaining = await db.select().from(todos);
      expect(remaining.length).toBe(1);
      expect(remaining[0].title).toBe("Active 1");
    });
  });

  describe("personal and shared visibility", () => {
    it("keeps todos in personal projects private even when sharing is requested", async () => {
      const projectResponse = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Personal project" }),
        })
      );
      const project = await projectResponse.json();
      const todoResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Private project task",
            projectId: project.id,
            isShared: true,
          }),
        })
      );
      const todo = await todoResponse.json();
      expect(todoResponse.status).toBe(201);
      expect(todo.isShared).toBe(false);

      const otherCookie = await createTestSession();
      const otherList = await handleWithCookie(
        new Request("http://localhost/todos"),
        otherCookie
      );
      expect(await otherList.json()).toEqual([]);

      const otherUpdate = await handleWithCookie(
        new Request(`http://localhost/todos/${todo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Should be hidden" }),
        }),
        otherCookie
      );
      expect(otherUpdate.status).toBe(404);

      const otherDelete = await handleWithCookie(
        new Request(`http://localhost/todos/${todo.id}`, {
          method: "DELETE",
        }),
        otherCookie
      );
      expect(otherDelete.status).toBe(404);
    });

    it("makes an existing shared todo personal when it is moved to a personal project", async () => {
      const projectResponse = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Personal project" }),
        })
      );
      const project = await projectResponse.json();
      const todoResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Shared task", isShared: true }),
        })
      );
      const todo = await todoResponse.json();

      const updateResponse = await app.handle(
        new Request(`http://localhost/todos/${todo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, isShared: true }),
        })
      );
      expect(updateResponse.status).toBe(200);
      expect((await updateResponse.json()).isShared).toBe(false);
    });

    it("shows a shared inbox todo to another signed-in user", async () => {
      const createResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Shared task", isShared: true }),
        })
      );
      expect(createResponse.status).toBe(201);

      const otherCookie = await createTestSession();
      const otherList = await handleWithCookie(
        new Request("http://localhost/todos"),
        otherCookie
      );
      expect(await otherList.json()).toMatchObject([
        { title: "Shared task", isShared: true },
      ]);
    });
  });
});
