import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  addSeconds,
  createOpaqueToken,
  createTotpSecret,
  hashOpaqueToken,
  hashPassword,
  verifyTotpCode,
  verifyPassword,
} from "@gzaccess/auth";
import type { AuthenticatedUser, AuthTokens, Role } from "@gzaccess/contracts";
import { prisma, type PrismaClient } from "@gzaccess/database";

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlSeconds = 30 * 24 * 60 * 60;
const activationTokenTtlSeconds = 48 * 60 * 60;
const passwordResetTokenTtlSeconds = 60 * 60;

interface StoredOrganization {
  id: string;
  name: string;
}

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  mfaSecret?: string;
  mfaEnabledAt?: Date;
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

interface StoredPasswordReset {
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

interface UserWithMemberships {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mfaSecret?: string | null;
  mfaEnabledAt?: Date | null;
  memberships: Array<{ organizationId: string; role: Role }>;
}

type AuthReadClient = Pick<PrismaClient, "user">;

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
  login(input: { email: string; password: string; mfaCode?: string }): Promise<{
    user: AuthenticatedUser;
    tokens: AuthTokens;
  }>;
  refresh(input: { refreshToken: string }): Promise<AuthTokens>;
  authenticate(accessToken: string): Promise<AuthenticatedUser | undefined>;
  requestPasswordReset(input: {
    email: string;
  }): Promise<{ resetToken?: string }>;
  completePasswordReset(input: {
    token: string;
    password: string;
  }): Promise<{ ok: true }>;
  beginMfaSetup(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string }>;
  enableMfa(input: { userId: string; code: string }): Promise<{ ok: true }>;
  disableMfa(input: { userId: string; code: string }): Promise<{ ok: true }>;
}

export class InMemoryAuthStore implements AuthStore {
  private readonly organizations = new Map<string, StoredOrganization>();
  private readonly users = new Map<string, StoredUser>();
  private readonly memberships: StoredMembership[] = [];
  private readonly activations = new Map<string, StoredActivation>();
  private readonly passwordResets = new Map<string, StoredPasswordReset>();
  private readonly sessions = new Map<string, StoredSession>();

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
    this.audit({
      actorUserId: user.id,
      action: "auth.bootstrap_platform_admin",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
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
    this.audit({
      actorUserId: user.id,
      action: "auth.activation.complete",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
    });

    return {
      user: this.toAuthenticatedUser(user),
      tokens: this.createTokens(user.id),
    };
  }

  async login(input: {
    email: string;
    password: string;
    mfaCode?: string;
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
      this.audit({
        actorUserId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        result: "FAILED",
      });
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }
    if (user.mfaEnabledAt) {
      if (
        !input.mfaCode ||
        !user.mfaSecret ||
        !verifyTotpCode(user.mfaSecret, input.mfaCode)
      ) {
        this.audit({
          actorUserId: user.id,
          action: "auth.login.mfa",
          entityType: "User",
          entityId: user.id,
          result: "FAILED",
        });
        throw new AuthError("MFA_REQUIRED", 401);
      }
    }

    this.audit({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
    });

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
    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      return undefined;
    }

    const user = this.getUser(payload.userId);
    return user.isActive ? this.toAuthenticatedUser(user) : undefined;
  }

  async requestPasswordReset(input: {
    email: string;
  }): Promise<{ resetToken?: string }> {
    const user = [...this.users.values()].find(
      (item) => item.email === normalizeEmail(input.email),
    );
    if (!user || !user.isActive) {
      return {};
    }

    const resetToken = createOpaqueToken();
    this.passwordResets.set(hashOpaqueToken(resetToken), {
      userId: user.id,
      tokenHash: hashOpaqueToken(resetToken),
      expiresAt: addSeconds(new Date(), passwordResetTokenTtlSeconds),
    });
    this.audit({
      actorUserId: user.id,
      action: "auth.password_reset.request",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
    });

    return { resetToken };
  }

  async completePasswordReset(input: {
    token: string;
    password: string;
  }): Promise<{ ok: true }> {
    const tokenHash = hashOpaqueToken(input.token);
    const reset = this.passwordResets.get(tokenHash);
    if (!reset || reset.consumedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw new AuthError("INVALID_OR_EXPIRED_PASSWORD_RESET", 400);
    }

    const user = this.getUser(reset.userId);
    user.passwordHash = await hashPassword(input.password);
    reset.consumedAt = new Date();
    this.revokeUserSessions(user.id);
    this.audit({
      actorUserId: user.id,
      action: "auth.password_reset.complete",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
    });

    return { ok: true };
  }

