import { describe, expect, it } from "vitest";
import { createCaseCsv, hasWorkspaceAccess, isCasePriority, isCaseStatus, normalizeClientProfile } from "./workflowRules";

describe("ZipShift workflow rules", () => {
  it("gates staff workspaces by role", () => {
    expect(hasWorkspaceAccess("admin", ["admin"])).toBe(true);
    expect(hasWorkspaceAccess("researcher", ["admin", "researcher"])).toBe(true);
    expect(hasWorkspaceAccess("client", ["admin", "researcher"])).toBe(false);
  });

  it("accepts only defined case status and priority updates", () => {
    expect(isCaseStatus("completed")).toBe(true);
    expect(isCaseStatus("invented-status")).toBe(false);
    expect(isCasePriority("urgent")).toBe(true);
    expect(isCasePriority("immediate")).toBe(false);
  });

  it("normalizes persisted client-profile input", () => {
    expect(normalizeClientProfile({ displayName: "  Ava  ", language: "es", accessibility: ["Large print", 5] }, "Current name")).toEqual({ displayName: "Ava", phone: null, city: null, language: "es", accessibility: ["Large print"] });
  });

  it("creates a safely quoted case-report export", () => {
    const csv = createCaseCsv([{ caseNumber: "CASE-1", clientName: "Ava \"A\"", serviceCategory: "Food", status: "new", priority: "standard", assignedName: null, createdAt: "2026-08-25", updatedAt: "2026-08-25" }]);
    expect(csv).toContain('"Ava ""A"""');
    expect(csv.split("\n")).toHaveLength(2);
  });
});
