import type { Role } from "@gzaccess/contracts";

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
