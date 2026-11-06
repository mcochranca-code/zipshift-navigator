// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RolePortal from "../components/RolePortal";
import StaffWorkspace from "../components/StaffWorkspace";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

const buttonLabels = (container: HTMLElement) => Array.from(container.querySelectorAll("button")).map((button) => button.textContent?.replace(/\s+/g, " ").trim() || "");

describe("research-only accounts in the client UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("hides identified care-workspace shortcuts from a research-only account, but not from care-team staff", async () => {
    const researcher = { displayName: "R", email: "r@example.test", role: "researcher" as const, specialistRole: null };
    await act(async () => root.render(<RolePortal onNavigate={() => undefined} user={researcher} />));
    let labels = buttonLabels(container);
    for (const hidden of ["Staff intake", "Referrals", "Care team", "Specialist dashboard"]) expect(labels).not.toContain(hidden);
    expect(container.textContent).not.toContain("Care Coordination");
    expect(container.textContent).not.toContain("Admin Partner");

    await act(async () => root.render(<RolePortal onNavigate={() => undefined} user={{ ...researcher, specialistRole: "care_coordinator" }} />));
    labels = buttonLabels(container);
    expect(labels).toContain("Staff intake");
    expect(labels).toContain("Care team");
  });

  it("shows a research-only account only de-identified sections and never requests identified data", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") return Promise.resolve(jsonResponse({ user: { id: "r-1", displayName: "Research Analyst", email: "r@example.test", role: "researcher", specialistRole: null } }));
      if (url === "/api/staff/reports/summary") return Promise.resolve(jsonResponse({ summary: { totalCases: 0, openCases: 0, completedCases: 0, completionRate: 0, totalDirectoryResources: 0, verifiedDirectoryResources: 0, averageHsai: 0 }, byStatus: {}, events: [] }));
      if (url === "/api/staff/reports/zip-demand") return Promise.resolve(jsonResponse({ periodDays: 90, minimumCohort: 3, demand: [], methodology: "" }));
      if (url === "/api/staff/reports/field-test") return Promise.resolve(jsonResponse({ periodDays: 30, privacy: "", events: [], history: [] }));
      return Promise.resolve(jsonResponse({ error: `Unexpected request: ${url}` }, 500));
    });

    await act(async () => root.render(<StaffWorkspace role="researcher" onBack={() => undefined} />));
    await settle();
    await settle();

    const labels = buttonLabels(container);
    for (const hidden of ["Cases", "Navigator", "YellowBook", "Open cases →", "⇩ Export case CSV"]) expect(labels.some((label) => label === hidden || label.startsWith(`${hidden} `))).toBe(false);
    expect(labels.some((label) => label.includes("Research"))).toBe(true);
    const requested = fetchMock.mock.calls.map(([input]) => String(input));
    expect(requested.some((url) => url.startsWith("/api/staff/cases") || url.startsWith("/api/staff/yellowbook") || url.startsWith("/api/care-portal") || url === "/api/staff/reports/export")).toBe(false);
  });
});
