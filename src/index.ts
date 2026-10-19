import { app } from "./app";
import { runMigrations } from "./db";

const port = Number(process.env.PORT) || 3000;

runMigrations();

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

export type App = typeof app;
