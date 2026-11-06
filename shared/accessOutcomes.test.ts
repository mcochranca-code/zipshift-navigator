import { describe, expect, it } from "vitest";
import {
  accessOutcomeReportToCsv,
  buildAccessOutcomeReport,
  contactNeedsPhone,
  normalizeHousingStatus,
  referralFollowUpState,
  validateAccessOutcome,
  type OutcomeReportRow,
} from "./accessOutcomes";

const DAY = 24 * 60 * 60 * 1000;

describe("housing status", () => {
  it("is only stored with SDOH consent", () => {
    expect(normalizeHousingStatus("unsheltered", true)).toBe("unsheltered");
    expect(normalizeHousingStatus("unsheltered", false)).toBeNull();
    expect(normalizeHousingStatus("unsheltered", "true")).toBeNull();
  });
  it("accepts prefer-not-to-say and maps legacy free-text values", () => {
    expect(normalizeHousingStatus("prefer_not_to_say", true)).toBe("prefer_not_to_say");
    expect(normalizeHousingStatus("homeless", true)).toBe("unsheltered");
    expect(normalizeHousingStatus("at-risk", true)).toBe("at_risk");
    expect(normalizeHousingStatus("castle", true)).toBeNull();
  });
});

describe("contact preference", () => {
  it("does not require a phone for no-phone or case-manager contact", () => {
    expect(contactNeedsPhone("check_back_with_code")).toBe(false);
    expect(contactNeedsPhone("case_manager")).toBe(false);
    expect(contactNeedsPhone("text")).toBe(true);
  });
});

describe("validateAccessOutcome", () => {
  const context = { caseCreatedAt: 1_000_000, now: 1_000_000 + 10 * DAY };
  it("requires a barrier when not connected", () => {
    expect(validateAccessOutcome({ outcome: "not_connected", barriers: [] }, context).ok).toBe(false);
    const result = validateAccessOutcome({ outcome: "not_connected", barriers: ["no_id", "no_id", "bogus"] }, context);
    expect(result.ok && result.value.barriers).toEqual(["no_id"]);
  });
  it("defaults connection time to now and rejects impossible dates", () => {
    const result = validateAccessOutcome({ outcome: "connected" }, context);
    expect(result.ok && result.value.connectedAt).toBe(context.now);
    expect(validateAccessOutcome({ outcome: "connected", connectedAt: 5 }, context).ok).toBe(false);
    expect(validateAccessOutcome({ outcome: "connected", connectedAt: context.now + 2 * DAY }, context).ok).toBe(false);
  });
  it("keeps barriers that were overcome on a connected outcome and never sets a time for other outcomes", () => {
    const connected = validateAccessOutcome({ outcome: "connected", barriers: ["no_transport"], connectedAt: context.caseCreatedAt + DAY }, context);
    expect(connected.ok && connected.value).toEqual({ outcome: "connected", barriers: ["no_transport"], connectedAt: context.caseCreatedAt + DAY });
    const lost = validateAccessOutcome({ outcome: "lost_contact", connectedAt: context.now }, context);
    expect(lost.ok && lost.value.connectedAt).toBeNull();
  });
  it("rejects unknown outcomes", () => {
    expect(validateAccessOutcome({ outcome: "maybe" }, context).ok).toBe(false);
    expect(validateAccessOutcome(null, context).ok).toBe(false);
  });
});

describe("referralFollowUpState", () => {
  const now = 100 * DAY;
  it("flags open referrals idle past their priority threshold", () => {
    expect(referralFollowUpState({ status: "new", priority: "urgent", createdAt: now - 2 * DAY, updatedAt: now - 2 * DAY }, now).stale).toBe(true);
    expect(referralFollowUpState({ status: "in_progress", priority: "standard", createdAt: now - 9 * DAY, updatedAt: now - 1 * DAY }, now).stale).toBe(false);
    expect(referralFollowUpState({ status: "completed", priority: "urgent", createdAt: 0, updatedAt: 0 }, now).stale).toBe(false);
  });
});