  async beginMfaSetup(userId: string) {
    const user = this.getUser(userId);
    const secret = createTotpSecret();
    user.mfaSecret = secret;
    user.mfaEnabledAt = undefined;

    return { secret, otpauthUrl: createOtpAuthUrl(user.email, secret) };
  }

  async enableMfa(input: { userId: string; code: string }) {
    const user = this.getUser(input.userId);
    if (!user.mfaSecret || !verifyTotpCode(user.mfaSecret, input.code)) {
      throw new AuthError("INVALID_MFA_CODE", 400);
    }
    user.mfaEnabledAt = new Date();

    return { ok: true as const };
  }

  async disableMfa(input: { userId: string; code: string }) {
    const user = this.getUser(input.userId);
    if (
      user.mfaEnabledAt &&
      (!user.mfaSecret || !verifyTotpCode(user.mfaSecret, input.code))
    ) {
      throw new AuthError("INVALID_MFA_CODE", 400);
    }
    user.mfaSecret = undefined;
    user.mfaEnabledAt = undefined;

    return { ok: true as const };
  }

  private createTokens(userId: string): AuthTokens {
    const refreshToken = createOpaqueToken();
    const now = new Date();

    this.sessions.set(hashOpaqueToken(refreshToken), {
      userId,
      refreshTokenHash: hashOpaqueToken(refreshToken),
      expiresAt: addSeconds(now, refreshTokenTtlSeconds),
    });

    return {
      accessToken: createAccessToken(userId),
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

  private revokeUserSessions(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date();
      }
    }
  }

  private audit(input: {
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    result: "SUCCESS" | "FAILED";
  }): void {
    void input;
    // In-memory tests assert behavior; durable audit is handled by PrismaAuthStore.
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

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly client: PrismaClient = prisma) {}

  async createBootstrapAdmin(input: {
    organizationName: string;
    email: string;
    displayName: string;
  }): Promise<{ user: AuthenticatedUser; activationToken: string }> {
    const normalizedEmail = normalizeEmail(input.email);
    const existing = await this.client.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      throw new AuthError("EMAIL_ALREADY_EXISTS", 409);
    }

