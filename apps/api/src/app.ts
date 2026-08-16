import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import type { HealthResponse } from "@gzaccess/contracts";
import {
  InMemoryAuthStore,
  PrismaAuthStore,
  registerAuthRoutes,
  type AuthStore,
} from "./auth.js";

export function buildApp(options?: { authStore?: AuthStore }) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "password",
        "token",
        "secret",
        "biometricTemplate",
      ],
    },
  });

  void app.register(cors, { origin: true });
  void app.register(helmet);
  void registerAuthRoutes(app, options?.authStore ?? createDefaultAuthStore());

  app.get<{ Reply: HealthResponse }>("/api/v1/health", async () => ({
    service: "gzaccess-api",
    status: "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    timestamp: new Date().toISOString(),
  }));

  return app;
}

function createDefaultAuthStore(): AuthStore {
  return process.env.NODE_ENV === "test"
    ? new InMemoryAuthStore()
    : new PrismaAuthStore();
}
