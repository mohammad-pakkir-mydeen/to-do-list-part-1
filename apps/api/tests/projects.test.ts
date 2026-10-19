import { describe, expect, it, beforeEach } from "bun:test";
import { app } from "../src/app";
import { db, runMigrations } from "../src/db";
import { projects, todos } from "../src/db/schema";

describe("Projects API", () => {
  beforeEach(async () => {
    runMigrations();
    await db.delete(todos);
    await db.delete(projects);
  });

  describe("POST /projects", () => {
    it("creates a new project", async () => {
      const response = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Work" }),
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe("Work");
      expect(data.createdAt).toBeDefined();
    });

    it("returns 400 when project name is empty or missing", async () => {
      const emptyRes = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "" }),
        })
      );
      expect(emptyRes.status).toBe(400);

      const missingRes = await app.handle(
        new Request("http://localhost/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(missingRes.status).toBe(400);
    });
  });

  describe("GET /projects", () => {
    it("returns list of projects", async () => {
      await db.insert(projects).values([
        { name: "Personal" },
        { name: "Work" },
      ]);

      const response = await app.handle(new Request("http://localhost/projects"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.length).toBe(2);
    });
  });

  describe("DELETE /projects/:id (Deletion behavior)", () => {
    it("moves todos to Inbox when deleteTodos=false (move_to_inbox)", async () => {
      const [project] = await db
        .insert(projects)
        .values({ name: "To delete" })
        .returning();

      const [todo1] = await db
        .insert(todos)
        .values({ title: "Task 1", projectId: project.id })
        .returning();

      const [todo2] = await db
        .insert(todos)
        .values({ title: "Task 2", projectId: project.id })
        .returning();

      const response = await app.handle(
        new Request(`http://localhost/projects/${project.id}?deleteTodos=false`, {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(200);
      const resBody = await response.json();
      expect(resBody.success).toBe(true);
      expect(resBody.action).toBe("moved_to_inbox");

      // Verify project is deleted
      const remainingProjects = await db.select().from(projects);
      expect(remainingProjects.length).toBe(0);

      // Verify todos still exist but have projectId = null (Inbox)
      const remainingTodos = await db.select().from(todos);
      expect(remainingTodos.length).toBe(2);
      expect(remainingTodos[0].projectId).toBeNull();
      expect(remainingTodos[1].projectId).toBeNull();
    });

    it("deletes its todos when deleteTodos=true (cascade)", async () => {
      const [project] = await db
        .insert(projects)
        .values({ name: "To delete" })
        .returning();

      await db
        .insert(todos)
        .values([
          { title: "Task A", projectId: project.id },
          { title: "Task B", projectId: project.id },
        ]);

      const response = await app.handle(
        new Request(`http://localhost/projects/${project.id}?deleteTodos=true`, {
          method: "DELETE",
        })
      );

      expect(response.status).toBe(200);
      const resBody = await response.json();
      expect(resBody.success).toBe(true);
      expect(resBody.action).toBe("deleted_todos");

      // Verify both project and its todos are completely deleted
      const remainingProjects = await db.select().from(projects);
      expect(remainingProjects.length).toBe(0);

      const remainingTodos = await db.select().from(todos);
      expect(remainingTodos.length).toBe(0);
    });

    it("returns 404 when deleting nonexistent project", async () => {
      const response = await app.handle(
        new Request("http://localhost/projects/9999?deleteTodos=false", {
          method: "DELETE",
        })
      );
      expect(response.status).toBe(404);
    });

    it("handles deleting an empty project without error", async () => {
      const [project] = await db
        .insert(projects)
        .values({ name: "Empty Project" })
        .returning();

      const response = await app.handle(
        new Request(`http://localhost/projects/${project.id}?deleteTodos=true`, {
          method: "DELETE",
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe("Todos associated with projects", () => {
    it("creates a todo with a projectId", async () => {
      const [project] = await db
        .insert(projects)
        .values({ name: "Work" })
        .returning();

      const response = await app.handle(
        new Request("http://localhost/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Work task", projectId: project.id }),
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.projectId).toBe(project.id);
    });

    it("filters todos by projectId or inbox", async () => {
      const [project] = await db
        .insert(projects)
        .values({ name: "Work" })
        .returning();

      await db.insert(todos).values([
        { title: "Inbox task", projectId: null },
        { title: "Project task", projectId: project.id },
      ]);

      // Query inbox (null projectId)
      const inboxRes = await app.handle(
        new Request("http://localhost/todos?projectId=inbox")
      );
      expect(inboxRes.status).toBe(200);
      const inboxData = await inboxRes.json();
      expect(inboxData.length).toBe(1);
      expect(inboxData[0].title).toBe("Inbox task");

      // Query project
      const projectRes = await app.handle(
        new Request(`http://localhost/todos?projectId=${project.id}`)
      );
      expect(projectRes.status).toBe(200);
      const projectData = await projectRes.json();
      expect(projectData.length).toBe(1);
      expect(projectData[0].title).toBe("Project task");
    });
  });
});

