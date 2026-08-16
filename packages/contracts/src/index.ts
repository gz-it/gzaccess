export type EntityId = string;

export const roles = [
  "GZIT_PLATFORM_ADMIN",
  "GZIT_TECHNICIAN",
  "ORGANIZATION_ADMIN",
  "BUILDING_ADMIN",
  "SECURITY_OPERATOR",
  "RESIDENT",
  "AUDITOR",
] as const;

export type Role = (typeof roles)[number];

export const syncJobStates = [
  "QUEUED",
  "SENT_TO_EDGE",
  "RUNNING",
  "SUCCEEDED",
  "PARTIAL",
  "RETRYING",
  "FAILED",
  "CANCELLED",
  "SUPERSEDED",
] as const;

export type SyncJobState = (typeof syncJobStates)[number];

export const credentialStates = [
  "PENDING",
  "SYNCING",
  "ACTIVE",
  "PARTIAL",
  "ERROR",
  "REVOKED",
] as const;

export type CredentialState = (typeof credentialStates)[number];

export interface TenantScope {
  organizationId: EntityId;
  buildingId?: EntityId;
}

export interface HealthResponse {
  service: string;
  status: "ok";
  version: string;
  timestamp: string;
}

export interface AuthenticatedUser {
  id: EntityId;
  email: string;
  displayName: string;
  roles: Role[];
  organizationIds: EntityId[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}
