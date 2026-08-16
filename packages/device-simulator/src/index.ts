import type {
  DeviceCapability,
  DeviceDescriptor,
  DeviceDriver,
  NormalizedDeviceResult,
} from "@gzaccess/device-core";

export class SimulatedDeviceDriver implements DeviceDriver {
  readonly descriptor: DeviceDescriptor;
  private readonly credentials = new Set<string>();
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

    this.credentials.add(input.credentialId);
    return {
      ok: true,
      externalId: `${this.descriptor.id}:${input.credentialId}`,
    };
  }

  async revokeCredential(input: {
    credentialId: string;
  }): Promise<NormalizedDeviceResult> {
    this.credentials.delete(input.credentialId);
    return { ok: true };
  }

  async getHealth(): Promise<NormalizedDeviceResult> {
    return this.online
      ? { ok: true }
      : { ok: false, safeMessage: "Device simulator is offline" };
  }
}
