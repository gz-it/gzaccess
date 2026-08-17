import { describe, expect, it } from "vitest";
import { evaluateAccessAttempt } from "./index.js";

const now = new Date("2026-08-17T12:00:00.000Z");

describe("evaluateAccessAttempt", () => {
  it("allows active credentials with an active grant", () => {
    expect(
      evaluateAccessAttempt({
        accessPointId: "door-main",
        credentialId: "cred-1",
        now,
        credentials: [
          {
            id: "cred-1",
            personId: "person-1",
            state: "ACTIVE",
          },
        ],
        grants: [
          {
            accessPointId: "door-main",
            active: true,
            personId: "person-1",
          },
        ],
      }),
    ).toMatchObject({
      allowed: true,
      reason: "ALLOWED",
      personId: "person-1",
    });
  });

  it("denies inactive credentials", () => {
    expect(
      evaluateAccessAttempt({
        accessPointId: "door-main",
        credentialId: "cred-1",
        now,
        credentials: [
          {
            id: "cred-1",
            personId: "person-1",
            state: "PENDING",
          },
        ],
        grants: [
          {
            accessPointId: "door-main",
            active: true,
            personId: "person-1",
          },
        ],
      }),
    ).toMatchObject({
      allowed: false,
      reason: "CREDENTIAL_NOT_ACTIVE",
    });
  });

  it("denies credentials without an access point grant", () => {
    expect(
      evaluateAccessAttempt({
        accessPointId: "garage",
        credentialId: "cred-1",
        now,
        credentials: [
          {
            id: "cred-1",
            personId: "person-1",
            state: "ACTIVE",
          },
        ],
        grants: [
          {
            accessPointId: "door-main",
            active: true,
            personId: "person-1",
          },
        ],
      }),
    ).toMatchObject({
      allowed: false,
      reason: "ACCESS_POINT_NOT_ALLOWED",
    });
  });
});
