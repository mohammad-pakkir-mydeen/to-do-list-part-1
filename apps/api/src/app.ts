import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { todosRoutes } from "./routes/todos";
import { projectsRoutes } from "./routes/projects";
import { authRoutes } from "./routes/auth";
import { authContext } from "./auth";

export const app = new Elysia()
  .use(
    cors({
      credentials: true,
      origin: true,
    })
  )
  .use(authContext)
  .onError(({ code, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return { error: "Validation Error", message: "Invalid request payload" };
    }
  })
  .get("/health", () => ({ status: "ok" }))
  .use(authRoutes)
  .use(todosRoutes)
  .use(projectsRoutes);



