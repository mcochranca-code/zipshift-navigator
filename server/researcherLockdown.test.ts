import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Exercises the real Express app with an in-memory stand-in for MySQL, so the
 * researcher lockdown is proven over HTTP without a database. Every query the
 * app makes goes through `fakeQuery`; writes are captured in `executed`.
 */
const CLIENT_NAME = "Jane Q Client";
const CLIENT_EMAIL = "jane.client@example.test";
const CLIENT_PHONE = "209-555-0199";
const CLIENT_DOB = "1984-02-29";
const CLIENT_ADDRESS = "1200 Example Ave, Modesto";
const CASE_NUMBER = "CASE-2026-ABC123";
const FREE_TEXT = "Sleeping in car behind the clinic";

const state = vi.hoisted(() => ({ executed: [] as Array<{ sql: string; params: unknown[] }> }));

const identifyingRow = (index: number) => ({
  id: `case-secret-${index}`, case_id: `case-secret-${index}`, case_number: `${CASE_NUMBER}-${index}`,
  client_name: CLIENT_NAME, client_email: CLIENT_EMAIL, display_name: CLIENT_NAME, phone: CLIENT_PHONE, date_of_birth: CLIENT_DOB, address: CLIENT_ADDRESS,
  resolution_notes: FREE_TEXT, intake_json: JSON.stringify({ name: CLIENT_NAME, phone: CLIENT_PHONE, situation: FREE_TEXT }),
});

function fakeRows(sql: string): unknown[] {
  const text = sql.replace(/\s+/g, " ");
  if (text.includes("FROM referral_cases WHERE created_at >= ?")) {
    // 12 referrals experiencing homelessness with consent, so some cells are reportable.
    return Array.from({ length: 12 }, (_, index) => ({ ...identifyingRow(index), created_at: Date.now() - 10 * 86400000, housing_status: "unsheltered", sdoh_consent: 1 }));
  }
  if (text.includes("FROM referral_access_outcomes o JOIN referral_cases c")) {
    return Array.from({ length: 12 }, (_, index) => ({ ...identifyingRow(index), outcome: index < 8 ? "connected" : "not_connected", barriers_json: JSON.stringify(index < 8 ? [] : ["no_transport"]), housing_status_snapshot: "unsheltered", connected_at: Date.now() - 5 * 86400000, created_at: Date.now() - 6 * 86400000 }));
  }
  if (text.includes("FROM studies s JOIN study_memberships m")) return [{ id: "study-1" }];
  if (text.includes("FROM research_participant_controls p JOIN referral_cases c")) {
    return [{ ...identifyingRow(1), id: "control-1", pseudonym: "STUDY-1A2B3C4D", enrollment_status: "enrolled", consented_at: 1, withdrawn_at: null, retention_until: null, created_at: 1, updated_at: 1, assessment_count: 2, last_assessment_at: 2 }];
  }
  if (text.includes("FROM research_participant_controls p LEFT JOIN research_assessments a")) {
    return [{ ...identifyingRow(1), pseudonym: "STUDY-1A2B3C4D", enrollment_status: "enrolled", retention_until: null, instrument_key: "phq9", instrument_version: "2.0", score: 7, status: "complete", created_at: 1 }];
  }
  if (text.includes("SELECT c.case_number, c.service_category, c.status, c.priority, c.created_at, c.updated_at")) {
    return [{ ...identifyingRow(1), service_category: "Food", status: "new", priority: "standard", created_at: 1, updated_at: 1, assigned_name: "Staff Person" }];
  }
  return [];
}

vi.mock("mysql2/promise", () => {
  const pool = {
    query: async (sql: string, _params?: unknown[]) => [fakeRows(sql), []],
    execute: async (sql: string, params: unknown[] = []) => { state.executed.push({ sql, params }); return [{ affectedRows: 1 }, []]; },
    getConnection: async () => ({ ...pool, beginTransaction: async () => undefined, commit: async () => undefined, rollback: async () => undefined, release: () => undefined }),
    end: async () => undefined,
  };
  const createPool = () => pool;
  return { createPool, default: { createPool } };
});

vi.mock("./db/repositories", () => {
  const sessions: Record<string, { role: string; specialist_role: string | null }> = {
    "researcher-token": { role: "researcher", specialist_role: null },
    "care-token": { role: "researcher", specialist_role: "care_coordinator" },
    "admin-token": { role: "admin", specialist_role: null },
  };
  return {
    authRepository: {
      getSession: async (id: string) => sessions[id] ? { id, expires_at: Date.now() + 60000, user_id: `user-${id}`, email: `${id}@example.test`, display_name: `Staff ${id}`, ...sessions[id] } : null,
      getActiveUserByEmail: async () => null,
    },
    clientProfileRepository: { getByUserId: async () => null },
    directoryRepository: { search: async () => [] },
  };
});

const here = path.dirname(fileURLToPath(import.meta.url));
const IDENTIFIERS = [CLIENT_NAME, CLIENT_EMAIL, CLIENT_PHONE, CLIENT_DOB, CLIENT_ADDRESS, CASE_NUMBER, FREE_TEXT, "case-secret-"];

