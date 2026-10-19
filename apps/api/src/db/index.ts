import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL || "todo.db");
export const db = drizzle(sqlite, { schema });

// Automatically apply migrations on startup
export function runMigrations(customDb = db) {
  migrate(customDb, { migrationsFolder: "./drizzle" });
}

