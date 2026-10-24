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

