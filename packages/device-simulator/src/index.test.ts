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
});
