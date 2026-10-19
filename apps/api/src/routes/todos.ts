import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { todos } from "../db/schema";

export const todosRoutes = new Elysia({ prefix: "/todos" })
  .post(
    "/",
    async ({ body, set }) => {
      const [newTodo] = await db
        .insert(todos)
        .values({
          title: body.title.trim(),
        })
        .returning();

      set.status = 201;
      return newTodo;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
      }),
    }
  )
  .get(
    "/",
    async ({ query }) => {
      if (query.filter === "active") {
        return db.select().from(todos).where(eq(todos.completed, false));
      }
      if (query.filter === "completed") {
        return db.select().from(todos).where(eq(todos.completed, true));
      }
      return db.select().from(todos);
    },
    {
      query: t.Optional(
        t.Object({
          filter: t.Optional(
            t.Union([
              t.Literal("all"),
              t.Literal("active"),
              t.Literal("completed"),
            ])
          ),
        })
      ),
    }
  )
  .patch(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const existing = await db
        .select()
        .from(todos)
        .where(eq(todos.id, id))
        .get();

      if (!existing) {
        set.status = 404;
        return { error: "Not Found", message: `Todo with id ${id} not found` };
      }

      const updateData: Partial<typeof todos.$inferInsert> = {};
      if (body.title !== undefined) {
        updateData.title = body.title.trim();
      }
      if (body.completed !== undefined) {
        updateData.completed = body.completed;
      }

      const [updated] = await db
        .update(todos)
        .set(updateData)
        .where(eq(todos.id, id))
        .returning();

      return updated;
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        completed: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete("/completed", async () => {
    const deleted = await db
      .delete(todos)
      .where(eq(todos.completed, true))
      .returning();

    return { success: true, deletedCount: deleted.length };
  })
  .delete(
    "/:id",
    async ({ params: { id }, set }) => {
      const [deleted] = await db
        .delete(todos)
        .where(eq(todos.id, id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return { error: "Not Found", message: `Todo with id ${id} not found` };
      }

      return { success: true, deleted };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  );



