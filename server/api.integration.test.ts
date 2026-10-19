import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { createPool } from "mysql2/promise";
import { createZipShiftApp } from "./index";
import { hashPassword } from "./authUtils";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("ZipShift API workflows", () => {
  const suffix = randomUUID().slice(0, 8);
  const clientEmail = `api-client-${suffix}@example.test`;
  const adminEmail = `api-admin-${suffix}@example.test`;
  const password = "IntegrationPass123!";
  const db = createPool({ uri: databaseUrl! });
  let server: Server;
  let baseUrl = "";
  let clientCookie = "";
  let adminCookie = "";
  let clientId = "";
  let adminId = "";
  let caseId = "";
  let encounterId = "";

  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers || {}) } });
  }

  beforeAll(async () => {
    const app = await createZipShiftApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
    baseUrl = `http://127.0.0.1:${address.port}`;

    adminId = randomUUID();
    const timestamp = Date.now();
    await db.execute(
      "INSERT INTO app_users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",
      [adminId, adminEmail, "API Test Admin", hashPassword(password), timestamp, timestamp]
    );
  });

  afterAll(async () => {
    if (encounterId) await db.execute("DELETE FROM yellowbook_encounters WHERE id = ?", [encounterId]);
    if (caseId) await db.execute("DELETE FROM access_feedback WHERE case_id = ?", [caseId]);
    if (caseId) await db.execute("DELETE FROM case_events WHERE case_id = ?", [caseId]);
    if (caseId) await db.execute("DELETE FROM referral_cases WHERE id = ?", [caseId]);
    if (adminId) await db.execute("DELETE FROM generated_reports WHERE requested_by = ?", [adminId]);
    if (clientId) await db.execute("DELETE FROM saved_resources WHERE user_id = ?", [clientId]);
    if (clientId) await db.execute("DELETE FROM client_profiles WHERE user_id = ?", [clientId]);
    await db.execute("DELETE FROM app_sessions WHERE user_id IN (?, ?)", [clientId || "", adminId || ""]);
    await db.execute("DELETE FROM app_users WHERE id IN (?, ?)", [clientId || "", adminId || ""]);
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.end();
  });

  it("persists a client profile and saved-resource changes across authenticated requests", async () => {
    const register = await request("/api/auth/register", { method: "POST", body: JSON.stringify({ email: clientEmail, password, displayName: "API Client", dateOfBirth: "1990-01-01" }) });
    expect(register.status).toBe(201);
    const created = await register.json() as { user: { id: string } };
    clientId = created.user.id;
    clientCookie = register.headers.get("set-cookie")!.split(";")[0];

    const profileUpdate = await request("/api/profile", { method: "PUT", headers: { cookie: clientCookie }, body: JSON.stringify({ displayName: "  Updated Client ", phone: "209-555-0100", city: "Turlock", language: "es", accessibility: ["largeText"] }) });
    expect(profileUpdate.status).toBe(200);
    const profile = await request("/api/profile", { headers: { cookie: clientCookie } });
    expect(profile.status).toBe(200);
    await expect(profile.json()).resolves.toMatchObject({ user: { displayName: "Updated Client" }, profile: { phone: "209-555-0100", city: "Turlock", language: "es", accessibility: ["largeText"] } });

    expect((await request("/api/saved-resources/PV-0021", { method: "PUT", headers: { cookie: clientCookie } })).status).toBe(200);
    await expect((await request("/api/saved-resources", { headers: { cookie: clientCookie } })).json()).resolves.toMatchObject({ saved: [{ providerId: "PV-0021" }] });
    expect((await request("/api/saved-resources/PV-0021", { method: "DELETE", headers: { cookie: clientCookie } })).status).toBe(200);
    await expect((await request("/api/saved-resources", { headers: { cookie: clientCookie } })).json()).resolves.toMatchObject({ saved: [] });
  });

  it("protects staff routes, validates case updates, and exports role-gated reports", async () => {
    expect((await request("/api/staff/cases", { headers: { cookie: clientCookie } })).status).toBe(403);

    const intake = await request("/api/intake", { method: "POST", headers: { cookie: clientCookie }, body: JSON.stringify({ name: "Updated Client", phone: "209-555-0100", needs: ["Food & Meals"], consent: true, providerId: "PV-0030", handoff: { outcome: "confirmed", failureReason: "", documentBurden: "light", transitFeasibility: "feasible", reviewConfirmed: true } }) });
    expect(intake.status).toBe(201);
    caseId = (await intake.json() as { caseId: string }).caseId;

    const feedback = await request("/api/feedback", { method: "POST", headers: { cookie: clientCookie }, body: JSON.stringify({ caseId, accessRating: "not_easy", barriers: ["Hours", "Transit"], narrative: "The first visit required a second trip." }) });
    expect(feedback.status).toBe(201);
    const events = await request(`/api/cases/${caseId}/events`, { headers: { cookie: clientCookie } });
    expect(events.status).toBe(200);
    await expect(events.json()).resolves.toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ eventType: "ACCESS_FEEDBACK_SUBMITTED" })]) });
    const notifications = await request("/api/notifications", { headers: { cookie: clientCookie } });
    expect(notifications.status).toBe(200);
    await expect(notifications.json()).resolves.toMatchObject({ notifications: expect.arrayContaining([expect.objectContaining({ title: "Access feedback recorded" })]) });

    const login = await request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: adminEmail, password }) });
    expect(login.status).toBe(200);
    adminCookie = login.headers.get("set-cookie")!.split(";")[0];

    const yellowbook = await request("/api/staff/yellowbook", { method: "POST", headers: { cookie: adminCookie }, body: JSON.stringify({ caseId, patientName: "Updated Client", chiefComplaint: "Food access", privacyMode: true, encounterStatus: "paused", updatedByRole: "researcher", hsaiDomains: { housing: 70, health: 60, safety: 80, access: 75 }, encounter: { response: "Review verified food resources." }, plan: { immediate: "Call provider", followUp: "Check tomorrow", referral: "Food assistance" } }) });
    expect(yellowbook.status).toBe(201);
    const yellowbookBody = await yellowbook.json() as { encounter: { id: string; updatedByRole: string | null } };
    encounterId = yellowbookBody.encounter.id;
    expect(yellowbookBody.encounter.updatedByRole).toBe("admin");

    const yellowbookUpdate = await request(`/api/staff/yellowbook/${encounterId}`, { method: "PATCH", headers: { cookie: adminCookie }, body: JSON.stringify({ caseId, patientName: "Updated Client", chiefComplaint: "Food access", privacyMode: true, encounterStatus: "active", updatedByRole: "researcher", hsaiDomains: { housing: 70, health: 60, safety: 80, access: 75 }, encounter: { response: "Review verified food resources." }, plan: { immediate: "Call provider", followUp: "Check tomorrow", referral: "Food assistance" } }) });
    expect(yellowbookUpdate.status).toBe(200);
    await expect(yellowbookUpdate.json()).resolves.toMatchObject({ encounter: { updatedByRole: "admin" } });

    const yellowbookEvents = await request(`/api/staff/yellowbook/${encounterId}/events`, { headers: { cookie: adminCookie } });
    expect(yellowbookEvents.status).toBe(200);
    const yellowbookEventsBody = await yellowbookEvents.json() as { events: Array<{ eventType: string; createdAt: number; actorRole: string | null; note: string | null }> };
    expect(yellowbookEventsBody.events[0]).toMatchObject({ eventType: "YELLOWBOOK_ENCOUNTER_SAVED", actorRole: null, note: null });
    expect(yellowbookEventsBody.events[0].createdAt).toBeGreaterThanOrEqual(yellowbookEventsBody.events[1].createdAt);

    const yellowbookPdf = await request(`/api/staff/yellowbook/${encounterId}/export.pdf`, { headers: { cookie: adminCookie } });
    expect(yellowbookPdf.status).toBe(200);
    expect(yellowbookPdf.headers.get("content-type")).toContain("application/pdf");
    expect((await yellowbookPdf.arrayBuffer()).byteLength).toBeGreaterThan(500);

    expect((await request(`/api/staff/cases/${caseId}`, { method: "PATCH", headers: { cookie: adminCookie }, body: JSON.stringify({ status: "not-a-status" }) })).status).toBe(400);
    expect((await request(`/api/staff/cases/${caseId}`, { method: "PATCH", headers: { cookie: adminCookie }, body: JSON.stringify({ status: "completed", priority: "high", resolutionNotes: "Connected to pantry." }) })).status).toBe(200);

    const staffCases = await request("/api/staff/cases", { headers: { cookie: adminCookie } });
    expect(staffCases.status).toBe(200);
    const staffCasesBody = await staffCases.json() as { cases: Array<{ id: string; status: string; priority: string; intake?: { handoff?: { outcome?: string; documentBurden?: string; transitFeasibility?: string; reviewConfirmed?: boolean } } }> };
    const updatedCase = staffCasesBody.cases.find((item) => item.id === caseId);
    expect(updatedCase).toMatchObject({ id: caseId, status: "completed", priority: "high", intake: { handoff: { outcome: "confirmed", documentBurden: "light", transitFeasibility: "feasible", reviewConfirmed: true } } });

    const exportResponse = await request("/api/staff/reports/export", { headers: { cookie: adminCookie } });
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-type")).toContain("text/csv");
    await expect(exportResponse.text()).resolves.toContain("Case Number");
  });
});
