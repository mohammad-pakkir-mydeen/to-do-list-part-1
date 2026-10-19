import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "../src/db/schema";
import { runMigrations } from "../src/db";

describe("database migrations", () => {
  let sqlite: Database | undefined;

  afterEach(() => sqlite?.close());

  it("preserves visibility of existing ownerless projects and todos", () => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE users (
        id integer PRIMARY KEY AUTOINCREMENT,
        username text,
        password_hash text NOT NULL,
        created_at text NOT NULL
      );
      CREATE TABLE projects (
        id integer PRIMARY KEY AUTOINCREMENT,
        name text NOT NULL,
        created_at text NOT NULL
      );
      CREATE TABLE todos (
        id integer PRIMARY KEY AUTOINCREMENT,
        title text NOT NULL,
        completed integer DEFAULT false NOT NULL,
        project_id integer REFERENCES projects(id),
        created_at text NOT NULL
      );
      CREATE TABLE __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
      INSERT INTO users (id, username, password_hash, created_at)
        VALUES (1, 'legacy', 'hash', '2025-01-01T00:00:00.000Z');
      INSERT INTO projects (id, name, created_at)
        VALUES (1, 'Old project', '2025-01-01T00:00:00.000Z');
      INSERT INTO todos (id, title, project_id, created_at)
        VALUES (1, 'Old todo', 1, '2025-01-01T00:00:00.000Z');
    `);

    const journal = JSON.parse(
      readFileSync(
        resolve(import.meta.dir, "../drizzle/meta/_journal.json"),
        "utf8"
      )
    ) as { entries: Array<{ idx: number; when: number }> };
    for (const entry of journal.entries.filter(({ idx }) => idx < 2)) {
      sqlite
        .query(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
        )
        .run(`legacy-${entry.idx}`, entry.when);
    }

    runMigrations(drizzle(sqlite, { schema }));

    const projectsAfterMigration = sqlite
      .query("SELECT is_shared FROM projects WHERE id = 1")
      .get() as { is_shared: number };
    const todosAfterMigration = sqlite
      .query("SELECT is_shared FROM todos WHERE id = 1")
      .get() as { is_shared: number };
    expect(projectsAfterMigration.is_shared).toBe(1);
    expect(todosAfterMigration.is_shared).toBe(1);

    const todoColumns = sqlite
      .query("PRAGMA table_info(todos)")
      .all() as Array<{ name: string }>;
    expect(todoColumns.some(({ name }) => name === "parent_todo_id")).toBe(true);
    const commentTable = sqlite
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todo_comments'"
      )
      .get() as { name: string } | null;
    expect(commentTable?.name).toBe("todo_comments");
    const parentForeignKey = sqlite
      .query("PRAGMA foreign_key_list(todos)")
      .all() as Array<{ from: string; on_delete: string }>;
    expect(
      parentForeignKey.find(({ from }) => from === "parent_todo_id")?.on_delete
    ).toBe("CASCADE");
  });
});
