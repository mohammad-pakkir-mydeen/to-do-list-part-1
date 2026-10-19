import { Elysia, t } from "elysia";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { authContext } from "../auth";
import { db } from "../db";
import { projects, todos, users } from "../db/schema";

function todoVisibility(userId: number) {
  return or(
    and(eq(projects.isShared, false), eq(projects.userId, userId)),
    and(
      or(isNull(projects.id), eq(projects.isShared, true)),
      or(eq(todos.userId, userId), eq(todos.isShared, true))
    )
  );
}

const notFound = () => ({
  error: "Not Found",
  message: "Todo not found",
});

export const todosRoutes = new Elysia({ prefix: "/todos" })
  .use(authContext)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized", message: "Authentication required" };
    }
  })
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      let projectIsShared: boolean | null = null;
      if (body.projectId !== undefined && body.projectId !== null) {
        const [project] = await db
          .select({ userId: projects.userId, isShared: projects.isShared })
          .from(projects)
          .where(
            and(
              eq(projects.id, body.projectId),
              or(eq(projects.userId, user.id), eq(projects.isShared, true))
            )
          )
          .limit(1);

        if (!project) {
          set.status = 404;
          return { error: "Not Found", message: "Project not found" };
        }
        projectIsShared = project.isShared;
      }

      const [newTodo] = await db
        .insert(todos)
        .values({
          title: body.title.trim(),
          projectId: body.projectId ?? null,
          userId: user.id,
          isShared:
            projectIsShared === false ? false : body.isShared ?? false,
        })
        .returning();

      set.status = 201;
      return {
        ...newTodo,
        creator: { id: user.id, name: user.name, email: user.email },
      };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        projectId: t.Optional(t.Nullable(t.Numeric())),
        isShared: t.Optional(t.Boolean()),
      }),
    }
  )
  .get(
    "/",
    async ({ query, user }) => {
      if (!user) return [];
      const conditions = [];
      conditions.push(todoVisibility(user.id));

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

      const dbQuery = db
        .select({
          todo: todos,
          creator: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(todos)
        .leftJoin(users, eq(todos.userId, users.id))
        .leftJoin(projects, eq(todos.projectId, projects.id));

      const result =
        conditions.length > 0
          ? await dbQuery.where(and(...conditions))
          : await dbQuery;
      return result.map(({ todo, creator }) => ({
        ...todo,
        creator: creator
          ? {
              id: creator.id,
              name: creator.name ?? "Legacy user",
              email: creator.email,
            }
          : null,
      }));
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
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      const [existing] = await db
        .select({ todo: todos, projectIsShared: projects.isShared })
        .from(todos)
        .leftJoin(projects, eq(todos.projectId, projects.id))
        .where(and(eq(todos.id, id), todoVisibility(user.id)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return notFound();
      }

      const existingTodo = existing.todo;
      let targetProjectIsShared = existing.projectIsShared;
      const updateData: Partial<typeof todos.$inferInsert> = {};
      if (body.title !== undefined) {
        updateData.title = body.title.trim();
      }
      if (body.completed !== undefined) {
        updateData.completed = body.completed;
      }
      if (body.projectId !== undefined) {
        if (body.projectId !== null) {
          const [project] = await db
            .select({ isShared: projects.isShared })
            .from(projects)
            .where(
              and(
                eq(projects.id, body.projectId),
                or(eq(projects.userId, user.id), eq(projects.isShared, true))
              )
            )
            .limit(1);

          if (!project) {
            set.status = 404;
            return { error: "Not Found", message: "Project not found" };
          }
          targetProjectIsShared = project.isShared;
          if (!project.isShared) updateData.isShared = false;
        } else {
          targetProjectIsShared = null;
        }
        updateData.projectId = body.projectId;
      }
      if (body.isShared !== undefined) {
        if (existingTodo.userId !== user.id) {
          set.status = 404;
          return notFound();
        }
        updateData.isShared =
          targetProjectIsShared === false ? false : body.isShared;
      }

      const [updated] = await db
        .update(todos)
        .set(updateData)
        .where(eq(todos.id, existingTodo.id))
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
        isShared: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete("/completed", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized", message: "Authentication required" };
    }

    const visibleCompleted = await db
      .select({ id: todos.id })
      .from(todos)
      .leftJoin(projects, eq(todos.projectId, projects.id))
      .where(and(eq(todos.completed, true), todoVisibility(user.id)));
    const deleted = visibleCompleted.length
      ? await db
          .delete(todos)
          .where(inArray(todos.id, visibleCompleted.map(({ id }) => id)))
          .returning()
      : [];

    return { success: true, deletedCount: deleted.length };
  })
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      const [visibleTodo] = await db
        .select({ id: todos.id })
        .from(todos)
        .leftJoin(projects, eq(todos.projectId, projects.id))
        .where(and(eq(todos.id, id), todoVisibility(user.id)))
        .limit(1);

      if (!visibleTodo) {
        set.status = 404;
        return notFound();
      }

      const [deleted] = await db
        .delete(todos)
        .where(eq(todos.id, visibleTodo.id))
        .returning();

      if (!deleted) {
        set.status = 404;
        return notFound();
      }

      return { success: true, deleted };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  );
