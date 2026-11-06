// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccessOutcomeRecorder from "./AccessOutcomeRecorder";
import AccessOutcomesPanel from "./AccessOutcomesPanel";
import { buildAccessOutcomeReport } from "../../../shared/accessOutcomes";

const AXE_OPTIONS: axe.RunOptions = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };
let container: HTMLDivElement;
let root: Root;

async function settle(ms = 0) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe("AccessOutcomeRecorder", () => {
  it("requires a barrier for 'not connected' and posts structured outcomes", async () => {
    const fetcher = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ success: true, id: "o1", createdAt: Date.now(), connectedAt: null }, 201);
      return json({ outcomes: [] });
    }) as unknown as typeof fetch;
    const onRecorded = vi.fn();
    act(() => root.render(<AccessOutcomeRecorder caseRecord={{ id: "c1", createdAt: Date.now() - 86_400_000, contactPreference: "check_back_with_code" }} canRecord fetcher={fetcher} onRecorded={onRecorded} />));
    await settle(10);
    expect(container.textContent).toContain("No phone — I'll check back with my referral code");

    const results = await axe.run(container, AXE_OPTIONS);
    expect(results.violations.map((v) => v.id)).toEqual([]);

    const notConnected = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find((input) => input.value === "not_connected")!;
    act(() => notConnected.click());
    const record = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Record outcome")!;
    act(() => record.click());
    await settle(10);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("at least one barrier");

    const noId = Array.from(container.querySelectorAll("label")).find((label) => label.textContent === "No ID")!.querySelector("input")!;
    act(() => noId.click());
    act(() => record.click());
    await settle(20);
    const post = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ outcome: "not_connected", barriers: ["no_id"], connectedAt: null });
    expect(onRecorded).toHaveBeenCalledWith({ accessOutcome: "not_connected" });
  });

  it("is read-only for researchers without a care-team role", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    act(() => root.render(<AccessOutcomeRecorder caseRecord={{ id: "c1", createdAt: 0 }} canRecord={false} fetcher={fetcher} />));
    await settle(5);
    expect(container.querySelector("input")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("AccessOutcomesPanel", () => {
  it("renders suppressed cells accessibly and never offers a row-level export", async () => {
    const rows = [
      ...Array.from({ length: 14 }, () => ({ housingStatus: "unsheltered" as const, outcome: "connected" as const, barriers: [], createdAt: 0, connectedAt: 3 * 86_400_000 })),
      ...Array.from({ length: 12 }, () => ({ housingStatus: "unsheltered" as const, outcome: "not_connected" as const, barriers: ["no_id" as const], createdAt: 0, connectedAt: null })),
      ...Array.from({ length: 3 }, () => ({ housingStatus: "housed" as const, outcome: "connected" as const, barriers: [], createdAt: 0, connectedAt: 86_400_000 })),
    ];
    const fetcher = vi.fn(() => json({ periodDays: 365, report: buildAccessOutcomeReport(rows), methodology: "Aggregates only." })) as unknown as typeof fetch;
    act(() => root.render(<AccessOutcomesPanel fetcher={fetcher} />));
    await settle(20);
    expect(container.querySelector("caption")?.textContent).toContain("Outcomes by housing status");
    expect(container.textContent).toContain("Sleeping outside or in a car");
    expect(container.textContent).toContain("fewer than 11, suppressed");
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/api/research/access-outcomes.csv?periodDays=365"]);
    const results = await axe.run(container, AXE_OPTIONS);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});
