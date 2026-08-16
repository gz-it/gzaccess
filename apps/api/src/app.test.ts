import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

describe("api health", () => {
  it("returns service health", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "gzaccess-api",
      status: "ok",
    });
  });
});
