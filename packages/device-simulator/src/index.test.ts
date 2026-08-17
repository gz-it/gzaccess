import { describe, expect, it } from "vitest";
import { SimulatedDeviceDriver } from "./index.js";

describe("SimulatedDeviceDriver", () => {
  it("enrolls supported credentials", async () => {
    const driver = new SimulatedDeviceDriver();
    await expect(
      driver.enrollCredential({
        personId: "person-1",
        credentialId: "cred-1",
        kind: "FACE_ENROLLMENT",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("returns safe errors when offline", async () => {
    const driver = new SimulatedDeviceDriver();
    driver.setOnline(false);
    await expect(driver.getHealth()).resolves.toMatchObject({
      ok: false,
      safeMessage: "Device simulator is offline",
    });
  });

  it("simulates an allowed access attempt", async () => {
    const driver = new SimulatedDeviceDriver();
    await driver.enrollCredential({
      personId: "person-1",
      credentialId: "cred-1",
      kind: "QR_ENROLLMENT",
    });
    driver.setAccessGrants([
      {
        accessPointId: "door-main",
        active: true,
        personId: "person-1",
      },
    ]);

    await expect(
      driver.simulateAccessAttempt({
        accessPointId: "door-main",
        credentialId: "cred-1",
      }),
    ).resolves.toMatchObject({
      allowed: true,
      reason: "ALLOWED",
    });
  });

  it("simulates a denied access attempt", async () => {
    const driver = new SimulatedDeviceDriver();
    await driver.enrollCredential({
      personId: "person-1",
      credentialId: "cred-1",
      kind: "QR_ENROLLMENT",
    });

    await expect(
      driver.simulateAccessAttempt({
        accessPointId: "garage",
        credentialId: "cred-1",
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "ACCESS_POINT_NOT_ALLOWED",
    });
  });

  it("simulates an offline denial", async () => {
    const driver = new SimulatedDeviceDriver();
    driver.setOnline(false);

    await expect(
      driver.simulateAccessAttempt({
        accessPointId: "door-main",
        credentialId: "cred-1",
      }),
    ).resolves.toMatchObject({
      allowed: false,
      reason: "DEVICE_OFFLINE",
    });
  });
});
