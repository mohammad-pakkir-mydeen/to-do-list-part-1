import { Elysia, t } from "elysia";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { authContext } from "../auth";
import { db } from "../db";
import { projects, todoComments, todos, users } from "../db/schema";
import { todoVisibility } from "../todo-visibility";

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
      let parentTodoId: number | null = null;
      let projectId = body.projectId ?? null;
      let isShared = body.isShared ?? false;

      if (body.parentTodoId !== undefined && body.parentTodoId !== null) {
        const [parent] = await db
          .select({ todo: todos, projectIsShared: projects.isShared })
          .from(todos)
          .leftJoin(projects, eq(todos.projectId, projects.id))
          .where(
            and(
              eq(todos.id, body.parentTodoId),
              isNull(todos.parentTodoId),
              todoVisibility(user.id)
            )
          )
          .limit(1);

        if (!parent) {
          set.status = 404;
          return notFound();
        }
        if (
          (body.projectId !== undefined &&
            body.projectId !== parent.todo.projectId) ||
          (body.isShared !== undefined &&
            body.isShared !== parent.todo.isShared)
        ) {
          set.status = 400;
          return {
            error: "Validation Error",
            message: "Subtasks inherit their parent's project and visibility",
          };
        }

        parentTodoId = parent.todo.id;
        projectId = parent.todo.projectId;
        isShared = parent.todo.isShared;
        projectIsShared = parent.projectIsShared;
      } else if (projectId !== null) {
        const [project] = await db
          .select({ userId: projects.userId, isShared: projects.isShared })
          .from(projects)
          .where(
            and(
              eq(projects.id, projectId),
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
          projectId,
          userId: user.id,
          isShared: projectIsShared === false ? false : isShared,
          parentTodoId,
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
        parentTodoId: t.Optional(t.Nullable(t.Numeric())),
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

      conditions.push(isNull(todos.parentTodoId));
      const result =
        conditions.length > 0
          ? await dbQuery.where(and(...conditions))
          : await dbQuery;
      const rootTodoIds = result.map(({ todo }) => todo.id);
      const children = rootTodoIds.length
        ? await db
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
            .leftJoin(projects, eq(todos.projectId, projects.id))
            .where(
              and(
                inArray(todos.parentTodoId, rootTodoIds),
                todoVisibility(user.id)
              )
            )
        : [];
      const childrenByParent = new Map<number, typeof children>();
      for (const child of children) {
        const parentId = child.todo.parentTodoId;
        if (parentId === null) continue;
        childrenByParent.set(parentId, [
          ...(childrenByParent.get(parentId) ?? []),
          child,
        ]);
      }

      return result.map(({ todo, creator }) => ({
        ...todo,
        creator: creator
          ? {
              id: creator.id,
              name: creator.name ?? "Legacy user",
              email: creator.email,
            }
          : null,
        subtasks: (childrenByParent.get(todo.id) ?? []).map(
          ({ todo: subtask, creator: subtaskCreator }) => ({
            ...subtask,
            creator: subtaskCreator
              ? {
                  id: subtaskCreator.id,
                  name: subtaskCreator.name ?? "Legacy user",
                  email: subtaskCreator.email,
                }
              : null,
            subtasks: [],
          })
        ),
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
      if (
        existingTodo.parentTodoId !== null &&
        (body.projectId !== undefined || body.isShared !== undefined)
      ) {
        set.status = 400;
        return {
          error: "Validation Error",
          message: "Subtasks inherit their parent's project and visibility",
        };
      }
      if (body.completeSubtasks === true && body.completed !== true) {
        set.status = 400;
        return {
          error: "Validation Error",
          message: "Subtasks can be completed with a completed parent only",
        };
      }
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

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(todos)
          .set(updateData)
          .where(eq(todos.id, existingTodo.id))
          .returning();

        if (existingTodo.parentTodoId === null) {
          const childUpdate: Partial<typeof todos.$inferInsert> = {};
          if (body.projectId !== undefined) {
            childUpdate.projectId = updateData.projectId ?? null;
          }
          if (body.projectId !== undefined || body.isShared !== undefined) {
            childUpdate.isShared =
              updateData.isShared ?? existingTodo.isShared;
          }
          if (body.completeSubtasks === true && body.completed === true) {
            childUpdate.completed = true;
          }
          if (Object.keys(childUpdate).length > 0) {
            await tx
              .update(todos)
              .set(childUpdate)
              .where(eq(todos.parentTodoId, existingTodo.id));
          }
        }

        return updated;
      });
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
        completeSubtasks: t.Optional(t.Boolean()),
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
  )
  .get(
    "/:id/comments",
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

      const comments = await db
        .select({
          id: todoComments.id,
          todoId: todoComments.todoId,
          userId: todoComments.userId,
          body: todoComments.body,
          createdAt: todoComments.createdAt,
          updatedAt: todoComments.updatedAt,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(todoComments)
        .innerJoin(users, eq(todoComments.userId, users.id))
        .where(eq(todoComments.todoId, id))
        .orderBy(asc(todoComments.createdAt));
      return comments.map(({ author, ...comment }) => ({
        ...comment,
        author: {
          id: author.id,
          name: author.name ?? "Legacy user",
          email: author.email,
        },
      }));
    },
    { params: t.Object({ id: t.Numeric() }) }
  )
  .post(
    "/:id/comments",
    async ({ params: { id }, body, user, set }) => {
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
      const commentBody = body.body.trim();
      if (!commentBody) {
        set.status = 400;
        return {
          error: "Validation Error",
          message: "Comment cannot be empty",
        };
      }

      const [comment] = await db
        .insert(todoComments)
        .values({
          todoId: visibleTodo.id,
          userId: user.id,
          body: commentBody,
        })
        .returning();
      set.status = 201;
      return {
        ...comment,
        author: { id: user.id, name: user.name, email: user.email },
      };
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({ body: t.String({ minLength: 1, maxLength: 5000 }) }),
    }
  )
  .patch(
    "/:id/comments/:commentId",
    async ({ params: { id, commentId }, body, user, set }) => {
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
      const commentBody = body.body.trim();
      if (!commentBody) {
        set.status = 400;
        return {
          error: "Validation Error",
          message: "Comment cannot be empty",
        };
      }

      const [updated] = await db
        .update(todoComments)
        .set({ body: commentBody, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(todoComments.id, commentId),
            eq(todoComments.todoId, id),
            eq(todoComments.userId, user.id)
          )
        )
        .returning();
      if (!updated) {
        set.status = 404;
        return { error: "Not Found", message: "Comment not found" };
      }
      return {
        ...updated,
        author: { id: user.id, name: user.name, email: user.email },
      };
    },
    {
      params: t.Object({ id: t.Numeric(), commentId: t.Numeric() }),
      body: t.Object({ body: t.String({ minLength: 1, maxLength: 5000 }) }),
    }
  )
  .delete(
    "/:id/comments/:commentId",
    async ({ params: { id, commentId }, user, set }) => {
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
        .delete(todoComments)
        .where(
          and(
            eq(todoComments.id, commentId),
            eq(todoComments.todoId, id),
            eq(todoComments.userId, user.id)
          )
        )
        .returning({ id: todoComments.id });
      if (!deleted) {
        set.status = 404;
        return { error: "Not Found", message: "Comment not found" };
      }
      return { success: true };
    },
    { params: t.Object({ id: t.Numeric(), commentId: t.Numeric() }) }
  );
