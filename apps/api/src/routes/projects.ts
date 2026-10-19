import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects, todos } from "../db/schema";

export const projectsRoutes = new Elysia({ prefix: "/projects" })
  .post(
    "/",
    async ({ body, set }) => {
      const [newProject] = await db
        .insert(projects)
        .values({
          name: body.name.trim(),
        })
        .returning();

      set.status = 201;
      return newProject;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
      }),
    }
  )
  .get("/", async () => {
    return db.select().from(projects);
  })
  .delete(
    "/:id",
    async ({ params: { id }, query, set }) => {
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .get();

      if (!existing) {
        set.status = 404;
        return { error: "Not Found", message: `Project with id ${id} not found` };
      }

      const deleteTodos = query.deleteTodos === "true" || query.deleteTodos === true;

      if (deleteTodos) {
        // Cascade: delete all to-dos associated with this project
        await db.delete(todos).where(eq(todos.projectId, id));
      } else {
        // Move to Inbox: update all to-dos to have projectId = null
        await db
          .update(todos)
          .set({ projectId: null })
          .where(eq(todos.projectId, id));
      }

      await db.delete(projects).where(eq(projects.id, id));

      return {
        success: true,
        action: deleteTodos ? "deleted_todos" : "moved_to_inbox",
      };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Optional(
        t.Object({
          deleteTodos: t.Optional(t.Union([t.Boolean(), t.String()])),
        })
      ),
    }
  );

