import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

import { readFileSync } from "node:fs";
import { resolve } from "path";

const isTestRun = process.env.NODE_ENV === "test";
const sqlite = new Database(
  isTestRun ? ":memory:" : process.env.DATABASE_URL || "todo.db"
);
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

export function runMigrations(customDb = db) {
  const migrationsFolder = resolve(import.meta.dir, "../../drizzle");
  const client = customDb.$client;
  const existingTables = new Set(
    (
      client
        .query("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>
    ).map(({ name }) => name)
  );

  if (existingTables.has("users")) {
    const columns = (tableName: string) =>
      new Set(
        (
          client.query(`PRAGMA table_info("${tableName}")`).all() as Array<{
            name: string;
          }>
        ).map(({ name }) => name)
      );

    client.transaction(() => {
      let userColumns = columns("users");
      if (!userColumns.has("username")) {
        client.exec("ALTER TABLE users ADD COLUMN username text");
      }
      if (!userColumns.has("name")) {
        client.exec("ALTER TABLE users ADD COLUMN name text");
      }
      if (!userColumns.has("email")) {
        client.exec("ALTER TABLE users ADD COLUMN email text");
      }

      userColumns = columns("users");
      if (userColumns.has("username")) {
        client.exec(
          "UPDATE users SET name = COALESCE(NULLIF(name, ''), username, 'Legacy user #' || id)"
        );
      }
      client.exec(
        "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)"
      );
      if (!existingTables.has("sessions")) {
        client.exec(`CREATE TABLE sessions (
          id text PRIMARY KEY NOT NULL,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at text NOT NULL,
          created_at text NOT NULL
        )`);
      }
      client.exec(
        "CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)"
      );

      for (const tableName of ["projects", "todos"]) {
        if (
          existingTables.has(tableName) &&
          !columns(tableName).has("user_id")
        ) {
          client.exec(
            `ALTER TABLE "${tableName}" ADD COLUMN user_id integer REFERENCES users(id) ON DELETE SET NULL`
          );
        }
        if (existingTables.has(tableName)) {
          client.exec(
            `CREATE INDEX IF NOT EXISTS "${tableName}_user_id_idx" ON "${tableName}" (user_id)`
          );
        }
      }

      if (!existingTables.has("__drizzle_migrations")) {
        client.exec(`CREATE TABLE __drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric
        )`);
      }

      const journal = JSON.parse(
        readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8")
      ) as { entries: Array<{ idx: number; when: number }> };
      const authMigration = journal.entries.find(({ idx }) => idx === 2);
      if (!authMigration) {
        throw new Error("Authentication migration is missing from the journal");
      }

      const applied = client
        .query("SELECT 1 FROM __drizzle_migrations WHERE created_at = ?")
        .get(authMigration.when);
      if (!applied) {
        client
          .query(
            "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
          )
          .run("legacy-auth-schema-upgrade", authMigration.when);
      }
    })();
  }

  migrate(customDb, { migrationsFolder });
}
