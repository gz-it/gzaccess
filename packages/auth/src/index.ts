import {
  createHmac,
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

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function createTotpCode(
  secret: string,
  date = new Date(),
  stepSeconds = 30,
): string {
  const counter = Math.floor(date.getTime() / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  date = new Date(),
  windowSteps = 1,
): boolean {
  const normalizedCode = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
    const candidate = createTotpCode(
      secret,
      new Date(date.getTime() + offset * 30_000),
    );
    const actual = Buffer.from(normalizedCode);
    const expected = Buffer.from(candidate);
    if (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    ) {
      return true;
    }
  }

  return false;
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of clean) {
    const index = base32Alphabet.indexOf(char);
    if (index < 0) {
      throw new Error("INVALID_TOTP_SECRET");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}
