import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { z } from "zod";
import { AuthorizationError } from "@gzaccess/auth";
import type { HealthResponse } from "@gzaccess/contracts";
import {
  AuthError,
  InMemoryAuthStore,
  PrismaAuthStore,
  registerAuthRoutes,
  type AuthStore,
} from "./auth.js";
import {
  BuildingError,
  InMemoryBuildingStore,
  PrismaBuildingStore,
  registerBuildingRoutes,
  type BuildingStore,
} from "./buildings.js";
import {
  InMemoryEmailOutboxStore,
  PrismaEmailOutboxStore,
  type EmailOutboxStore,
} from "./email.js";

export function buildApp(options?: {
  authStore?: AuthStore;
  buildingStore?: BuildingStore;
  emailOutboxStore?: EmailOutboxStore;
}) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "password",
        "token",
        "secret",
        "payload.activationLink",
        "biometricTemplate",
      ],
    },
  });

  void app.register(cors, { origin: true });
  void app.register(helmet);
  const authStore = options?.authStore ?? createDefaultAuthStore();
  void registerAuthRoutes(app, authStore);
  void registerBuildingRoutes(
    app,
    authStore,
    options?.buildingStore ?? createDefaultBuildingStore(),
    options?.emailOutboxStore ?? createDefaultEmailOutboxStore(),
  );
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthError) {
      return reply.code(error.statusCode).send({ error: error.code });
    }

    if (error instanceof BuildingError) {
      return reply.code(error.statusCode).send({ error: error.code });
    }

    if (error instanceof AuthorizationError) {
      return reply.code(403).send({ error: error.code });
    }

    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "VALIDATION_ERROR" });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

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

function createDefaultBuildingStore(): BuildingStore {
  return process.env.NODE_ENV === "test"
    ? new InMemoryBuildingStore()
    : new PrismaBuildingStore();
}

function createDefaultEmailOutboxStore(): EmailOutboxStore {
  return process.env.NODE_ENV === "test"
    ? new InMemoryEmailOutboxStore()
    : new PrismaEmailOutboxStore();
}
