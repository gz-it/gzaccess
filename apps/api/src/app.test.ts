import { describe, expect, it } from "vitest";
import { createTotpCode } from "@gzaccess/auth";
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

  it("configures TOTP MFA for platform admins", async () => {
    const app = buildApp();
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/dev/bootstrap-platform-admin",
      payload: {
        organizationName: "GZIT",
        email: "mfa@gzit.test",
        displayName: "MFA Admin",
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
    const accessToken = activation.json<{
      tokens: { accessToken: string };
    }>().tokens.accessToken;

    const setup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/setup",
      headers: authHeaders(accessToken),
    });
    expect(setup.statusCode).toBe(200);
    const secret = setup.json<{ secret: string; otpauthUrl: string }>().secret;
    expect(setup.json<{ otpauthUrl: string }>().otpauthUrl).toContain(
      "otpauth://totp/",
    );

    const code = createTotpCode(secret);
    const enabled = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/enable",
      headers: authHeaders(accessToken),
      payload: { code },
    });
    expect(enabled.statusCode).toBe(200);

    const blockedLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa@gzit.test",
        password: "Password!123",
      },
    });
    expect(blockedLogin.statusCode).toBe(401);
    expect(blockedLogin.json()).toMatchObject({ error: "MFA_REQUIRED" });

    const mfaLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa@gzit.test",
        password: "Password!123",
        mfaCode: createTotpCode(secret),
      },
    });
    expect(mfaLogin.statusCode).toBe(200);

    const disabled = await app.inject({
      method: "POST",
      url: "/api/v1/auth/mfa/disable",
      headers: authHeaders(accessToken),
      payload: { code: createTotpCode(secret) },
    });
    expect(disabled.statusCode).toBe(200);

    const loginWithoutMfa = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "mfa@gzit.test",
        password: "Password!123",
      },
    });
    expect(loginWithoutMfa.statusCode).toBe(200);
  });
});

