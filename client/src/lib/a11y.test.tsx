// @vitest-environment jsdom

import React, { act, useRef, useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAnnouncer, SkipLink, announce, useDialogA11y } from "./a11y";
import { contrastRatio, tokens } from "./designTokens";
import { BrandedSplash, SkeletonCards, SkeletonList } from "../components/motion/Loaders";
import ZipShiftMap, { type Provider } from "../components/ZipShiftMap";
import Breadcrumbs from "../components/Breadcrumbs";
import RolePortal from "../components/RolePortal";
import NotificationCenter from "../components/NotificationCenter";
import StaffIntakeFlow from "../components/StaffIntakeFlow";
import ReferralsDispatch from "../components/ReferralsDispatch";

// Layout-dependent rules cannot be evaluated in jsdom; contrast is covered by
// the token tests below instead.
const AXE_OPTIONS: axe.RunOptions = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

async function expectNoAxeViolations(node: Element) {
  const results = await axe.run(node, AXE_OPTIONS);
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactNode) {
  act(() => root.render(ui));
  return container;
}

async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 401, headers: { "content-type": "application/json" } }))));
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
  }
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("design tokens", () => {
  const css = readFileSync(resolve(process.cwd(), "client/src/styles/tokens.css"), "utf8");

  it("keeps the CSS and TypeScript token values in sync", () => {
    const value = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
    expect(value("zs-color-brand")).toBe(tokens.color.brand);
    expect(value("zs-color-brand-strong")).toBe(tokens.color.brandStrong);
    expect(value("zs-color-text-subtle")).toBe(tokens.color.textSubtle);
    expect(value("zs-color-text-muted")).toBe(tokens.color.textMuted);
    expect(value("zs-focus-ring-color")).toBe(tokens.color.focusRing);
    expect(css).toContain("--zs-duration-base");
    expect(css).toContain("--zs-ease-out");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("meets WCAG AA contrast for text tokens", () => {
    const white = tokens.color.surface;
    expect(contrastRatio(tokens.color.brand, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.onBrand, tokens.color.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.brandStrong, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.text, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.textMuted, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.textSubtle, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.textSubtle, tokens.color.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.color.successText, white)).toBeGreaterThanOrEqual(4.5);
    // Non-text UI (focus ring) needs 3:1
    expect(contrastRatio(tokens.color.focusRing, white)).toBeGreaterThanOrEqual(3);
  });

  it("disables decorative motion under prefers-reduced-motion", () => {
    const motionCss = readFileSync(resolve(process.cwd(), "client/src/styles/a11y-motion.css"), "utf8");
    expect(motionCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motionCss).toMatch(/\.zs-skeleton,[\s\S]*animation: none !important/);
    expect(motionCss).toContain(':root[data-zs-motion="reduce"]');
  });
});

describe("loading states", () => {
  it("renders an announced, accessible splash screen", async () => {
    render(<BrandedSplash tagline="Navigate. Connect. Act." status="Loading ZipShift Navigator" />);
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-busy")).toBe("true");
    expect(status?.textContent).toContain("Loading ZipShift Navigator");
    await expectNoAxeViolations(container);
  });

  it("renders skeleton lists and cards as a single status message", async () => {
    render(<div><SkeletonList rows={3} label="Loading referrals" /><SkeletonCards count={2} label="Loading directory" /></div>);
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(2);
    expect(statuses[0].textContent).toBe("Loading referrals");
    expect(container.querySelectorAll(".zs-skeleton-row")).toHaveLength(3);
    await expectNoAxeViolations(container);
  });
});

describe("navigation helpers", () => {
  it("skip link moves focus to the main landmark", () => {
    render(<><SkipLink /><main id="main-content"><h1>Title</h1></main></>);
    const link = container.querySelector<HTMLAnchorElement>(".zs-skip-link")!;
    expect(link.getAttribute("href")).toBe("#main-content");
    act(() => link.click());
    expect(document.activeElement?.id).toBe("main-content");
  });

  it("renders breadcrumbs with the current page marked", async () => {
    const onHome = vi.fn();
    render(<Breadcrumbs items={[{ label: "Home", onSelect: onHome }, { label: "Food bank" }]} />);
    expect(container.querySelector("nav")?.getAttribute("aria-label")).toBe("Breadcrumb");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Food bank");
    act(() => container.querySelector("button")!.click());
    expect(onHome).toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it("announces messages through the polite live region", async () => {
    render(<LiveAnnouncer />);
    announce("Search results screen");
    await settle(80);
    expect(container.querySelector("#zs-live-polite")?.textContent).toBe("Search results screen");
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, open, () => setOpen(false));
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open filters</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="harness-title">
          <h2 id="harness-title">Filters</h2>
          <button type="button">First</button>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

describe("useDialogA11y", () => {
  it("moves focus in, traps Tab, closes on Escape and restores focus", async () => {
    render(<DialogHarness />);
    const opener = container.querySelector("button")!;
    opener.focus();
    act(() => opener.click());
    await settle();
    expect(document.activeElement?.textContent).toBe("First");

    const close = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Close")!;
    close.focus();
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })); });
    expect(document.activeElement?.textContent).toBe("First");

    await expectNoAxeViolations(container);

    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await settle();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

const baseProvider: Provider = {
  record_id: "p1", org_name: "Modesto Food Hub", program_name: "Pantry", city: "Modesto", service_category: "Benefits / Food Assistance", phone: "209-555-0100", website: "", address: "100 Main St, Modesto, CA 95354", hours: "9-5", walk_in_allowed: "yes", referral_required: "no", documents_required: [], document_alternatives: [], language_access: "", ada_access: "", pets_policy: "", partners_policy: "", capacity_status: "", waitlist_status: "", verification_status: "verified", verification_date: "", qr_record_id: "", transit_feasibility: "", service_node_cluster: "", referral_sources: "", hsai_score: 4.2, lat: 37.64, lng: -120.99,
};

describe("ZipShiftMap accessible alternative", () => {
  const providers: Provider[] = [
    baseProvider,
    { ...baseProvider, record_id: "p2", org_name: "Turlock Shelter", service_category: "Emergency Shelter", city: "Turlock", lat: 37.49, lng: -120.84 },
    { ...baseProvider, record_id: "p3", org_name: "Countywide Hotline", service_category: "Medical/Behavioral Health", city: "Stanislaus", lat: 0, lng: 0 },
  ];

  it("lists every resource, flags ones without coordinates, and syncs selection", async () => {
    const onSelect = vi.fn();
    render(<ZipShiftMap providers={providers} selectedCity="all" onProviderSelect={onSelect} />);
    await settle();
    const items = container.querySelectorAll<HTMLButtonElement>(".zs-map-item");
    expect(items).toHaveLength(3);
    expect(container.textContent).toContain("1 resource has no map location yet");
    expect(items[2].textContent).toContain("no map location");

    act(() => items[1].click());
    await settle();
    expect(items[1].getAttribute("aria-current")).toBe("true");
    const preview = container.querySelector(".zs-map-preview");
    expect(preview?.textContent).toContain("Turlock Shelter");

    // Full profile hands the PUBLIC resource record back to the caller
    const full = Array.from(preview!.querySelectorAll("button")).find((b) => b.textContent?.includes("Full profile"))!;
    act(() => full.click());
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ record_id: "p2" }));
  });

  it("supports arrow-key navigation through the list", async () => {
    render(<ZipShiftMap providers={providers} selectedCity="all" onProviderSelect={() => undefined} />);
    await settle();
    const items = container.querySelectorAll<HTMLButtonElement>(".zs-map-item");
    items[0].focus();
    act(() => { items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(document.activeElement).toBe(items[1]);
    act(() => { items[1].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })); });
    expect(document.activeElement).toBe(items[2]);
  });

  it("shows an offline notice while keeping the list usable", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    render(<ZipShiftMap providers={providers} selectedCity="all" onProviderSelect={() => undefined} />);
    await settle();
    expect(container.textContent).toContain("You appear to be offline");
    expect(container.querySelectorAll(".zs-map-item")).toHaveLength(3);
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
  });

  it("has no axe violations in the list/legend UI", async () => {
    render(<ZipShiftMap providers={providers} selectedCity="all" onProviderSelect={() => undefined} />);
    await settle();
    const panel = container.querySelector(".zs-map-panel")!;
    await expectNoAxeViolations(panel);
    await expectNoAxeViolations(container.querySelector(".zs-map-legend")!);
  });
});

describe("key screens pass axe", () => {
  it("role portal", async () => {
    render(<RolePortal onNavigate={() => undefined} />);
    await settle();
    await expectNoAxeViolations(container);
  });

  it("notification center", async () => {
    render(<NotificationCenter onBack={() => undefined} onProfile={() => undefined} onHelp={() => undefined} initialNotifications={[{ id: "n1", title: "Referral updated", message: "Food assistance", createdAt: 1_756_000_000_000 }]} />);
    await settle();
    await expectNoAxeViolations(container);
  });

  it("staff intake flow", async () => {
    render(<StaffIntakeFlow onBack={() => undefined} onComplete={() => undefined} />);
    await settle();
    await expectNoAxeViolations(container);
  });

  it("referrals dispatch (loading and loaded)", async () => {
    render(<ReferralsDispatch onBack={() => undefined} onNewReferral={() => undefined} onNotifications={() => undefined} />);
    await expectNoAxeViolations(container);
    await settle(20);
    await expectNoAxeViolations(container);
  });
});
