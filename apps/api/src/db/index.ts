import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

import { resolve } from "path";

const sqlite = new Database(process.env.DATABASE_URL || "todo.db");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

// Automatically apply migrations on startup
export function runMigrations(customDb = db) {
  const migrationsFolder = resolve(import.meta.dir, "../../drizzle");
  migrate(customDb, { migrationsFolder });
}


