import { and, eq, isNull, or } from "drizzle-orm";
import { projects, todos } from "./db/schema";

export function todoVisibility(userId: number) {
  return or(
    and(eq(projects.isShared, false), eq(projects.userId, userId)),
    and(
      or(isNull(projects.id), eq(projects.isShared, true)),
      or(eq(todos.userId, userId), eq(todos.isShared, true))
    )
  );
}
