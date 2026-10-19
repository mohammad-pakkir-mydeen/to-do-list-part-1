import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { todosRoutes } from "./routes/todos";
import { projectsRoutes } from "./routes/projects";

export const app = new Elysia()
  .use(cors())
  .onError(({ code, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation Error", message: "Invalid request payload" };
    }
  })
  .get("/health", () => ({ status: "ok" }))
  .use(todosRoutes)
  .use(projectsRoutes);


