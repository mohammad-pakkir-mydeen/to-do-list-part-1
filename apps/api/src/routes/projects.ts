import { and, eq, or } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { authContext } from "../auth";
import { db } from "../db";
import { projects, todos, users } from "../db/schema";

const notFound = (resource: string) => ({
  error: "Not Found",
  message: `${resource} not found`,
});

export const projectsRoutes = new Elysia({ prefix: "/projects" })
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

      const [project] = await db
        .insert(projects)
        .values({
          name: body.name.trim(),
          userId: user.id,
          isShared: body.isShared ?? false,
        })
        .returning();

      set.status = 201;
      return {
        ...project,
        creator: { id: user.id, name: user.name, email: user.email },
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        isShared: t.Optional(t.Boolean()),
      }),
    }
  )
  .get("/", async ({ user }) => {
    if (!user) return [];
    return db
      .select({
        id: projects.id,
        name: projects.name,
        userId: projects.userId,
        isShared: projects.isShared,
        createdAt: projects.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(projects)
      .leftJoin(users, eq(projects.userId, users.id))
      .where(or(eq(projects.userId, user.id), eq(projects.isShared, true)));
  })
  .patch(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            or(eq(projects.userId, user.id), eq(projects.isShared, true))
          )
        )
        .limit(1);

      if (!project) {
        set.status = 404;
        return notFound("Project");
      }
      if (body.isShared !== undefined && project.userId !== user.id) {
        set.status = 404;
        return notFound("Project");
      }

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(projects)
          .set({
            ...(body.name !== undefined ? { name: body.name.trim() } : {}),
            ...(body.isShared !== undefined ? { isShared: body.isShared } : {}),
          })
          .where(eq(projects.id, id))
          .returning();

        if (body.isShared === false) {
          await tx
            .update(todos)
            .set({ isShared: false })
            .where(eq(todos.projectId, id));
        }

        return updated;
      });
    },
    {
      params: t.Object({ id: t.Numeric() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        isShared: t.Optional(t.Boolean()),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params: { id }, query, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized", message: "Authentication required" };
      }

      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            or(eq(projects.userId, user.id), eq(projects.isShared, true))
          )
        )
        .limit(1);

      if (!project) {
        set.status = 404;
        return notFound("Project");
      }

      const deleteTodos = query.deleteTodos === "true" || query.deleteTodos === true;
      if (deleteTodos) {
        await db.delete(todos).where(eq(todos.projectId, id));
      } else {
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
      params: t.Object({ id: t.Numeric() }),
      query: t.Optional(
        t.Object({ deleteTodos: t.Optional(t.Union([t.Boolean(), t.String()])) })
      ),
    }
  );
