import type {
  AccessDecision,
  AccessDecisionReason,
  AccessGrant,
  DeviceCapability,
  DeviceDescriptor,
  DeviceDriver,
  NormalizedDeviceResult,
} from "@gzaccess/device-core";

interface SimulatedCredential {
  id: string;
  personId: string;
  state: "ACTIVE" | "REVOKED";
}

export class SimulatedDeviceDriver implements DeviceDriver {
  readonly descriptor: DeviceDescriptor;
  private readonly credentials = new Map<string, SimulatedCredential>();
  private accessGrants: AccessGrant[] = [];
  private online = true;

  constructor(descriptor?: Partial<DeviceDescriptor>) {
    this.descriptor = {
      id: descriptor?.id ?? "sim-device-1",
      brand: descriptor?.brand ?? "GzAccess Simulator",
      model: descriptor?.model ?? "SIM-ACCESS-1",
      firmware: descriptor?.firmware ?? "1.0.0",
      capabilities: descriptor?.capabilities ?? [
        "FACE_ENROLLMENT",
        "LICENSE_PLATE_ENROLLMENT",
        "QR_ENROLLMENT",
        "DEVICE_HEALTH",
        "OFFLINE_AUTHORIZATION",
      ],
    };
  }

  setOnline(online: boolean): void {
    this.online = online;
  }

  setAccessGrants(grants: AccessGrant[]): void {
    this.accessGrants = grants;
  }

  async enrollCredential(input: {
    personId: string;
    credentialId: string;
    kind: DeviceCapability;
  }): Promise<NormalizedDeviceResult> {
    if (!this.online) {
      return { ok: false, safeMessage: "Device simulator is offline" };
    }

    if (!this.descriptor.capabilities.includes(input.kind)) {
      return {
        ok: false,
        safeMessage: "Capability not supported by simulated device",
      };
    }

    this.credentials.set(input.credentialId, {
      id: input.credentialId,
      personId: input.personId,
      state: "ACTIVE",
    });
    return {
      ok: true,
      externalId: `${this.descriptor.id}:${input.credentialId}`,
    };
  }

  async revokeCredential(input: {
    credentialId: string;
  }): Promise<NormalizedDeviceResult> {
    const credential = this.credentials.get(input.credentialId);
    if (credential) {
      this.credentials.set(input.credentialId, {
        ...credential,
        state: "REVOKED",
      });
    }
    return { ok: true };
  }

  async getHealth(): Promise<NormalizedDeviceResult> {
    return this.online
      ? { ok: true }
      : { ok: false, safeMessage: "Device simulator is offline" };
  }

  async simulateAccessAttempt(input: {
    credentialId: string;
    accessPointId: string;
    now?: Date;
  }): Promise<AccessDecision> {
    if (!this.online) {
      return {
        accessPointId: input.accessPointId,
        allowed: false,
        credentialId: input.credentialId,
        reason: "DEVICE_OFFLINE",
      };
    }

    return evaluateSimulatedAccessAttempt({
      accessPointId: input.accessPointId,
      credentialId: input.credentialId,
      credentials: [...this.credentials.values()],
      grants: this.accessGrants,
      now: input.now,
    });
  }
}

function evaluateSimulatedAccessAttempt(input: {
  credentialId: string;
  accessPointId: string;
  now?: Date;
  credentials: SimulatedCredential[];
  grants: AccessGrant[];
}): AccessDecision {
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
    accessPointId: input.accessPointId,
    allowed: true,
    credentialId: credential.id,
    personId: credential.personId,
    reason: "ALLOWED",
  };
}

function deny(
  input: {
    credentialId: string;
    accessPointId: string;
  },
  reason: Exclude<AccessDecisionReason, "ALLOWED">,
  personId?: string,
): AccessDecision {
  return {
    accessPointId: input.accessPointId,
    allowed: false,
    credentialId: input.credentialId,
    personId,
    reason,
  };
}
