import { Elysia } from "elysia";
import { todosRoutes } from "./routes/todos";

export const app = new Elysia()
  .onError(({ code, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation Error", message: "Invalid request payload" };
    }
  })
  .get("/health", () => ({ status: "ok" }))
  .use(todosRoutes);
