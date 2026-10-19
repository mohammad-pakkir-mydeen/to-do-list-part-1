import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../src/app";
import { db, runMigrations } from "../src/db";
import { todos } from "../src/db/schema";

describe("To-Do API", () => {
  beforeEach(async () => {
    runMigrations();
    await db.delete(todos);
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
        { title: "Task 1", completed: false },
        { title: "Task 2", completed: true },
      ]);

      const response = await app.handle(new Request("http://localhost/todos"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(2);
    });

    it("filters by active todos", async () => {
      await db.insert(todos).values([
        { title: "Active task", completed: false },
        { title: "Done task", completed: true },
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
        { title: "Active task", completed: false },
        { title: "Done task", completed: true },
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
        { title: "Active task", completed: false },
        { title: "Done task", completed: true },
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
        .values({ title: "Original title", completed: false })
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
        .values({ title: "Toggle me", completed: false })
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
        .values({ title: "Valid title", completed: false })
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
        .values({ title: "To be deleted", completed: false })
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
        { title: "Active 1", completed: false },
        { title: "Done 1", completed: true },
        { title: "Done 2", completed: true },
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
});
