import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("GET /health", () => {
  it("returns 200 OK with status ok", async () => {
    const response = await app.handle(
      new Request("http://localhost/health")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
