export const deviceCapabilities = [
  "FACE_ENROLLMENT",
  "LICENSE_PLATE_ENROLLMENT",
  "CARD_ENROLLMENT",
  "PIN_ENROLLMENT",
  "QR_ENROLLMENT",
  "REMOTE_DOOR_COMMAND",
  "ACCESS_EVENT_PULL",
  "ACCESS_EVENT_PUSH",
  "DEVICE_HEALTH",
  "OFFLINE_AUTHORIZATION",
] as const;

export type DeviceCapability = (typeof deviceCapabilities)[number];

export interface NormalizedDeviceResult {
  ok: boolean;
  externalId?: string;
  safeMessage?: string;
}

export interface DeviceDescriptor {
  id: string;
  brand: string;
  model: string;
  firmware?: string;
  capabilities: DeviceCapability[];
}

export interface DeviceDriver {
  readonly descriptor: DeviceDescriptor;
  enrollCredential(input: {
    personId: string;
    credentialId: string;
    kind: DeviceCapability;
  }): Promise<NormalizedDeviceResult>;
  revokeCredential(input: {
    credentialId: string;
  }): Promise<NormalizedDeviceResult>;
  getHealth(): Promise<NormalizedDeviceResult>;
}

export type AccessDecisionReason =
  | "ALLOWED"
  | "CREDENTIAL_NOT_FOUND"
  | "CREDENTIAL_NOT_ACTIVE"
  | "CREDENTIAL_NOT_YET_VALID"
  | "CREDENTIAL_EXPIRED"
  | "ACCESS_POINT_NOT_ALLOWED"
  | "DEVICE_OFFLINE";

export interface AccessCredential {
  id: string;
  personId: string;
  state: "PENDING" | "SYNCING" | "ACTIVE" | "PARTIAL" | "ERROR" | "REVOKED";
  validFrom?: Date;
  validUntil?: Date;
}

export interface AccessGrant {
  personId: string;
  accessPointId: string;
  active: boolean;
  validFrom?: Date;
  validUntil?: Date;
}

export interface AccessEvaluationInput {
  credentialId: string;
  accessPointId: string;
  now?: Date;
  credentials: AccessCredential[];
  grants: AccessGrant[];
}

export interface AccessDecision {
  allowed: boolean;
  reason: AccessDecisionReason;
  personId?: string;
  credentialId?: string;
  accessPointId: string;
}

export function evaluateAccessAttempt(
  input: AccessEvaluationInput,
): AccessDecision {
  const now = input.now ?? new Date();
  const credential = input.credentials.find(
    (candidate) => candidate.id === input.credentialId,
  );

  if (!credential) {
    return deny(input, "CREDENTIAL_NOT_FOUND");
  }

  if (credential.state !== "ACTIVE") {
    return deny(input, "CREDENTIAL_NOT_ACTIVE", credential.personId);
  }

  if (credential.validFrom && credential.validFrom > now) {
    return deny(input, "CREDENTIAL_NOT_YET_VALID", credential.personId);
  }

  if (credential.validUntil && credential.validUntil < now) {
    return deny(input, "CREDENTIAL_EXPIRED", credential.personId);
  }

  const grant = input.grants.find(
    (candidate) =>
      candidate.personId === credential.personId &&
      candidate.accessPointId === input.accessPointId &&
      candidate.active &&
      (!candidate.validFrom || candidate.validFrom <= now) &&
      (!candidate.validUntil || candidate.validUntil >= now),
  );

  if (!grant) {
    return deny(input, "ACCESS_POINT_NOT_ALLOWED", credential.personId);
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    personId: credential.personId,
    credentialId: credential.id,
    accessPointId: input.accessPointId,
  };
}

function deny(
  input: AccessEvaluationInput,
  reason: Exclude<AccessDecisionReason, "ALLOWED">,
  personId?: string,
): AccessDecision {
  return {
    allowed: false,
    reason,
    personId,
    credentialId: input.credentialId,
    accessPointId: input.accessPointId,
  };
}
