import { describe, expect, it } from "vitest";
import { toOutcomeReportRows } from "./accessOutcomeReport";
import { canRecordAccessOutcome } from "./workflowRules";

describe("toOutcomeReportRows", () => {
  it("uses the latest outcome and the consented housing snapshot", () => {
    const rows = toOutcomeReportRows(
      [
        { case_id: "a", created_at: 100, housing_status: "housed", sdoh_consent: 1 },
        { case_id: "b", created_at: 200, housing_status: "unsheltered", sdoh_consent: 0 },
        { case_id: "c", created_at: 300, housing_status: null, sdoh_consent: 1 },
      ],
      [
        { case_id: "a", outcome: "not_connected", barriers_json: '["no_id"]', housing_status_snapshot: "unsheltered", connected_at: null, created_at: 150 },
        { case_id: "a", outcome: "connected", barriers_json: ["no_id", "bogus"], housing_status_snapshot: "emergency_shelter", connected_at: 180, created_at: 190 },
        { case_id: "b", outcome: "lost_contact", barriers_json: null, housing_status_snapshot: "unsheltered", connected_at: 999, created_at: 250 },
      ],
    );
    expect(rows).toEqual([
      { housingStatus: "emergency_shelter", outcome: "connected", barriers: ["no_id"], createdAt: 100, connectedAt: 180 },
      { housingStatus: null, outcome: "lost_contact", barriers: [], createdAt: 200, connectedAt: null },
      { housingStatus: null, outcome: null, barriers: [], createdAt: 300, connectedAt: null },
    ]);
    expect(JSON.stringify(rows)).not.toContain("case_id");
  });
});

describe("canRecordAccessOutcome", () => {
  it("allows admins and care-team staff but not plain researchers or clients", () => {
    expect(canRecordAccessOutcome({ role: "admin" })).toBe(true);
    expect(canRecordAccessOutcome({ role: "researcher", specialistRole: "peer_support_specialist" })).toBe(true);
    expect(canRecordAccessOutcome({ role: "researcher", specialistRole: null })).toBe(false);
    expect(canRecordAccessOutcome({ role: "client", specialistRole: "care_coordinator" })).toBe(false);
  });
});
