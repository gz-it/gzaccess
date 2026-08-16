import { describe, expect, it } from "vitest";
import { hasPermission } from "./index.js";

describe("hasPermission", () => {
  it("allows platform admins to manage devices", () => {
    expect(hasPermission(["GZIT_PLATFORM_ADMIN"], "device:manage")).toBe(true);
  });

  it("does not allow residents to manage residents", () => {
    expect(hasPermission(["RESIDENT"], "resident:manage")).toBe(false);
  });
});