describe("building administration", () => {
  it("creates buildings, units, and resident invitations inside one organization", async () => {
    const app = buildApp();
    const { accessToken, organizationId } = await createActivatedAdmin(
      app,
      "buildings@gzit.test",
    );

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(accessToken),
      payload: {
        organizationId,
        name: "Torre Norte",
        address: "Av. Siempre Viva 123",
        timezone: "America/Buenos_Aires",
      },
    });
    expect(building.statusCode).toBe(200);
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${organizationId}/buildings`,
      headers: authHeaders(accessToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      buildings: [{ id: buildingId, name: "Torre Norte" }],
    });

    const floor = await app.inject({
      method: "POST",
      url: "/api/v1/floors",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        name: "Piso 4",
        sortOrder: 4,
      },
    });
    expect(floor.statusCode).toBe(200);
    const floorId = floor.json<{ floor: { id: string } }>().floor.id;

    const listedFloors = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/floors`,
      headers: authHeaders(accessToken),
    });
    expect(listedFloors.statusCode).toBe(200);
    expect(listedFloors.json()).toMatchObject({
      floors: [{ id: floorId, name: "Piso 4", sortOrder: 4 }],
    });

    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        floorId,
        label: "4A",
      },
    });
    expect(unit.statusCode).toBe(200);
    const unitId = unit.json<{ unit: { id: string } }>().unit.id;

    const listedUnits = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/units`,
      headers: authHeaders(accessToken),
    });
    expect(listedUnits.statusCode).toBe(200);
    expect(listedUnits.json()).toMatchObject({
      units: [{ id: unitId, label: "4A", buildingId, floorName: "Piso 4" }],
    });

    const parkingSpace = await app.inject({
      method: "POST",
      url: "/api/v1/parking-spaces",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        floorId,
        unitId,
        label: "Cochera 12",
      },
    });
    expect(parkingSpace.statusCode).toBe(200);
    const parkingSpaceId = parkingSpace.json<{ parkingSpace: { id: string } }>()
      .parkingSpace.id;

    const listedParkingSpaces = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/parking-spaces`,
      headers: authHeaders(accessToken),
    });
    expect(listedParkingSpaces.statusCode).toBe(200);
    expect(listedParkingSpaces.json()).toMatchObject({
      parkingSpaces: [
        {
          id: parkingSpaceId,
          label: "Cochera 12",
          floorName: "Piso 4",
          unitLabel: "4A",
        },
      ],
    });

    const resident = await app.inject({
      method: "POST",
      url: "/api/v1/residents",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        unitId,
        firstName: "Ada",
        lastName: "Lovelace",
        documentNumber: "12345678",
        email: "ada@example.test",
      },
    });

    expect(resident.statusCode).toBe(200);
    expect(resident.json()).toMatchObject({
      personId: expect.any(String),
      userId: expect.any(String),
      activationToken: expect.any(String),
      emailId: expect.any(String),
    });

    const emailOutbox = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/email-outbox`,
      headers: authHeaders(accessToken),
    });
    expect(emailOutbox.statusCode).toBe(200);
    expect(emailOutbox.json()).toMatchObject({
      emails: [
        {
          buildingId,
          recipientEmail: "ada@example.test",
          subject: "Activa tu acceso a GzAccess",
          template: "resident_activation",
          status: "QUEUED",
        },
      ],
    });

    const listedResidents = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/residents`,
      headers: authHeaders(accessToken),
    });
    expect(listedResidents.statusCode).toBe(200);
    expect(listedResidents.json()).toMatchObject({
      residents: [
        {
          firstName: "Ada",
          lastName: "Lovelace",
          documentNumber: "12345678",
          email: "ada@example.test",
          unitId,
          unitLabel: "4A",
        },
      ],
    });
  });

  it("blocks cross-organization building access", async () => {
    const app = buildApp();
    const adminA = await createActivatedAdmin(app, "admin-a@gzit.test");
    const adminB = await createActivatedAdmin(app, "admin-b@gzit.test");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(adminA.accessToken),
      payload: {
        organizationId: adminB.organizationId,
        name: "Torre Ajena",
        address: "Otra calle 456",
        timezone: "America/Buenos_Aires",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "ORGANIZATION_FORBIDDEN" });
  });

  it("blocks cross-organization unit listing", async () => {
    const app = buildApp();
    const adminA = await createActivatedAdmin(app, "units-a@gzit.test");
    const adminB = await createActivatedAdmin(app, "units-b@gzit.test");

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(adminA.accessToken),
      payload: {
        organizationId: adminA.organizationId,
        name: "Torre Privada",
        address: "Calle Uno 100",
        timezone: "America/Buenos_Aires",
      },
    });
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/units`,
      headers: authHeaders(adminB.accessToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "ORGANIZATION_FORBIDDEN" });
  });

  it("blocks cross-organization floor listing", async () => {
    const app = buildApp();
    const adminA = await createActivatedAdmin(app, "floors-a@gzit.test");
    const adminB = await createActivatedAdmin(app, "floors-b@gzit.test");

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(adminA.accessToken),
      payload: {
        organizationId: adminA.organizationId,
        name: "Torre Pisos",
        address: "Calle Tres 300",
        timezone: "America/Buenos_Aires",
      },
    });
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/floors`,
      headers: authHeaders(adminB.accessToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "ORGANIZATION_FORBIDDEN" });
  });

  it("blocks cross-organization resident listing", async () => {
    const app = buildApp();
    const adminA = await createActivatedAdmin(app, "residents-a@gzit.test");
    const adminB = await createActivatedAdmin(app, "residents-b@gzit.test");

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(adminA.accessToken),
      payload: {
        organizationId: adminA.organizationId,
        name: "Torre Residentes",
        address: "Calle Dos 200",
        timezone: "America/Buenos_Aires",
      },
    });
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/residents`,
      headers: authHeaders(adminB.accessToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "ORGANIZATION_FORBIDDEN" });
  });

  it("blocks cross-organization parking listing", async () => {
    const app = buildApp();
    const adminA = await createActivatedAdmin(app, "parking-a@gzit.test");
    const adminB = await createActivatedAdmin(app, "parking-b@gzit.test");

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(adminA.accessToken),
      payload: {
        organizationId: adminA.organizationId,
        name: "Torre Cocheras",
        address: "Calle Cuatro 400",
        timezone: "America/Buenos_Aires",
      },
    });
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/parking-spaces`,
      headers: authHeaders(adminB.accessToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "ORGANIZATION_FORBIDDEN" });
  });

  it("imports residents in batches", async () => {
    const app = buildApp();
    const { accessToken, organizationId } = await createActivatedAdmin(
      app,
      "imports@gzit.test",
    );

    const building = await app.inject({
      method: "POST",
      url: "/api/v1/buildings",
      headers: authHeaders(accessToken),
      payload: {
        organizationId,
        name: "Torre Import",
        address: "Calle Cinco 500",
        timezone: "America/Buenos_Aires",
      },
    });
    const buildingId = building.json<{ building: { id: string } }>().building
      .id;

    const unit = await app.inject({
      method: "POST",
      url: "/api/v1/units",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        label: "8B",
      },
    });
    const unitId = unit.json<{ unit: { id: string } }>().unit.id;

    const imported = await app.inject({
      method: "POST",
      url: "/api/v1/residents/import",
      headers: authHeaders(accessToken),
      payload: {
        buildingId,
        residents: [
          {
            unitId,
            firstName: "Grace",
            lastName: "Hopper",
            email: "grace@example.test",
          },
          {
            firstName: "Mary",
            lastName: "Jackson",
            documentNumber: "87654321",
          },
        ],
      },
    });

    expect(imported.statusCode).toBe(200);
    expect(imported.json()).toMatchObject({
      importedCount: 2,
      failedCount: 0,
      imported: [
        {
          personId: expect.any(String),
          activationToken: expect.any(String),
          emailId: expect.any(String),
        },
        { personId: expect.any(String) },
      ],
    });

    const emailOutbox = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/email-outbox`,
      headers: authHeaders(accessToken),
    });
    expect(emailOutbox.statusCode).toBe(200);
    expect(
      emailOutbox
        .json<{ emails: Array<{ recipientEmail: string }> }>()
        .emails.map((email) => ({ recipientEmail: email.recipientEmail })),
    ).toEqual([{ recipientEmail: "grace@example.test" }]);

    const listedResidents = await app.inject({
      method: "GET",
      url: `/api/v1/buildings/${buildingId}/residents`,
      headers: authHeaders(accessToken),
    });
    expect(listedResidents.statusCode).toBe(200);
    expect(listedResidents.json()).toMatchObject({
      residents: [
        { firstName: "Grace", lastName: "Hopper", unitLabel: "8B" },
        { firstName: "Mary", lastName: "Jackson" },
      ],
    });
  });
});

async function createActivatedAdmin(
  app: ReturnType<typeof buildApp>,
  email: string,
) {
  const bootstrap = await app.inject({
    method: "POST",
    url: "/api/v1/auth/dev/bootstrap-platform-admin",
    payload: {
      organizationName: `Org ${email}`,
      email,
      displayName: email,
    },
  });
  const bootstrapBody = bootstrap.json<{
    activationToken: string;
    user: { organizationIds: string[] };
  }>();
  const activation = await app.inject({
    method: "POST",
    url: "/api/v1/auth/activation/complete",
    payload: {
      token: bootstrapBody.activationToken,
      password: "Password!123",
    },
  });
  const activationBody = activation.json<{
    tokens: { accessToken: string };
  }>();

  return {
    accessToken: activationBody.tokens.accessToken,
    organizationId: bootstrapBody.user.organizationIds[0],
  };
}

function authHeaders(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}
