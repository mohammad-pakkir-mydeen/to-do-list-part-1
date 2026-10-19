import { describe, expect, it, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
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

  describe("todo comments", () => {
    it("allows visible users to comment but only authors to edit or delete", async () => {
      const todoResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Shared task", isShared: true }),
        })
      );
      const todo = await todoResponse.json();
      const otherCookie = await createTestSession();
      const createResponse = await handleWithCookie(
        new Request(`http://localhost/todos/${todo.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: "A useful note" }),
        }),
        otherCookie
      );
      expect(createResponse.status).toBe(201);
      const comment = await createResponse.json();

      const visibleComments = await app.handle(
        new Request(`http://localhost/todos/${todo.id}/comments`)
      );
      expect(await visibleComments.json()).toMatchObject([
        { id: comment.id, body: "A useful note" },
      ]);

      const forbiddenEdit = await app.handle(
        new Request(
          `http://localhost/todos/${todo.id}/comments/${comment.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: "Changed by someone else" }),
          }
        )
      );
      expect(forbiddenEdit.status).toBe(404);

      const forbiddenDelete = await app.handle(
        new Request(
          `http://localhost/todos/${todo.id}/comments/${comment.id}`,
          { method: "DELETE" }
        )
      );
      expect(forbiddenDelete.status).toBe(404);

      const authorEdit = await handleWithCookie(
        new Request(
          `http://localhost/todos/${todo.id}/comments/${comment.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: "Edited by author" }),
          }
        ),
        otherCookie
      );
      expect(authorEdit.status).toBe(200);
      expect((await authorEdit.json()).body).toBe("Edited by author");

      const authorDelete = await handleWithCookie(
        new Request(
          `http://localhost/todos/${todo.id}/comments/${comment.id}`,
          { method: "DELETE" }
        ),
        otherCookie
      );
      expect(authorDelete.status).toBe(200);
    });

    it("hides comments endpoints when the todo is not visible", async () => {
      const todoResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Personal task" }),
        })
      );
      const todo = await todoResponse.json();
      const otherCookie = await createTestSession();

      const response = await handleWithCookie(
        new Request(`http://localhost/todos/${todo.id}/comments`),
        otherCookie
      );
      expect(response.status).toBe(404);
    });
  });

  describe("subtasks", () => {
    it("returns one level of subtasks and enforces visibility inherited from the parent", async () => {
      const parentResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Parent task", isShared: true }),
        })
      );
      const parent = await parentResponse.json();
      const childResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Subtask",
            parentTodoId: parent.id,
          }),
        })
      );
      expect(childResponse.status).toBe(201);
      const child = await childResponse.json();
      expect(child.parentTodoId).toBe(parent.id);
      expect(child.isShared).toBe(true);

      const listResponse = await app.handle(new Request("http://localhost/todos"));
      expect(await listResponse.json()).toMatchObject([
        { id: parent.id, subtasks: [{ id: child.id, title: "Subtask" }] },
      ]);

      const nestedResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Too deep",
            parentTodoId: child.id,
          }),
        })
      );
      expect(nestedResponse.status).toBe(404);

      const otherCookie = await createTestSession();
      const otherList = await handleWithCookie(
        new Request("http://localhost/todos"),
        otherCookie
      );
      expect(await otherList.json()).toMatchObject([
        { id: parent.id, subtasks: [{ id: child.id }] },
      ]);
    });

    it("completes subtasks only when explicitly requested with the parent", async () => {
      const parentResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Parent task" }),
        })
      );
      const parent = await parentResponse.json();
      const childResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Subtask",
            parentTodoId: parent.id,
          }),
        })
      );
      const child = await childResponse.json();

      const completeResponse = await app.handle(
        new Request(`http://localhost/todos/${parent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true, completeSubtasks: true }),
        })
      );
      expect(completeResponse.status).toBe(200);
      const [storedChild] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, child.id));
      expect(storedChild.completed).toBe(true);
    });

    it("deletes a parent's subtasks with the parent", async () => {
      const parentResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Parent task" }),
        })
      );
      const parent = await parentResponse.json();
      const childResponse = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Subtask",
            parentTodoId: parent.id,
          }),
        })
      );
      const child = await childResponse.json();

      const deleteResponse = await app.handle(
        new Request(`http://localhost/todos/${parent.id}`, {
          method: "DELETE",
        })
      );
      expect(deleteResponse.status).toBe(200);
      const remaining = await db.select().from(todos);
      expect(remaining.some((todo) => todo.id === child.id)).toBe(false);
    });
  });
});
