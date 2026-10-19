import { describe, expect, it } from "vitest";
import { isSafeKey, normalizeResearchValueList } from "./index";

describe("research configuration validation", () => {
  it("accepts stable lower-case configuration keys and rejects unsafe keys", () => {
    expect(isSafeKey("housing_status")).toBe(true);
    expect(isSafeKey("age2")).toBe(true);
    expect(isSafeKey("Aged")).toBe(false);
    expect(isSafeKey("x")).toBe(false);
    expect(isSafeKey("javascript:alert(1)")).toBe(false);
  });

  it("normalizes only bounded scalar permissible values", () => {
    expect(normalizeResearchValueList(undefined)).toEqual([]);
    expect(normalizeResearchValueList(["yes", "no", 1, false])).toEqual(["yes", "no", 1, false]);
    expect(normalizeResearchValueList([{ unsafe: true }])).toBeNull();
    expect(normalizeResearchValueList(Array.from({ length: 101 }, (_, index) => index))).toBeNull();
  });
});
