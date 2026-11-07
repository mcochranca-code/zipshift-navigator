// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";
import { LiveAnnouncer, SkipLink } from "../lib/a11y";

const AXE_OPTIONS: axe.RunOptions = { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } };

let container: HTMLDivElement;
let root: Root;

async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function buttonByText(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button as HTMLButtonElement;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  container.id = "root";
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 401, headers: { "content-type": "application/json" } }))));
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
  }
  if (!window.requestAnimationFrame) window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0) as unknown as number;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Home navigation and screen-reader support", () => {
  it("exposes landmarks, labelled controls, accessible menus and focus management", async () => {
    act(() => root.render(<><SkipLink /><LiveAnnouncer /><Home /></>));
    // Splash is an announced status, not a silent animation
    expect(container.querySelector('.zs-splash[role="status"]')).not.toBeNull();

    // People looking for help land straight on the public navigator after the splash
    await settle(2300);
    expect(container.querySelector(".zipshift-portal")).toBeNull();
    await settle(30);

    // Landmarks + headings
    const main = container.querySelector("main#main-content");
    expect(main).not.toBeNull();
    expect(container.querySelector("header h1")).not.toBeNull();
    const primaryNav = container.querySelector('nav[aria-label="Primary"]');
    expect(primaryNav).not.toBeNull();
    expect(primaryNav!.querySelector('[aria-current="page"]')?.textContent).toContain("Home");
    expect(container.querySelector('aside[aria-label="Navigator sidebar"] nav[aria-label="Navigator"]')).not.toBeNull();
    expect(container.querySelectorAll("main h2").length).toBeGreaterThanOrEqual(2);

    // No unlabelled inputs/buttons on the client home screen
    const homeResults = await axe.run(container, AXE_OPTIONS);
    expect(homeResults.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    // Mobile menu: labelled trigger, focus moves in, Escape closes, focus returns
    const menuButton = container.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')!;
    expect(menuButton.getAttribute("aria-expanded")).toBe("false");
    menuButton.focus();
    act(() => menuButton.click());
    await settle(10);
    const drawer = container.querySelector('[role="dialog"][aria-label="Navigation menu"]');
    expect(drawer).not.toBeNull();
    expect(drawer!.contains(document.activeElement)).toBe(true);
    expect(drawer!.querySelector('[role="switch"]')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    await settle(10);
    expect(container.querySelector('[aria-label="Navigation menu"]')).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Open menu");

    // Screen change moves focus to the new screen's h1 and updates the title
    const mapTab = Array.from(primaryNav!.querySelectorAll("button")).find((b) => b.textContent?.includes("Map"))!;
    act(() => mapTab.click());
    await settle(50);
    expect(document.activeElement?.tagName).toBe("H1");
    expect(document.title).toBe("Resource map · ZipShift");
    expect(container.querySelector(".zs-map-list")).not.toBeNull();
    await settle(80);
    expect(container.querySelector("#zs-live-polite")?.textContent).toBe("Resource map screen");
  }, 15000);
});

describe("Client drop-off safeguards", () => {
  async function openFirstProviderFromSearch() {
    act(() => root.render(<><SkipLink /><LiveAnnouncer /><Home /></>));
    await settle(2400);
    const viewAll = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "View all")!;
    act(() => viewAll.click());
    await settle(30);
  }

  it("offers walk-in / no-ID filters, an empty state, and honest provider details", async () => {
    await openFirstProviderFromSearch();
    // Every listing is reachable: none is hidden for lacking a distance.
    expect(Number(container.querySelector('main [role="status"][aria-live="polite"]')!.textContent!.split(" ")[0])).toBe(40);
    const noId = buttonByText("No ID needed");
    act(() => noId.click());
    await settle(10);
    expect(noId.getAttribute("aria-pressed")).toBe("true");
    const count = Number(container.querySelector('main [role="status"][aria-live="polite"]')!.textContent!.split(" ")[0]);
    expect(count).toBeGreaterThan(0);

    const search = container.querySelector<HTMLInputElement>('main input[type="search"]')!;
    act(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(search, "zzzz-no-such-place"); search.dispatchEvent(new Event("input", { bubbles: true })); });
    await settle(10);
    expect(container.textContent).toContain("No places match these filters");
    act(() => buttonByText("Clear filters").click());
    await settle(10);
    expect(Number(container.querySelector('main [role="status"][aria-live="polite"]')!.textContent!.split(" ")[0])).toBeGreaterThan(count - 1);
    expect(container.textContent).not.toContain("Sort ›");

    const firstCard = container.querySelector<HTMLButtonElement>("button[data-result-card]")!;
    act(() => firstCard.click());
    await settle(40);
    expect(container.textContent).toContain("Your next step");
    // Saving works without an account and survives a reload on this device.
    const save = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Save")!;
    act(() => save.click());
    await settle(10);
    expect(save.getAttribute("aria-pressed")).toBe("true");
    expect(JSON.parse(localStorage.getItem("zipshift.saved.local") || "[]")).toHaveLength(1);
    expect(container.textContent).not.toContain("Closes 5:00 PM");
    // A pending live-region announcement can fire while axe runs; keep it inside act().
    let results!: axe.AxeResults;
    await act(async () => {
      results = await axe.run(container, AXE_OPTIONS);
    });
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);

    act(() => buttonByText("I Need This Help").click());
    await settle(30);
    expect(container.textContent).not.toContain("Open now · Closes 5:00 PM");
    act(() => buttonByText("I'm Ready to Go").click());
    await settle(30);
    expect(container.textContent).not.toContain("Route 6");
    expect(container.textContent).toContain("You can show this address to the bus driver.");
  }, 20000);

  it("lets people without a phone ask for help, without staff shortcuts in the way", async () => {
    act(() => root.render(<><SkipLink /><LiveAnnouncer /><Home /></>));
    await settle(2400);
    const nav = container.querySelector('nav[aria-label="Primary"]')!;
    act(() => Array.from(nav.querySelectorAll("button")).find((b) => b.textContent?.includes("Get Help"))!.click());
    await settle(30);
    expect(container.textContent).not.toContain("Researcher");
    act(() => buttonByText("Emergency Shelter").click());
    act(() => buttonByText("Next →").click());
    await settle(20);
    const noPhone = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find((input) => input.value === "check_back_with_code")!;
    act(() => noPhone.click());
    await settle(10);
    expect(container.querySelector("#zs-aor-phone")).toBeNull();
    expect(container.querySelector('label[for="zs-aor-housing"]')).not.toBeNull();
    const results = await axe.run(container, AXE_OPTIONS);
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }, 15000);
});
