// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReferralsDispatch from "../components/ReferralsDispatch";
import RolePortal from "../components/RolePortal";
import StaffIntakeFlow from "../components/StaffIntakeFlow";
import StaffWorkspace from "../components/StaffWorkspace";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button as HTMLButtonElement;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Input value setter is unavailable.");
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("staff portal and intake authorization interactions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: FetchMock;

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

  it("routes portal shortcut interactions to intake and dispatch without treating navigation as authorization", async () => {
    const onNavigate = vi.fn();
    await act(async () => root.render(<RolePortal onNavigate={onNavigate} />));

    await act(async () => buttonByText(container, "Staff intake").click());
    await act(async () => buttonByText(container, "Referrals").click());

    expect(onNavigate).toHaveBeenNthCalledWith(1, "staff-intake");
    expect(onNavigate).toHaveBeenNthCalledWith(2, "referrals-dispatch");
  });

  it("keeps a wrong-role session out of the protected staff workspace and avoids staff-data requests", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/me") {
        return Promise.resolve(jsonResponse({ user: { id: "client-1", displayName: "Client", email: "client@example.test", role: "client" } }));
      }
      if (String(input) === "/api/setup/status") return Promise.resolve(jsonResponse({ needsAdminSetup: false }));
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await act(async () => root.render(<StaffWorkspace role="admin" onBack={() => undefined} />));
    await settle();

    expect(container.textContent).toContain("Sign in to Admin workspace");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", { credentials: "include" });
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("/api/staff/"))).toBe(false);
  });

  it("opens the administrator editor suite after an authorized workspace session is confirmed", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/me") {
        return Promise.resolve(jsonResponse({ user: { id: "admin-1", displayName: "Admin", email: "admin@example.test", role: "admin" } }));
      }
      if (String(input) === "/api/admin/users") return Promise.resolve(jsonResponse({ users: [] }));
      if (String(input) === "/api/admin/pages") return Promise.resolve(jsonResponse({ pages: [] }));
      if (String(input) === "/api/admin/audit") return Promise.resolve(jsonResponse({ entries: [] }));
      if (String(input) === "/api/admin/global-settings") return Promise.resolve(jsonResponse({ settings: { brandColor: "#159d92", accentColor: "#0d8077", surfaceColor: "#f7f9fc", textScale: 1, radiusScale: 1, sidebarDefaultCollapsed: false }, revisions: [] }));
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await act(async () => root.render(<StaffWorkspace role="admin" onBack={() => undefined} />));
    await settle();
    await settle();

    expect(container.textContent).toContain("Editors suite");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/global-settings", { credentials: "include" });
  });

  it("shows a deterministic authorization failure when dispatch APIs reject the session", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "You do not have permission to access this workspace." }, 403));

    await act(async () => root.render(<ReferralsDispatch onBack={() => undefined} onNewReferral={() => undefined} onNotifications={() => undefined} />));
    await settle();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Staff authorization is required to view referral dispatch.");
    expect(fetchMock).toHaveBeenCalledWith("/api/staff/cases", { credentials: "include" });
    expect(fetchMock).toHaveBeenCalledWith("/api/staff/reports/summary", { credentials: "include" });
  });

  it("renders authorized dispatch data and reloads a selected status through the protected API", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input) === "/api/staff/cases") {
        return Promise.resolve(jsonResponse({ cases: [{ id: "case-1", caseNumber: "CASE-2026-001", clientName: "Protected Client", serviceCategory: "Food assistance", status: "new", priority: "high", createdAt: 1_756_000_000_000, updatedAt: 1_756_000_000_000 }] }));
      }
      if (String(input) === "/api/staff/cases?status=completed") return Promise.resolve(jsonResponse({ cases: [] }));
      if (String(input) === "/api/staff/reports/summary") return Promise.resolve(jsonResponse({ summary: { totalCases: 1, openCases: 1, completedCases: 0, completionRate: 0 } }));
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await act(async () => root.render(<ReferralsDispatch onBack={() => undefined} onNewReferral={() => undefined} onNotifications={() => undefined} />));
    await settle();

    expect(container.textContent).toContain("CASE-2026-001");
    expect(container.textContent).toContain("Protected Client");

    const statusSelect = container.querySelector('select[aria-label="Filter referrals by status"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = "completed";
      statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settle();

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/cases?status=completed", { credentials: "include" });
    expect(container.textContent).toContain("No referrals match the selected filters.");
  });

  it("blocks incomplete intake locally, then submits only consented intake data and completes on success", async () => {
    const onComplete = vi.fn();
    fetchMock.mockResolvedValue(jsonResponse({ caseId: "case-intake-1" }, 201));

    await act(async () => root.render(<StaffIntakeFlow onBack={() => undefined} onComplete={onComplete} />));
    await act(async () => buttonByText(container, "Open ZipShift workflow").click());

    const nameInput = container.querySelector('input[placeholder="Full name"]') as HTMLInputElement;
    await act(async () => setInputValue(nameInput, "Consent Client"));
    await act(async () => buttonByText(container, "Connect to ZipShift").click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Enter the client name and document consent before submitting.");
    expect(fetchMock).not.toHaveBeenCalled();

    const consent = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => consent.click());
    await act(async () => buttonByText(container, "Connect to ZipShift").click());
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/intake");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Consent Client", consent: true, needs: ["Emergency shelter"] });
    expect(onComplete).toHaveBeenCalledWith("case-intake-1");
    expect(container.textContent).toContain("Referral connected");
  });
});