    const activationToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(activationToken);
    const result = await this.client.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: { name: input.organizationName },
      });
      const user = await transaction.user.create({
        data: {
          organizationId: organization.id,
          email: normalizedEmail,
          displayName: input.displayName,
          isActive: false,
        },
      });
      await transaction.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "GZIT_PLATFORM_ADMIN",
        },
      });
      await transaction.activationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: addSeconds(new Date(), activationTokenTtlSeconds),
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          action: "auth.bootstrap_platform_admin",
          entityType: "User",
          entityId: user.id,
          result: "SUCCESS",
        },
      });

      return this.findUserForAuth(user.id, transaction);
    });

    return { user: toAuthenticatedUser(result), activationToken };
  }

  async completeActivation(input: {
    token: string;
    password: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const tokenHash = hashOpaqueToken(input.token);
    const result = await this.client.$transaction(async (transaction) => {
      const activation = await transaction.activationToken.findUnique({
        where: { tokenHash },
      });
      if (
        !activation ||
        activation.consumedAt ||
        activation.expiresAt.getTime() <= Date.now()
      ) {
        throw new AuthError("INVALID_OR_EXPIRED_ACTIVATION", 400);
      }

      await transaction.user.update({
        where: { id: activation.userId },
        data: {
          passwordHash: await hashPassword(input.password),
          isActive: true,
        },
      });
      await transaction.activationToken.update({
        where: { id: activation.id },
        data: { consumedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: activation.userId,
          action: "auth.activation.complete",
          entityType: "User",
          entityId: activation.userId,
          result: "SUCCESS",
        },
      });

      return this.findUserForAuth(activation.userId, transaction);
    });

    return {
      user: toAuthenticatedUser(result),
      tokens: await this.createTokens(result.id),
    };
  }

  async login(input: {
    email: string;
    password: string;
    mfaCode?: string;
  }): Promise<{ user: AuthenticatedUser; tokens: AuthTokens }> {
    const user = await this.client.user.findUnique({
      where: { email: normalizeEmail(input.email) },
      include: { memberships: true },
    });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }

    const validPassword = await verifyPassword(
      input.password,
      user.passwordHash,
    );
    if (!validPassword) {
      await this.audit({
        actorUserId: user.id,
        organizationId: user.organizationId ?? undefined,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        result: "FAILED",
      });
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }
    if (user.mfaEnabledAt) {
      if (
        !input.mfaCode ||
        !user.mfaSecret ||
        !verifyTotpCode(user.mfaSecret, input.mfaCode)
      ) {
        await this.audit({
          actorUserId: user.id,
          organizationId: user.organizationId ?? undefined,
          action: "auth.login.mfa",
          entityType: "User",
          entityId: user.id,
          result: "FAILED",
        });
        throw new AuthError("MFA_REQUIRED", 401);
      }
    }

    await this.audit({
      actorUserId: user.id,
      organizationId: user.organizationId ?? undefined,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      result: "SUCCESS",
    });

    return {
      user: toAuthenticatedUser(user),
      tokens: await this.createTokens(user.id),
    };
  }

  async refresh(input: { refreshToken: string }): Promise<AuthTokens> {
    const refreshTokenHash = hashOpaqueToken(input.refreshToken);
    const session = await this.client.session.findUnique({
      where: { refreshTokenHash },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new AuthError("INVALID_REFRESH_TOKEN", 401);
    }

    await this.client.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.createTokens(session.userId);
  }

  async authenticate(
    accessToken: string,
  ): Promise<AuthenticatedUser | undefined> {
    const payload = verifyAccessToken(accessToken);
    if (!payload) {
      return undefined;
    }

    const user = await this.client.user.findUnique({
      where: { id: payload.userId },
      include: { memberships: true },
    });

    return user?.isActive ? toAuthenticatedUser(user) : undefined;
  }

  async requestPasswordReset(input: {
    email: string;
  }): Promise<{ resetToken?: string }> {
    const user = await this.client.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });
    if (!user || !user.isActive) {
      return {};
    }

    const resetToken = createOpaqueToken();
    await this.client.$transaction([
      this.client.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(resetToken),
          expiresAt: addSeconds(new Date(), passwordResetTokenTtlSeconds),
        },
      }),
      this.client.auditLog.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: "auth.password_reset.request",
          entityType: "User",
          entityId: user.id,
          result: "SUCCESS",
        },
      }),
    ]);

    return process.env.NODE_ENV === "production" ? {} : { resetToken };
  }

  async completePasswordReset(input: {
    token: string;
    password: string;
  }): Promise<{ ok: true }> {
    const tokenHash = hashOpaqueToken(input.token);
    await this.client.$transaction(async (transaction) => {
      const reset = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
      });
      if (
        !reset ||
        reset.consumedAt ||
        reset.expiresAt.getTime() <= Date.now()
      ) {
        throw new AuthError("INVALID_OR_EXPIRED_PASSWORD_RESET", 400);
      }

      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await hashPassword(input.password) },
      });
      await transaction.passwordResetToken.update({
        where: { id: reset.id },
        data: { consumedAt: new Date() },
      });
      await transaction.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: reset.userId,
          action: "auth.password_reset.complete",
          entityType: "User",
          entityId: reset.userId,
          result: "SUCCESS",
        },
      });
    });

    return { ok: true };
  }

  async beginMfaSetup(userId: string) {
    const user = await this.client.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AuthError("USER_NOT_FOUND", 404);
    }

    const secret = createTotpSecret();
    await this.client.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabledAt: null },
    });
    await this.audit({
      actorUserId: userId,
      organizationId: user.organizationId ?? undefined,
      action: "auth.mfa.setup",
      entityType: "User",
      entityId: userId,
      result: "SUCCESS",
    });

    return { secret, otpauthUrl: createOtpAuthUrl(user.email, secret) };
  }

  async enableMfa(input: { userId: string; code: string }) {
    const user = await this.client.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new AuthError("USER_NOT_FOUND", 404);
    }
    if (!user.mfaSecret || !verifyTotpCode(user.mfaSecret, input.code)) {
      throw new AuthError("INVALID_MFA_CODE", 400);
    }

    await this.client.user.update({
      where: { id: input.userId },
      data: { mfaEnabledAt: new Date() },
    });
    await this.audit({
      actorUserId: input.userId,
      organizationId: user.organizationId ?? undefined,
      action: "auth.mfa.enable",
      entityType: "User",
      entityId: input.userId,
      result: "SUCCESS",
    });

    return { ok: true as const };
  }

  async disableMfa(input: { userId: string; code: string }) {
    const user = await this.client.user.findUnique({
      where: { id: input.userId },
    });
    if (!user) {
      throw new AuthError("USER_NOT_FOUND", 404);
    }
    if (
      user.mfaEnabledAt &&
      (!user.mfaSecret || !verifyTotpCode(user.mfaSecret, input.code))
    ) {
      throw new AuthError("INVALID_MFA_CODE", 400);
    }

    await this.client.user.update({
      where: { id: input.userId },
      data: { mfaSecret: null, mfaEnabledAt: null },
    });
    await this.audit({
      actorUserId: input.userId,
      organizationId: user.organizationId ?? undefined,
      action: "auth.mfa.disable",
      entityType: "User",
      entityId: input.userId,
      result: "SUCCESS",
    });

    return { ok: true as const };
  }

  private async createTokens(userId: string): Promise<AuthTokens> {
    const refreshToken = createOpaqueToken();
    await this.client.session.create({
      data: {
        userId,
        refreshTokenHash: hashOpaqueToken(refreshToken),
        expiresAt: addSeconds(new Date(), refreshTokenTtlSeconds),
      },
    });

    return {
      accessToken: createAccessToken(userId),
      refreshToken,
      expiresInSeconds: accessTokenTtlSeconds,
    };
  }

  private async audit(input: {
    organizationId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    result: "SUCCESS" | "FAILED";
  }): Promise<void> {
    await this.client.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        result: input.result,
      },
    });
  }

  private async findUserForAuth(
    userId: string,
    client: AuthReadClient = this.client,
  ): Promise<UserWithMemberships> {
    const user = await client.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });
    if (!user) {
      throw new AuthError("USER_NOT_FOUND", 404);
    }

    return user;
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
  mfaCode: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const completePasswordResetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10),
});

