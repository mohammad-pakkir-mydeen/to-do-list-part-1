import { Elysia, t } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
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
          projectId: body.projectId ?? null,
        })
        .returning();

      set.status = 201;
      return newTodo;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        projectId: t.Optional(t.Nullable(t.Numeric())),
      }),
    }
  )
  .get(
    "/",
    async ({ query }) => {
      const conditions = [];

      if (query.filter === "active") {
        conditions.push(eq(todos.completed, false));
      } else if (query.filter === "completed") {
        conditions.push(eq(todos.completed, true));
      }

      if (query.projectId === "inbox") {
        conditions.push(isNull(todos.projectId));
      } else if (query.projectId !== undefined) {
        const pId = Number(query.projectId);
        if (!isNaN(pId)) {
          conditions.push(eq(todos.projectId, pId));
        }
      }

      if (conditions.length > 0) {
        return db
          .select()
          .from(todos)
          .where(and(...conditions));
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
          projectId: t.Optional(t.Union([t.Literal("inbox"), t.Numeric(), t.String()])),
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
      if (body.projectId !== undefined) {
        updateData.projectId = body.projectId;
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
        projectId: t.Optional(t.Nullable(t.Numeric())),
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



