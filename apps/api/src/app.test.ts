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

describe("auth flow", () => {
  it("bootstraps, activates, authenticates, and refreshes a platform admin", async () => {
    const app = buildApp();
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev/bootstrap-platform-admin",
      payload: {
        organizationName: "GZIT",
        email: "Admin@GZIT.test",
        displayName: "GZIT Admin",
      },
    });

    expect(bootstrap.statusCode).toBe(200);
    const bootstrapBody = bootstrap.json<{
      activationToken: string;
      user: { email: string; roles: string[] };
    }>();
    expect(bootstrapBody.user.email).toBe("admin@gzit.test");
    expect(bootstrapBody.user.roles).toContain("GZIT_PLATFORM_ADMIN");

    const activation = await app.inject({
      method: "POST",
      url: "/api/v1/auth/activation/complete",
      payload: {
        token: bootstrapBody.activationToken,
        password: "Password!123",
      },
    });

    expect(activation.statusCode).toBe(200);
    const activationBody = activation.json<{
      tokens: { accessToken: string; refreshToken: string };
    }>();
    expect(activationBody.tokens.accessToken).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${activationBody.tokens.accessToken}`,
      },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      user: { email: "admin@gzit.test" },
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@gzit.test",
        password: "Password!123",
      },
    });

    expect(login.statusCode).toBe(200);

    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {
        refreshToken: activationBody.tokens.refreshToken,
      },
    });

    expect(refresh.statusCode).toBe(200);
    expect(refresh.json()).toMatchObject({ expiresInSeconds: 900 });
  });

  it("rejects invalid credentials", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "missing@gzit.test",
        password: "wrong",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "INVALID_CREDENTIALS" });
  });

  it("resets a password and revokes previous refresh tokens", async () => {
    const app = buildApp();
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev/bootstrap-platform-admin",
      payload: {
        organizationName: "GZIT",
        email: "reset@gzit.test",
        displayName: "Reset Admin",
      },
    });
    const activationToken = bootstrap.json<{ activationToken: string }>()
      .activationToken;

    const activation = await app.inject({
      method: "POST",
      url: "/api/v1/auth/activation/complete",
      payload: {
        token: activationToken,
        password: "Password!123",
      },
    });
    const oldRefreshToken = activation.json<{
      tokens: { refreshToken: string };
    }>().tokens.refreshToken;

    const requestReset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/request",
      payload: {
        email: "reset@gzit.test",
      },
    });

    expect(requestReset.statusCode).toBe(200);
    const resetToken = requestReset.json<{ resetToken: string }>().resetToken;
    expect(resetToken).toBeTruthy();

    const completeReset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password-reset/complete",
      payload: {
        token: resetToken,
        password: "NewPassword!123",
      },
    });

    expect(completeReset.statusCode).toBe(200);

    const oldRefresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: { refreshToken: oldRefreshToken },
    });
    expect(oldRefresh.statusCode).toBe(401);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset@gzit.test",
        password: "Password!123",
      },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "reset@gzit.test",
        password: "NewPassword!123",
      },
    });
    expect(newLogin.statusCode).toBe(200);
  });
});
