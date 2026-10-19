import { describe, expect, it } from "vitest";
import { hashPassword, validateEmail, validateLogicalAge, validatePassword, verifyPassword } from "./authUtils";

describe("persistent account password hashing", () => {
  it("accepts the original password and rejects a different password", () => {
    const storedHash = hashPassword("long-enough-password1");
    expect(verifyPassword("long-enough-password1", storedHash)).toBe(true);
    expect(verifyPassword("incorrect-password1", storedHash)).toBe(false);
  });
  it("rejects malformed stored password data", () => {
    expect(verifyPassword("any-password1", "not-a-valid-hash")).toBe(false);
  });
});

describe("account safeguards", () => {
  it("requires a bounded, mixed-character password and valid email", () => {
    expect(validatePassword("short1")).toBe(false);
    expect(validatePassword("letters-only-password")).toBe(false);
    expect(validatePassword("secure-password1")).toBe(true);
    expect(validateEmail("person@example.org")).toBe(true);
    expect(validateEmail("not-an-email")).toBe(false);
  });
  it("rejects impossible dates and ages outside the logical range", () => {
    const asOf = new Date("2026-09-04T00:00:00.000Z");
    expect(validateLogicalAge("2027-01-01", asOf).valid).toBe(false);
    expect(validateLogicalAge("1900-01-01", asOf).valid).toBe(false);
    expect(validateLogicalAge("2000-01-01", asOf).valid).toBe(true);
    expect(validateLogicalAge("2026-02-30", asOf).valid).toBe(false);
  });
});
