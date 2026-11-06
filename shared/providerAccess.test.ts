import { describe, expect, it } from "vitest";
import providers from "../client/src/data/providers.json";
import { acceptsWalkIns, documentsToBring, hoursStatus, isVerified, noIdRequired, parseWeeklyHours } from "./providerAccess";

// 2026-11-04 is a Wednesday; 2026-11-07 is a Saturday.
const wednesday = (hour: number, minute = 0) => new Date(2026, 10, 4, hour, minute);
const saturday = new Date(2026, 10, 7, 10, 0);

describe("hoursStatus", () => {
  it("parses simple weekday schedules", () => {
    expect(hoursStatus("Mon-Fri 8am-5pm per public sources", wednesday(9))).toEqual({ state: "open", closesAt: "5 PM" });
    expect(hoursStatus("Mon-Fri 8am-5pm", wednesday(17, 30)).state).toBe("closed");
    expect(hoursStatus("Mon-Fri 8am-5pm", saturday).state).toBe("closed");
  });
  it("handles split schedules", () => {
    expect(hoursStatus("Mon-Fri 9am-12:30pm and 1pm-4pm", wednesday(12, 45)).state).toBe("closed");
    expect(hoursStatus("Mon-Fri 9am-12:30pm and 1pm-4pm", wednesday(10))).toEqual({ state: "open", closesAt: "12:30 PM" });
  });
  it("says unknown instead of guessing when hours vary or must be confirmed", () => {
    expect(hoursStatus("Call to confirm current shelter intake and meal schedule", wednesday(9)).state).toBe("unknown");
    expect(hoursStatus("Access Center Mon-Fri 8am-5pm; shelter schedule must be verified", wednesday(9)).state).toBe("unknown");
    expect(hoursStatus("Operations 24/7; admin Mon-Fri 9am-5pm; meal/shelter cutoffs vary", wednesday(9)).state).toBe("unknown");
    expect(hoursStatus("", wednesday(9)).state).toBe("unknown");
    expect(hoursStatus("24/7", saturday)).toEqual({ state: "open", closesAt: null });
  });
  it("never claims a fixed closing time for every listing", () => {
    const states = (providers as Array<{ hours: string }>).map((provider) => hoursStatus(provider.hours, wednesday(9)).state);
    expect(states).toContain("unknown");
    expect(parseWeeklyHours("whenever")).toBeNull();
  });
});

describe("access filters", () => {
  it("only marks walk-ins and no-ID when the listing says so", () => {
    expect(acceptsWalkIns({ walk_in_allowed: "Yes" })).toBe(true);
    expect(acceptsWalkIns({ walk_in_allowed: "Unknown" })).toBe(false);
    expect(acceptsWalkIns({ walk_in_allowed: "Unknown", document_alternatives: ["Walk-in welcome"] })).toBe(true);
    expect(noIdRequired({ documents_required: ["None required"] })).toBe(true);
    expect(noIdRequired({ documents_required: ["ID if available"] })).toBe(true);
    expect(noIdRequired({ documents_required: ["ID", "income/benefits info"] })).toBe(false);
    expect(noIdRequired({ documents_required: ["ID"], document_alternatives: ["Self-attestation accepted"] })).toBe(true);
    expect(noIdRequired({})).toBe(false);
  });
  it("finds real matches in the bundled directory", () => {
    const list = providers as Array<Parameters<typeof acceptsWalkIns>[0]>;
    expect(list.filter(acceptsWalkIns).length).toBeGreaterThan(0);
    expect(list.filter(noIdRequired).length).toBeGreaterThan(0);
  });
  it("reports verification and documents honestly", () => {
    expect(isVerified({ verification_status: "Verified" })).toBe(true);
    expect(isVerified({ verification_status: "Needs verification" })).toBe(false);
    expect(documentsToBring({ documents_required: ["None required"] })).toEqual([]);
    expect(documentsToBring({ documents_required: ["ID", "Proof of income"] })).toEqual(["ID", "Proof of income"]);
  });
});