const mfaCodeSchema = z.object({
  code: z.string().min(6).max(12),
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

  app.post("/api/v1/auth/password-reset/request", async (request) => {
    const input = requestPasswordResetSchema.parse(request.body);
    return store.requestPasswordReset(input);
  });

  app.post("/api/v1/auth/password-reset/complete", async (request) => {
    const input = completePasswordResetSchema.parse(request.body);
    return store.completePasswordReset(input);
  });

  app.post("/api/v1/auth/mfa/setup", async (request, reply) => {
    const user = await getAuthenticatedUser(store, request);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    if (!isMfaEligible(user)) {
      return reply.code(403).send({ error: "MFA_NOT_ALLOWED" });
    }

    return store.beginMfaSetup(user.id);
  });

  app.post("/api/v1/auth/mfa/enable", async (request, reply) => {
    const user = await getAuthenticatedUser(store, request);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    if (!isMfaEligible(user)) {
      return reply.code(403).send({ error: "MFA_NOT_ALLOWED" });
    }

    const input = mfaCodeSchema.parse(request.body);
    return store.enableMfa({ userId: user.id, code: input.code });
  });

  app.post("/api/v1/auth/mfa/disable", async (request, reply) => {
    const user = await getAuthenticatedUser(store, request);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    if (!isMfaEligible(user)) {
      return reply.code(403).send({ error: "MFA_NOT_ALLOWED" });
    }

    const input = mfaCodeSchema.parse(request.body);
    return store.disableMfa({ userId: user.id, code: input.code });
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const user = await getAuthenticatedUser(store, request);
    if (!user) {
      return reply.code(401).send({ error: "UNAUTHENTICATED" });
    }

    return { user };
  });
}

export async function getAuthenticatedUser(
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

function toAuthenticatedUser(user: UserWithMemberships): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.memberships.map((item) => item.role),
    organizationIds: user.memberships.map((item) => item.organizationId),
  };
}

interface AccessTokenPayload {
  userId: string;
  expiresAt: number;
}

function createAccessToken(userId: string): string {
  const payload: AccessTokenPayload = {
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + accessTokenTtlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signAccessPayload(encodedPayload)}`;
}

function verifyAccessToken(token: string): AccessTokenPayload | undefined {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return undefined;
  }

  const expectedSignature = signAccessPayload(encodedPayload);
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return undefined;
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as AccessTokenPayload;

  return payload.expiresAt > Math.floor(Date.now() / 1000)
    ? payload
    : undefined;
}

function signAccessPayload(encodedPayload: string): string {
  return createHmac("sha256", getAccessTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function createOtpAuthUrl(email: string, secret: string): string {
  const issuer = "GzAccess";
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

function isMfaEligible(user: AuthenticatedUser): boolean {
  return user.roles.some((role) =>
    ["GZIT_PLATFORM_ADMIN", "ORGANIZATION_ADMIN", "BUILDING_ADMIN"].includes(
      role,
    ),
  );
}

function getAccessTokenSecret(): string {
  if (process.env.JWT_ACCESS_SECRET) {
    return process.env.JWT_ACCESS_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AuthError("ACCESS_TOKEN_SECRET_REQUIRED", 500);
  }

  return "gzaccess-dev-access-token-secret";
}
