import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { todosRoutes } from "./routes/todos";

export const app = new Elysia()
  .use(cors())
  .onError(({ code, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation Error", message: "Invalid request payload" };
    }
  })
  .get("/health", () => ({ status: "ok" }))
  .use(todosRoutes);