describe("researcher lockdown over HTTP", () => {
  let server: Server;
  let baseUrl = "";

  const call = (token: string, route: string, init: RequestInit = {}) => fetch(`${baseUrl}${route}`, { ...init, headers: { "content-type": "application/json", "x-session-id": token, ...(init.headers || {}) } });
  const exportAudits = () => state.executed.filter(({ sql, params }) => sql.includes("admin_audit_log") && params.includes("DATA_EXPORTED"));

  beforeAll(async () => {
    const { createZipShiftApp } = await import("./index");
    server = createServer(await createZipShiftApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
  beforeEach(() => { state.executed.length = 0; });

  it("answers 403 to a researcher on every identified or write route the server registers", async () => {
    const { isResearcherAllowedRoute } = await import("./researchAccess");
    const source = readFileSync(path.join(here, "index.ts"), "utf8");
    const routes = Array.from(source.matchAll(/app\.(get|post|put|patch|delete)\("(\/api\/[^"]+)"/g)).map(([, method, route]) => ({ method: method.toUpperCase(), route: route.replace(/:[A-Za-z]+/g, "test-id") }));
    const denied = routes.filter(({ method, route }) => !isResearcherAllowedRoute(method, route));
    expect(denied.length).toBeGreaterThan(70);
    for (const { method, route } of denied) {
      const response = await call("researcher-token", route, { method, body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify({ caseId: "case-secret-1", status: "completed", patientName: CLIENT_NAME }) });
      expect(response.status, `${method} ${route}`).toBe(403);
    }
    // Nothing was written on the researcher's behalf.
    expect(state.executed.filter(({ sql }) => /^\s*(UPDATE|DELETE)|INSERT INTO (case_events|referral_cases|yellowbook_encounters|referral_access_outcomes)/.test(sql))).toEqual([]);
  });

  it("refuses to let a researcher attach feedback to a referral (handler-level check)", async () => {
    const response = await call("researcher-token", "/api/feedback", { method: "POST", body: JSON.stringify({ caseId: "case-secret-1", accessRating: "easy", barriers: ["Hours"] }) });
    expect(response.status).toBe(403);
  });

  it("keeps identified access for administrators and care-team staff", async () => {
    expect((await call("admin-token", "/api/staff/cases")).status).toBe(200);
    expect((await call("care-token", "/api/staff/cases")).status).toBe(200);
    expect((await call("care-token", "/api/care-portal/queue")).status).toBe(200);
    const exported = await call("admin-token", "/api/staff/reports/export");
    expect(exported.status).toBe(200);
    expect(await exported.text()).toContain(CLIENT_NAME);
    expect(exportAudits()).toHaveLength(1);
    expect(JSON.parse(String(exportAudits()[0].params[5]))).toMatchObject({ exportType: "case-report-csv", identified: true, accessTier: "admin", rowCount: 1 });
  });

  it("gives a researcher the aggregate access-outcomes view and CSV with no identifiers, and audits the export", async () => {
    const view = await call("researcher-token", "/api/research/access-outcomes?periodDays=90");
    expect(view.status).toBe(200);
    const viewText = await view.text();
    for (const identifier of IDENTIFIERS) expect(viewText).not.toContain(identifier);

    const csv = await call("researcher-token", "/api/research/access-outcomes.csv?periodDays=90");
    expect(csv.status).toBe(200);
    const csvText = await csv.text();
    expect(csvText.split("\n")[0]).toBe('"section","housing_status","measure","value"');
    expect(csvText).toContain('"outcomes","unsheltered","referrals","12"');
    for (const identifier of IDENTIFIERS) expect(csvText).not.toContain(identifier);

    const audits = exportAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0].params[1]).toBe("user-researcher-token");
    const details = JSON.parse(String(audits[0].params[5]));
    expect(details).toMatchObject({ exportType: "access-outcomes-aggregate-csv", identified: false, accessTier: "researcher" });
    for (const identifier of IDENTIFIERS) expect(JSON.stringify(details)).not.toContain(identifier);
  });

  it("gives a researcher a pseudonymous study export with no identifiers, and audits it", async () => {
    const csv = await call("researcher-token", "/api/research/studies/study-1/export.csv");
    expect(csv.status).toBe(200);
    const csvText = await csv.text();
    expect(csvText).toContain("STUDY-1A2B3C4D");
    for (const identifier of IDENTIFIERS) expect(csvText).not.toContain(identifier);
    expect(JSON.parse(String(exportAudits()[0].params[5]))).toMatchObject({ exportType: "research-study-pseudonymous-csv", identified: false, rowCount: 1 });
  });

  it("returns row-level study participants to a researcher by pseudonym only", async () => {
    const response = await call("researcher-token", "/api/research/studies/study-1/participant-controls");
    expect(response.status).toBe(200);
    const text = await response.text();
    for (const identifier of IDENTIFIERS) expect(text).not.toContain(identifier);
    const body = JSON.parse(text) as { participants: Array<{ caseNumber: string | null; participantKey: string; pseudonym: string }> };
    expect(body.participants[0]).toMatchObject({ caseNumber: null, pseudonym: "STUDY-1A2B3C4D" });
    expect(body.participants[0].participantKey).toMatch(/^R-[0-9a-f]{20}$/);

    const careView = await (await call("care-token", "/api/research/studies/study-1/participant-controls")).json() as { participants: Array<{ caseNumber: string | null; participantKey: string }> };
    expect(careView.participants[0].caseNumber).toBe(`${CASE_NUMBER}-1`);
    expect(careView.participants[0].participantKey).toBe(body.participants[0].participantKey);
  });
});
