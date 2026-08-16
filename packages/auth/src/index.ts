import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { AuthenticatedUser, EntityId, Role } from "@gzaccess/contracts";

export const permissions = [
  "organization:manage",
  "building:manage",
  "resident:manage",
  "security:operate",
  "audit:read",
  "device:manage",
  "self:manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<Role, Permission[]> = {
  GZIT_PLATFORM_ADMIN: [...permissions],
  GZIT_TECHNICIAN: ["device:manage", "audit:read"],
  ORGANIZATION_ADMIN: [
    "organization:manage",
    "building:manage",
    "resident:manage",
    "audit:read",
  ],
  BUILDING_ADMIN: ["building:manage", "resident:manage", "audit:read"],
  SECURITY_OPERATOR: ["security:operate"],
  RESIDENT: ["self:manage"],
  AUDITOR: ["audit:read"],
};

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some((role) =>
    (rolePermissions[role] ?? []).includes(permission),
  );
}

export function getPermissionsForRoles(roles: Role[]): Permission[] {
  return [...new Set(roles.flatMap((role) => rolePermissions[role] ?? []))];
}

export function canAccessOrganization(
  user: AuthenticatedUser,
  organizationId: EntityId,
): boolean {
  return (
    hasPermission(user.roles, "organization:manage") &&
    user.organizationIds.includes(organizationId)
  );
}

export function requirePermission(
  user: AuthenticatedUser,
  permission: Permission,
): void {
  if (!hasPermission(user.roles, permission)) {
    throw new AuthorizationError("FORBIDDEN");
  }
}

export function requireOrganizationAccess(
  user: AuthenticatedUser,
  organizationId: EntityId,
): void {
  if (!canAccessOrganization(user, organizationId)) {
    throw new AuthorizationError("ORGANIZATION_FORBIDDEN");
  }
}

export class AuthorizationError extends Error {
  constructor(readonly code: "FORBIDDEN" | "ORGANIZATION_FORBIDDEN") {
    super(code);
  }
}

const scrypt = promisify(scryptCallback);
const passwordHashVersion = "scrypt-v1";
const passwordKeyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(
    password,
    salt,
    passwordKeyLength,
  )) as Buffer;

  return [passwordHashVersion, salt, derivedKey.toString("base64url")].join(
    "$",
  );
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [version, salt, expectedKey] = storedHash.split("$");
  if (version !== passwordHashVersion || !salt || !expectedKey) {
    return false;
  }

  const actual = (await scrypt(password, salt, passwordKeyLength)) as Buffer;
  const expected = Buffer.from(expectedKey, "base64url");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
