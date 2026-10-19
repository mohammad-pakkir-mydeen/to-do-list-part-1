import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username"),
  name: text("name"),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)]
);

export const todos = sqliteTable(
  "todos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
    parentTodoId: integer("parent_todo_id").references((): AnySQLiteColumn => todos.id, {
      onDelete: "cascade",
    }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("todos_user_id_idx").on(table.userId),
    index("todos_parent_todo_id_idx").on(table.parentTodoId),
  ]
);

export const todoComments = sqliteTable(
  "todo_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    todoId: integer("todo_id")
      .notNull()
      .references(() => todos.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index("todo_comments_todo_id_idx").on(table.todoId),
    index("todo_comments_user_id_idx").on(table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
