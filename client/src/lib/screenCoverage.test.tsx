import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotificationCenter from "../components/NotificationCenter";
import RolePortal from "../components/RolePortal";
import StaffIntakeFlow from "../components/StaffIntakeFlow";
import ReferralsDispatch from "../components/ReferralsDispatch";
import SpecialistDashboard from "../components/SpecialistDashboard";
import PatientSummaryCard, { formatPatientUpdatedAt, formatPatientUpdatedByRole } from "../components/PatientSummaryCard";
import PatientActivityTimeline, { formatPatientActivityDate } from "../components/PatientActivityTimeline";
import { CLIENT_SCREEN_COVERAGE, CLIENT_SELECTOR_DESTINATIONS, FIGMA_PRIMARY_CLIENT_PAGES, STAFF_SCREEN_COVERAGE, hasClientScreen } from "./screenCoverage";

const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const yellowBookSource = readFileSync(new URL("../components/YellowBookEncounter.tsx", import.meta.url), "utf8");
const patientSummarySource = readFileSync(new URL("../components/PatientSummaryCard.tsx", import.meta.url), "utf8");
const portalSource = readFileSync(new URL("../components/RolePortal.tsx", import.meta.url), "utf8");
const staffIntakeSource = readFileSync(new URL("../components/StaffIntakeFlow.tsx", import.meta.url), "utf8");
const dispatchSource = readFileSync(new URL("../components/ReferralsDispatch.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("client screen coverage", () => {
  it("registers every supported client destination", () => {
    expect(CLIENT_SCREEN_COVERAGE.length).toBeGreaterThanOrEqual(20);
    for (const screen of CLIENT_SCREEN_COVERAGE) expect(hasClientScreen(screen.id)).toBe(true);
    expect(new Set(CLIENT_SCREEN_COVERAGE.map((screen) => screen.id)).size).toBe(CLIENT_SCREEN_COVERAGE.length);
  });

  it("registers and wires the ten primary Figma client pages", () => {
    expect(FIGMA_PRIMARY_CLIENT_PAGES).toHaveLength(10);
    for (const page of FIGMA_PRIMARY_CLIENT_PAGES) {
      expect(hasClientScreen(page)).toBe(true);
      expect(homeSource).toContain(`screen === \"${page}\"`);
    }
  });

  it("keeps selector destinations within the registered screen set and wired in Home", () => {
    for (const screen of CLIENT_SCREEN_COVERAGE) {
      expect(hasClientScreen(screen.id)).toBe(true);
      expect(homeSource).toContain(`screen === \"${screen.id}\"`);
    }
    for (const destinations of Object.values(CLIENT_SELECTOR_DESTINATIONS)) {
      for (const destination of destinations) {
        expect(hasClientScreen(destination)).toBe(true);
        expect(homeSource).toContain(`\"${destination}\"`);
      }
    }
    expect(CLIENT_SELECTOR_DESTINATIONS.desktop).toContain("notifications");
    expect(CLIENT_SELECTOR_DESTINATIONS.mobileMenu).toContain("notifications");
    expect(CLIENT_SELECTOR_DESTINATIONS.mobileMenu).toContain("client-profile");
    expect(homeSource).toContain('navigate("referral-destination")');
    expect(homeSource).toContain("ReferralDestinationFlow");
  });

  it("registers and wires the Figma-inspired portal and staff destinations", () => {
    expect(STAFF_SCREEN_COVERAGE).toHaveLength(3);
    for (const screen of STAFF_SCREEN_COVERAGE) expect(homeSource).toContain(`screen === "${screen.id}"`);
    expect(portalSource).toContain("Client");
    expect(portalSource).toContain("Researcher");
    expect(portalSource).toContain("Admin Partner");
    expect(portalSource).toContain("Staff intake");
    expect(portalSource).toContain("Referrals");
    expect(staffIntakeSource).toContain("Connect to ZipShift");
    expect(staffIntakeSource).toContain("/api/intake");
    expect(dispatchSource).toContain("/api/staff/cases");
    expect(dispatchSource).toContain("/api/staff/reports/summary");
    expect(dispatchSource).toContain("Filter referrals by status");
    expect(cssSource).toContain("prefers-reduced-motion: reduce");
    expect(cssSource).toContain("zipshift-portal-grid");
  });

  it("renders the portal cards and preserves functional destinations", () => {
    const html = renderToStaticMarkup(<RolePortal onNavigate={() => undefined} />);
    expect(html).toContain("ZipShift Navigator");
    expect(html).toContain("Admin Partner");
    expect(html).toContain("Access workspace");
    const intake = renderToStaticMarkup(<StaffIntakeFlow onBack={() => undefined} onComplete={() => undefined} />);
    expect(intake).toContain("Connect to ZipShift");
    expect(intake).toContain("CLIENT CONSENT");
    const dispatch = renderToStaticMarkup(<ReferralsDispatch onBack={() => undefined} onNewReferral={() => undefined} onNotifications={() => undefined} />);
    expect(dispatch).toContain("Referrals Dispatch");
    expect(dispatch).toContain("All statuses");
    const specialistDashboard = renderToStaticMarkup(<SpecialistDashboard onBack={() => undefined} onOpenPortal={() => undefined} />);
    expect(specialistDashboard).toContain("Caseload &amp; reminders");
    expect(specialistDashboard).toContain("Pending warm handoffs");
    expect(specialistDashboard).toContain("Unsigned documents");
  });

  it("renders the mapped client empty state with functional escape routes", () => {
    const html = renderToStaticMarkup(<NotificationCenter onBack={() => undefined} onProfile={() => undefined} onHelp={() => undefined} />);
    expect(html).toContain("You’re all caught up");
    expect(html).toContain("Manage your profile");
    expect(html).toContain("Need help now?");
  });

  it("renders live referral notifications and unread state", () => {
    const html = renderToStaticMarkup(<NotificationCenter onBack={() => undefined} onProfile={() => undefined} onHelp={() => undefined} initialNotifications={[{ id: "event-1", title: "Access feedback recorded", message: "Food assistance · CASE-2026-TEST", createdAt: 1_756_000_000_000 }]} />);
    expect(html).toContain("Access feedback recorded");
    expect(html).toContain("Food assistance · CASE-2026-TEST");
    expect(html).toContain("1 unread");
    expect(html).toContain("Care reminders");
  });

  it("covers the patient summary card trigger and pointer-safe interaction contract", () => {
    expect(patientSummarySource).toContain('id="patient-summary-card"');
    expect(patientSummarySource).toContain('aria-expanded={open}');
    expect(patientSummarySource).toContain('onMouseEnter={() => onOpenChange(true)}');
    expect(patientSummarySource).toContain('onMouseLeave={() => onOpenChange(false)}');
    expect(patientSummarySource).toContain('onClick={() => onOpenChange(!open)}');
    expect(patientSummarySource).toContain('function patientInitials');
    expect(patientSummarySource).toContain('if (privacyMode) return "PP"');
    expect(yellowBookSource).toContain('PatientSummaryCard');
    expect(yellowBookSource).toContain('updatedAt={encounter.updatedAt}');
    expect(yellowBookSource).toContain('updatedByRole={encounter.updatedByRole}');
    expect(patientSummarySource).toContain('Updated by');
    expect(patientSummarySource).toContain('formatPatientUpdatedByRole');
  });

  it("renders saved and unsaved last-updated states in the patient summary card", () => {
    const savedAt = Date.parse("2026-08-28T15:45:00.000Z");
    const saved = renderToStaticMarkup(<PatientSummaryCard patientName="Jordan Rivera" privacyMode={false} serviceCategory="Housing navigation" encounterStatus="active" caseNumber="CASE-2026-014" updatedAt={savedAt} updatedByRole="admin" open={true} onOpenChange={() => undefined} />);
    expect(saved).toContain("Last updated");
    expect(saved).toContain(formatPatientUpdatedAt(savedAt));
    expect(saved).toContain("Updated by Administrator");
    expect(formatPatientUpdatedByRole("admin", false)).toBe("Administrator");

    const unsaved = renderToStaticMarkup(<PatientSummaryCard patientName="Privacy-protected record" privacyMode={true} serviceCategory="Housing navigation" encounterStatus="active" caseNumber="CASE-2026-015" updatedByRole="researcher" open={true} onOpenChange={() => undefined} />);
    expect(unsaved).toContain("Last updated");
    expect(unsaved).toContain("Not yet saved");
    expect(unsaved).toContain("Updated by Authorized staff");
    expect(unsaved).not.toContain("Updated by Researcher");
    expect(formatPatientUpdatedByRole("researcher", true)).toBe("Authorized staff");
  });

  it("renders recent encounter activity with timestamps and privacy-aware staff labels", () => {
    const createdAt = Date.parse("2026-08-28T15:30:00.000Z");
    const savedAt = Date.parse("2026-08-28T15:45:00.000Z");
    const standard = renderToStaticMarkup(<PatientActivityTimeline privacyMode={false} events={[{ eventType: "YELLOWBOOK_ENCOUNTER_SAVED", note: "Encounter saved.", createdAt: savedAt, actorRole: "admin" }, { eventType: "YELLOWBOOK_ENCOUNTER_CREATED", note: "Encounter opened.", createdAt, actorRole: "researcher" }]} />);
    expect(standard).toContain("Recent encounter activity");
    expect(standard).toContain("Encounter saved");
    expect(standard).toContain(formatPatientActivityDate(savedAt));
    expect(standard).toContain("Updated by Administrator");
    expect(standard).toContain("Encounter saved.");

    const protectedView = renderToStaticMarkup(<PatientActivityTimeline privacyMode={true} events={[{ eventType: "YELLOWBOOK_ENCOUNTER_SAVED", note: "Sensitive internal note.", createdAt: savedAt, actorRole: "researcher" }]} />);
    expect(protectedView).toContain("Updated by Authorized staff");
    expect(protectedView).not.toContain("Updated by Researcher");
    expect(protectedView).not.toContain("Sensitive internal note.");
  });

  it("keeps Home screen root padding declarations side-specific during screen rerenders", () => {
    expect(homeSource).toContain('paddingTop: 16, paddingRight: 16, paddingBottom: 100, paddingLeft: 16');
    expect(homeSource).not.toContain('padding: 16, paddingBottom: 100');
  });

  it("retains an explicit splash/loading state for the prototype transition frames", () => {
    expect(homeSource).toContain('screen === "splash"');
    expect(homeSource).toContain("Navigate. Connect. Act.");
  });
});
