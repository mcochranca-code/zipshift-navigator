import { describe, expect, it } from "vitest";
import { isCoveredZip, presentAggregateDemand } from "./zipAnalytics";

describe("covered-ZIP analytics privacy controls", () => {
  it("accepts only ZIP codes within the published service area", () => {
    expect(isCoveredZip("95380")).toBe(true);
    expect(isCoveredZip("99999")).toBe(false);
  });

  it("suppresses cohorts below the minimum reporting threshold", () => {
    expect(presentAggregateDemand("95380", 2)).toEqual({ zipCode: "95380", searchCount: null, suppressed: true });
    expect(presentAggregateDemand("95380", 3)).toEqual({ zipCode: "95380", searchCount: 3, suppressed: false });
  });
});
