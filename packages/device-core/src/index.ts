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
