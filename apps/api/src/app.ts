import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authContext } from "./auth";
import { authRoutes } from "./routes/auth";
import { todosRoutes } from "./routes/todos";
import { projectsRoutes } from "./routes/projects";

const allowedOrigins = (process.env.WEB_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const app = new Elysia()
  .use(
    cors({
      credentials: true,
      origin: allowedOrigins,
    })
  )
  .use(authContext)
  .onBeforeHandle(({ request, set }) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (origin && !allowedOrigins.includes(origin)) {
        set.status = 403;
        return { error: "Forbidden", message: "Request origin is not allowed" };
      }
    }
  })
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

