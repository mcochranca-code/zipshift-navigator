import { createHmac, randomBytes } from "node:crypto";

/**
 * Server-side route policy for research-only accounts (role `researcher`
 * with no specialist role; see shared/accessPolicy.ts).
 *
 * This is an allowlist: a research-only session may call only the routes
 * below. Every other /api route answers 403 before its handler runs, so a
 * route added later is closed to researchers until someone deliberately
 * allowlists it. Handlers keep their own checks as a second layer.
 *
 * What stays open is public reference data, the account's own session and
 * profile, de-identified aggregates (small-cell suppressed where counts could
 * single someone out), and pseudonymous study records for studies the
 * researcher is a member of.
 */
type RouteRule = { method: string; pattern: RegExp; reason: string };

const SEGMENT = "[^/]+";
const rule = (method: string, path: string, reason: string): RouteRule => ({
  method,
  pattern: new RegExp(`^${path.replaceAll(":id", SEGMENT)}$`),
  reason,
});

export const RESEARCHER_ALLOWED_ROUTES: readonly RouteRule[] = [
  // Public or self-scoped
  rule("GET", "/api/health", "public"),
  rule("GET", "/api/setup/status", "public"),
  rule("POST", "/api/auth/login", "own session"),
  rule("POST", "/api/auth/logout", "own session"),
  rule("POST", "/api/auth/forgot-password", "own account"),
  rule("POST", "/api/auth/reset-password", "own account"),
  rule("GET", "/api/auth/me", "own session"),
  rule("GET", "/api/auth/verify", "own session"),
  rule("GET", "/api/profile", "own profile"),
  rule("GET", "/api/saved-resources", "own saved list"),
  rule("PUT", "/api/saved-resources/:id", "own saved list"),
  rule("DELETE", "/api/saved-resources/:id", "own saved list"),
  rule("GET", "/api/cases/mine", "own referrals only (none for staff)"),
  rule("GET", "/api/notifications", "own notices; research items use study pseudonyms"),
  rule("GET", "/api/directory", "public provider directory"),
  rule("GET", "/api/resources/canonical", "public provider directory"),
  rule("GET", "/api/operations/schedules", "public provider hours"),
  rule("GET", "/api/providers", "public provider directory"),
  rule("GET", "/api/coverage/zips", "public coverage list"),
  rule("GET", "/api/emergency-resources", "public"),
  rule("GET", "/api/county-resources", "public"),
  rule("GET", "/api/global-settings", "public theme"),
  rule("GET", "/api/pages/:id", "public pages"),
  rule("POST", "/api/analytics/zip-search", "anonymous aggregate telemetry"),
  rule("POST", "/api/analytics/field-event", "anonymous aggregate telemetry"),
  rule("POST", "/api/feedback", "general feedback; attaching to a referral is refused in the handler"),
  // De-identified aggregates
  rule("GET", "/api/staff/reports/summary", "aggregate counts"),
  rule("GET", "/api/staff/reports/zip-demand", "aggregate, small cells suppressed"),
  rule("GET", "/api/staff/reports/field-test", "aggregate counts"),
  rule("GET", "/api/research/access-outcomes", "aggregate, small cells suppressed"),
  rule("GET", "/api/research/access-outcomes.csv", "aggregate export, audited"),
  // Pseudonymous study records, scoped to study membership in the handlers
  rule("GET", "/api/research/studies", "study list (membership-scoped)"),
  rule("GET", "/api/research/studies/:id/research-config", "study configuration (membership-scoped)"),
  rule("GET", "/api/research/studies/:id/participant-controls", "pseudonymous participants (membership-scoped)"),
  rule("GET", "/api/research/studies/:id/export.csv", "pseudonymous study export, audited"),
  rule("PATCH", "/api/research/participant-controls/:id/retention", "research retention control on a pseudonymous record"),
  rule("POST", "/api/research/participant-controls/:id/withdraw", "research withdrawal on a pseudonymous record"),
  rule("GET", "/api/research/participant-controls/:id/assessments", "pseudonymous measures"),
  rule("POST", "/api/research/participant-controls/:id/assessments", "pseudonymous measures"),
];

export const RESEARCHER_FORBIDDEN_MESSAGE = "Researcher accounts can use de-identified and aggregate research data only.";

/** Whether a research-only session may call this API route. HEAD follows GET. */
export function isResearcherAllowedRoute(method: string, path: string) {
  const verb = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";
  return RESEARCHER_ALLOWED_ROUTES.some((entry) => entry.method === verb && entry.pattern.test(cleanPath));
}

let processSecret: string | null = null;
let warnedAboutSecret = false;

/**
 * The server secret behind pseudonymous research IDs. Set
 * RESEARCH_PSEUDONYM_SECRET (32+ random bytes) so IDs stay stable across
 * restarts; without it a per-process secret is used, which still never
 * exposes a case ID but changes the pseudonyms on each restart.
 */
export function researchPseudonymSecret() {
  const configured = process.env.RESEARCH_PSEUDONYM_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (!processSecret) processSecret = randomBytes(32).toString("hex");
  if (!warnedAboutSecret && process.env.VITEST !== "true") {
    warnedAboutSecret = true;
    console.warn("RESEARCH_PSEUDONYM_SECRET is not set (or shorter than 16 characters); research pseudonyms will change when the server restarts.");
  }
  return processSecret;
}

/** Stable, non-reversible research ID for a record: HMAC-SHA256 of its ID under the server secret. */
export function pseudonymousId(recordId: string, secret = researchPseudonymSecret()) {
  return `R-${createHmac("sha256", secret).update(`zipshift-research:${recordId}`).digest("hex").slice(0, 20)}`;
}
