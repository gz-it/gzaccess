import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  canAccessOrganization,
  createOpaqueToken,
  getPermissionsForRoles,
  hashOpaqueToken,
  hasPermission,
  hashPassword,
  requireOrganizationAccess,
  requirePermission,
  verifyPassword,
} from "./index.js";
import type { AuthenticatedUser } from "@gzaccess/contracts";

describe("hasPermission", () => {
  it("allows platform admins to manage devices", () => {
    expect(hasPermission(["GZIT_PLATFORM_ADMIN"], "device:manage")).toBe(true);
  });

  it("does not allow residents to manage residents", () => {
    expect(hasPermission(["RESIDENT"], "resident:manage")).toBe(false);
  });

  it("deduplicates permissions across multiple roles", () => {
    expect(
      getPermissionsForRoles(["ORGANIZATION_ADMIN", "BUILDING_ADMIN"]),
    ).toEqual(
      expect.arrayContaining([
        "organization:manage",
        "building:manage",
        "resident:manage",
        "audit:read",
      ]),
    );
  });

  it("allows organization access only inside assigned tenants", () => {
    const user: AuthenticatedUser = {
      id: "user-1",
      email: "admin@gzit.test",
      displayName: "Admin",
      roles: ["ORGANIZATION_ADMIN"],
      organizationIds: ["org-1"],
    };

    expect(canAccessOrganization(user, "org-1")).toBe(true);
    expect(canAccessOrganization(user, "org-2")).toBe(false);
  });

  it("throws explicit authorization errors", () => {
    const user: AuthenticatedUser = {
      id: "user-1",
      email: "resident@gzit.test",
      displayName: "Resident",
      roles: ["RESIDENT"],
      organizationIds: ["org-1"],
    };

    expect(() => requirePermission(user, "resident:manage")).toThrow(
      AuthorizationError,
    );
    expect(() => requireOrganizationAccess(user, "org-1")).toThrow(
      AuthorizationError,
    );
  });

  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("S3gura!123");

    expect(hash).not.toContain("S3gura!123");
    await expect(verifyPassword("S3gura!123", hash)).resolves.toBe(true);
    await expect(verifyPassword("otra", hash)).resolves.toBe(false);
  });

  it("hashes opaque tokens deterministically", () => {
    const token = createOpaqueToken();

    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toBe(token);
  });
});