function rows(count: number, row: Partial<OutcomeReportRow>): OutcomeReportRow[] {
  return Array.from({ length: count }, () => ({ housingStatus: null, outcome: null, barriers: [], createdAt: 0, connectedAt: null, ...row }));
}

describe("buildAccessOutcomeReport", () => {
  it("suppresses cells between 1 and 10 and the rate that depends on them", () => {
    const data = [
      ...rows(30, { housingStatus: "unsheltered", outcome: "connected", connectedAt: 2 * DAY }),
      ...rows(12, { housingStatus: "unsheltered", outcome: "not_connected", barriers: ["no_id"] }),
      ...rows(4, { housingStatus: "unsheltered", outcome: "not_connected", barriers: ["no_transport"] }),
      ...rows(5, { housingStatus: "housed", outcome: "connected", connectedAt: DAY }),
      ...rows(15, { housingStatus: "emergency_shelter", outcome: null }),
    ];
    const report = buildAccessOutcomeReport(data);
    const unsheltered = report.groups.find((group) => group.housingStatus === "unsheltered")!;
    expect(unsheltered.referrals).toEqual({ value: 46, suppressed: false });
    expect(unsheltered.connected).toEqual({ value: 30, suppressed: false });
    expect(unsheltered.notConnected).toEqual({ value: 16, suppressed: false });
    expect(unsheltered.connectionRate).toBe(65.2);
    expect(unsheltered.medianDaysToConnection).toBe(2);
    expect(unsheltered.barriers.find((item) => item.barrier === "no_id")!.count).toEqual({ value: 12, suppressed: false });
    expect(unsheltered.barriers.find((item) => item.barrier === "no_transport")!.count).toEqual({ value: null, suppressed: true });
    const housed = report.groups.find((group) => group.housingStatus === "housed")!;
    expect(housed.referrals.suppressed).toBe(true);
    expect(housed.connectionRate).toBeNull();
    expect(housed.medianDaysToConnection).toBeNull();
    // The one suppressed housing group forces its smallest neighbour to be hidden too.
    expect(report.groups.find((group) => group.housingStatus === "emergency_shelter")!.referrals.suppressed).toBe(true);
    expect(report.totals.referrals).toEqual({ value: 66, suppressed: false });
  });

  it("applies complementary suppression so a hidden cell cannot be recovered by subtraction", () => {
    const report = buildAccessOutcomeReport([
      ...rows(20, { housingStatus: "emergency_shelter", outcome: "connected", connectedAt: DAY }),
      ...rows(15, { housingStatus: "emergency_shelter", outcome: null }),
      ...rows(3, { housingStatus: "emergency_shelter", outcome: "lost_contact" }),
    ]);
    const shelter = report.groups.find((group) => group.housingStatus === "emergency_shelter")!;
    expect(shelter.lostContact.suppressed).toBe(true);
    expect([shelter.connected, shelter.noOutcomeYet].filter((item) => item.suppressed)).toHaveLength(1);
  });

  it("compares people experiencing homelessness with housed or at-risk people", () => {
    const report = buildAccessOutcomeReport([
      ...rows(11, { housingStatus: "doubled_up", outcome: "connected", connectedAt: 4 * DAY }),
      ...rows(11, { housingStatus: "unsheltered", outcome: "not_connected", barriers: ["no_phone"] }),
      ...rows(22, { housingStatus: "housed", outcome: "connected", connectedAt: DAY }),
    ]);
    expect(report.homelessVsHoused.experiencingHomelessness.connectionRate).toBe(50);
    expect(report.homelessVsHoused.experiencingHomelessness.medianDaysToConnection).toBe(4);
    expect(report.homelessVsHoused.housedOrAtRisk.connectionRate).toBe(100);
  });

  it("exports aggregate cells only", () => {
    const csv = accessOutcomeReportToCsv(buildAccessOutcomeReport([...rows(3, { housingStatus: "unsheltered", outcome: "connected", connectedAt: DAY })]));
    expect(csv.split("\n")[0]).toBe('"section","housing_status","measure","value"');
    expect(csv).toContain('"outcomes","unsheltered","referrals","<11"');
    expect(csv).not.toMatch(/case_number|client|email|display_name|\bname\b/i);
  });
});
