import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  addSeconds,
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from "@gzaccess/auth";
import type { AuthenticatedUser, AuthTokens, Role } from "@gzaccess/contracts";

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlSeconds = 30 * 24 * 60 * 60;
const activationTokenTtlSeconds = 48 * 60 * 60;

interface StoredOrganization {
  id: string;
  name: string;
}

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  isActive: boolean;
}

interface StoredMembership {
  organizationId: string;
  userId: string;
  role: Role;
}

interface StoredActivation {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
}

interface StoredSession {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface AuthStore {
  createBootstrapAdmin(input: {
    organizationName: string;
    email: string;
    displayName: string;
  }): Promise<{ user: AuthenticatedUser; activationToken: string }>;
  completeActivation(input: {
    token: string;
    password: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }>;
  login(input: { email: string; password: string }): Promise<{
    user: AuthenticatedUser;
    tokens: AuthTokens;
  }>;
  refresh(input: { refreshToken: string }): Promise<AuthTokens>;
  authenticate(accessToken: string): Promise<AuthenticatedUser | undefined>;
}

export class InMemoryAuthStore implements AuthStore {
  private readonly organizations = new Map<string, StoredOrganization>();
  private readonly users = new Map<string, StoredUser>();
  private readonly memberships: StoredMembership[] = [];
  private readonly activations = new Map<string, StoredActivation>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly accessTokens = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  async createBootstrapAdmin(input: {
    organizationName: string;
    email: string;
    displayName: string;
  }): Promise<{ user: AuthenticatedUser; activationToken: string }> {
    const normalizedEmail = normalizeEmail(input.email);
    const existing = [...this.users.values()].find(
      (user) => user.email === normalizedEmail,
    );
    if (existing) {
      throw new AuthError("EMAIL_ALREADY_EXISTS", 409);
    }

    const organization: StoredOrganization = {
      id: createId("org"),
      name: input.organizationName,
    };
    const user: StoredUser = {
      id: createId("usr"),
      email: normalizedEmail,
      displayName: input.displayName,
      isActive: false,
    };

    this.organizations.set(organization.id, organization);
    this.users.set(user.id, user);
    this.memberships.push({
      organizationId: organization.id,
      userId: user.id,
      role: "GZIT_PLATFORM_ADMIN",
    });

    const activationToken = createOpaqueToken();
    this.activations.set(hashOpaqueToken(activationToken), {
      userId: user.id,
      tokenHash: hashOpaqueToken(activationToken),
      expiresAt: addSeconds(new Date(), activationTokenTtlSeconds),
    });

    return { user: this.toAuthenticatedUser(user), activationToken };
  }

  async completeActivation(input: {
    token: string;
    password: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const tokenHash = hashOpaqueToken(input.token);
    const activation = this.activations.get(tokenHash);
    if (
      !activation ||
      activation.consumedAt ||
      activation.expiresAt.getTime() <= Date.now()
    ) {
      throw new AuthError("INVALID_OR_EXPIRED_ACTIVATION", 400);
    }

    const user = this.getUser(activation.userId);
    user.passwordHash = await hashPassword(input.password);
    user.isActive = true;
    activation.consumedAt = new Date();

    return {
      user: this.toAuthenticatedUser(user),
      tokens: this.createTokens(user.id),
    };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const user = [...this.users.values()].find(
      (item) => item.email === normalizeEmail(input.email),
    );
    if (!user || !user.isActive || !user.passwordHash) {
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }

    const validPassword = await verifyPassword(
      input.password,
      user.passwordHash,
    );
    if (!validPassword) {
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }

    return {
      user: this.toAuthenticatedUser(user),
      tokens: this.createTokens(user.id),
    };
  }

  async refresh(input: { refreshToken: string }): Promise<AuthTokens> {
    const refreshTokenHash = hashOpaqueToken(input.refreshToken);
    const session = this.sessions.get(refreshTokenHash);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AuthError("INVALID_REFRESH_TOKEN", 401);
    }

    session.revokedAt = new Date();
    return this.createTokens(session.userId);
  }

  async authenticate(
    accessToken: string,
  ): Promise<AuthenticatedUser | undefined> {
    const access = this.accessTokens.get(hashOpaqueToken(accessToken));
    if (!access || access.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    return this.toAuthenticatedUser(this.getUser(access.userId));
  }

  private createTokens(userId: string): AuthTokens {
    const accessToken = createOpaqueToken();
    const refreshToken = createOpaqueToken();
    const now = new Date();

    this.accessTokens.set(hashOpaqueToken(accessToken), {
      userId,
      expiresAt: addSeconds(now, accessTokenTtlSeconds),
    });
    this.sessions.set(hashOpaqueToken(refreshToken), {
      userId,
      refreshTokenHash: hashOpaqueToken(refreshToken),
      expiresAt: addSeconds(now, refreshTokenTtlSeconds),
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: accessTokenTtlSeconds,
    };
  }

  private getUser(userId: string): StoredUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthError("USER_NOT_FOUND", 404);
    }

    return user;
  }

  private toAuthenticatedUser(user: StoredUser): AuthenticatedUser {
    const memberships = this.memberships.filter(
      (item) => item.userId === user.id,
    );

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: memberships.map((item) => item.role),
      organizationIds: memberships.map((item) => item.organizationId),
    };
  }
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

const bootstrapSchema = z.object({
  organizationName: z.string().min(2),
  email: z.string().email(),
  displayName: z.string().min(2),
});

const activationSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export async function registerAuthRoutes(
  app: FastifyInstance,
  store: AuthStore,
) {
  app.post(
    "/api/v1/auth/dev/bootstrap-platform-admin",
    async (request, reply) => {
      if (process.env.NODE_ENV === "production") {
        return reply.code(404).send({ error: "NOT_FOUND" });
      }

      const input = bootstrapSchema.parse(request.body);
      return store.createBootstrapAdmin(input);
    },
  );

  app.post("/api/v1/auth/activation/complete", async (request) => {
    const input = activationSchema.parse(request.body);
    return store.completeActivation(input);
  });

  app.post("/api/v1/auth/login", async (request) => {
    const input = loginSchema.parse(request.body);
    return store.login(input);
  });

  app.post("/api/v1/auth/refresh", async (request) => {
    const input = refreshSchema.parse(request.body);
    return store.refresh(input);
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const user = await authenticateRequest(store, request);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { user };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthError) {
      return reply.code(error.statusCode).send({ error: error.code });
    }

    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "VALIDATION_ERROR" });
    }

    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
}

async function authenticateRequest(
  store: AuthStore,
  request: FastifyRequest,
): Promise<AuthenticatedUser | undefined> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return store.authenticate(authorization.slice("Bearer ".length));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createId(prefix: string): string {
  return `${prefix}_${createOpaqueToken(12)}`;
}
