import { describe, expect, it } from "vitest";
import {
  createOpaqueToken,
  hashOpaqueToken,
  hasPermission,
  hashPassword,
  verifyPassword,
} from "./index.js";

describe("hasPermission", () => {
  it("allows platform admins to manage devices", () => {
    expect(hasPermission(["GZIT_PLATFORM_ADMIN"], "device:manage")).toBe(true);
  });

  it("does not allow residents to manage residents", () => {
    expect(hasPermission(["RESIDENT"], "resident:manage")).toBe(false);
  });

  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("S3gura!123");

    expect(hash).not.toContain("S3gura!123");
    await expect(verifyPassword("S3gura!123", hash)).resolves.toBe(true);
    await expect(verifyPassword("otra", hash)).resolves.toBe(false);
  });

  it("hashes opaque tokens deterministically", () => {
    const token = createOpaqueToken();

    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(token)).not.toBe(token);
  });
});
