import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accessTier, canAccessIdentifiedData, isResearchOnly } from "../shared/accessPolicy";
import { RESEARCHER_ALLOWED_ROUTES, isResearcherAllowedRoute, pseudonymousId } from "./researchAccess";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Every `app.<verb>("/api/...")` route the server registers, read from its source. */
function registeredApiRoutes() {
  const source = readFileSync(path.join(here, "index.ts"), "utf8");
  return Array.from(source.matchAll(/app\.(get|post|put|patch|delete)\("(\/api\/[^"]+)"/g)).map(([, method, route]) => ({ method: method.toUpperCase(), route }));
}

/** The routes a research-only account is meant to reach, by name. Changing this list is a privacy decision. */
const EXPECTED_RESEARCHER_ROUTES = new Set([
  "GET /api/health", "GET /api/setup/status",
  "POST /api/auth/login", "POST /api/auth/logout", "POST /api/auth/forgot-password", "POST /api/auth/reset-password", "GET /api/auth/me", "GET /api/auth/verify",
  "GET /api/profile", "GET /api/saved-resources", "PUT /api/saved-resources/:providerId", "DELETE /api/saved-resources/:providerId",
  "GET /api/cases/mine", "GET /api/notifications",
  "GET /api/directory", "GET /api/resources/canonical", "GET /api/operations/schedules", "GET /api/providers", "GET /api/coverage/zips", "GET /api/emergency-resources", "GET /api/county-resources", "GET /api/global-settings", "GET /api/pages/:slug",
  "POST /api/analytics/zip-search", "POST /api/analytics/field-event", "POST /api/feedback",
  "GET /api/staff/reports/summary", "GET /api/staff/reports/zip-demand", "GET /api/staff/reports/field-test",
  "GET /api/research/access-outcomes", "GET /api/research/access-outcomes.csv",
  "GET /api/research/studies", "GET /api/research/studies/:studyId/research-config", "GET /api/research/studies/:studyId/participant-controls", "GET /api/research/studies/:studyId/export.csv",
  "PATCH /api/research/participant-controls/:controlId/retention", "POST /api/research/participant-controls/:controlId/withdraw",
  "GET /api/research/participant-controls/:controlId/assessments", "POST /api/research/participant-controls/:controlId/assessments",
]);

const concrete = (route: string) => route.replace(/:[A-Za-z]+/g, "test-id");

describe("access tiers", () => {
  it("separates research-only accounts from care-team staff", () => {
    expect(accessTier({ role: "researcher", specialistRole: null })).toBe("researcher");
    expect(accessTier({ role: "researcher", specialistRole: "peer_support_specialist" })).toBe("care_team");
    expect(accessTier({ role: "admin" })).toBe("admin");
    expect(accessTier({ role: "client" })).toBe("client");
    expect(accessTier(null)).toBeNull();
    expect(canAccessIdentifiedData({ role: "researcher" })).toBe(false);
    expect(canAccessIdentifiedData({ role: "researcher", specialistRole: "care_coordinator" })).toBe(true);
    expect(canAccessIdentifiedData({ role: "admin" })).toBe(true);
    expect(canAccessIdentifiedData({ role: "client" })).toBe(false);
    expect(isResearchOnly({ role: "researcher", specialistRole: "" })).toBe(true);
  });
});

describe("researcher route audit", () => {
  const routes = registeredApiRoutes();

  it("finds the server's routes", () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it("allows a research-only account exactly the expected de-identified routes, and denies every other route", () => {
    const allowed = routes.filter(({ method, route }) => isResearcherAllowedRoute(method, concrete(route))).map(({ method, route }) => `${method} ${route}`);
    expect(new Set(allowed)).toEqual(EXPECTED_RESEARCHER_ROUTES);
  });

  it("denies every route that returns or edits identified referral data", () => {
    const identified = [
      "GET /api/staff/cases", "PATCH /api/staff/cases/:caseId", "POST /api/staff/navigator-events",
      "PATCH /api/staff/cases/:caseId/housing-status", "GET /api/staff/cases/:caseId/outcomes", "POST /api/staff/cases/:caseId/outcomes",
      "GET /api/cases/:caseId/events", "POST /api/events", "POST /api/intake",
      "GET /api/staff/yellowbook/cases/:caseId", "POST /api/staff/yellowbook", "PATCH /api/staff/yellowbook/:encounterId", "GET /api/staff/yellowbook/:encounterId/events", "GET /api/staff/yellowbook/:encounterId/export.pdf",
      "GET /api/staff/reports/export", "GET /api/care-portal/cases/:caseId", "GET /api/care-portal/dashboard", "GET /api/care-portal/queue", "GET /api/care-portal/files/:fileId/download",
      "POST /api/research/studies/:studyId/participant-controls", "GET /api/admin/users", "GET /api/admin/audit",
    ];
    for (const entry of identified) {
      const [method, route] = entry.split(" ");
      expect(routes.some((item) => item.method === method && item.route === route), `${entry} is registered`).toBe(true);
      expect(isResearcherAllowedRoute(method, concrete(route)), entry).toBe(false);
    }
  });

  it("matches whole paths only, ignores query strings, and treats HEAD as GET", () => {
    expect(isResearcherAllowedRoute("GET", "/api/research/access-outcomes.csv?periodDays=90")).toBe(true);
    expect(isResearcherAllowedRoute("HEAD", "/api/research/access-outcomes")).toBe(true);
    expect(isResearcherAllowedRoute("GET", "/api/research/access-outcomes/extra")).toBe(false);
    expect(isResearcherAllowedRoute("GET", "/api/staff/reports/summary/../export")).toBe(false);
    expect(isResearcherAllowedRoute("POST", "/api/research/access-outcomes")).toBe(false);
    expect(isResearcherAllowedRoute("GET", "/api/research/studies/a/b/participant-controls")).toBe(false);
  });

  it("documents a reason for every allowlisted route", () => {
    for (const entry of RESEARCHER_ALLOWED_ROUTES) expect(entry.reason.length).toBeGreaterThan(3);
  });
});

describe("pseudonymous research IDs", () => {
  it("are stable for one secret, differ across records and secrets, and never contain the record ID", () => {
    const secret = "test-secret-at-least-16-chars";
    const first = pseudonymousId("case-123", secret);
    expect(first).toMatch(/^R-[0-9a-f]{20}$/);
    expect(pseudonymousId("case-123", secret)).toBe(first);
    expect(pseudonymousId("case-124", secret)).not.toBe(first);
    expect(pseudonymousId("case-123", "another-secret-of-16-chars")).not.toBe(first);
    expect(first).not.toContain("case-123");
  });
});
