import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import directoryResources from "./data/directory-resources.json";
import providersData from "../client/src/data/providers.json";
import { hashPassword, validateEmail, validateLogicalAge, validatePassword, verifyPassword } from "./authUtils";
import { COVERED_ZIPS, isCoveredZip, presentAggregateDemand } from "./zipAnalytics";
import { createCaseCsv, hasWorkspaceAccess, isCasePriority, isCaseStatus, normalizeClientProfile } from "./workflowRules";
import { buildYellowBookPdf } from "../client/src/lib/yellowbookPdf";
import { emergencyResources } from "./emergencyResources";
import { storageGetSignedUrl, storagePut } from "./storage";
import stanislausResources from "./data/stanislaus-resources.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_COOKIE = "zipshift_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const CASE_STATUSES = ["new", "in_progress", "pending", "completed", "denied", "closed"] as const;
const CASE_PRIORITIES = ["low", "standard", "high", "urgent"] as const;
const LONGITUDINAL_MILESTONE_TYPES = ["intake", "need_identified", "referral", "aor", "task", "appointment", "encounter", "follow_up", "outcome", "handoff"] as const;
const MILESTONE_STATUSES = ["open", "in_progress", "blocked", "completed", "cancelled"] as const;
const FIELD_TEST_EVENT_TYPES = ["guided_start", "guided_completion", "guided_dropoff", "resource_open", "resource_call", "resource_directions", "resource_website"] as const;

type Role = "client" | "admin" | "researcher";
type SpecialistRole = "intake_specialist" | "medical_specialist" | "peer_support_specialist" | "sud_specialist" | "behavioral_health_specialist" | "residential_care_specialist" | "care_coordinator";
type LongitudinalMilestoneType = typeof LONGITUDINAL_MILESTONE_TYPES[number];
type MilestoneStatus = typeof MILESTONE_STATUSES[number];
const SPECIALIST_ROLES: SpecialistRole[] = ["intake_specialist", "medical_specialist", "peer_support_specialist", "sud_specialist", "behavioral_health_specialist", "residential_care_specialist", "care_coordinator"];
const INTAKE_PACKET_SEEDS = [
  ["residential-admission-packet", "Complete Residential Intake Packet", "Residential admission", "Admission checklist for Adult ASAM Level 3.5 residential intake.", "residential_care_specialist", "00_Complete_Residential_Intake_Packet.pdf", "/manus-storage/00_Complete_Residential_Intake_Packet_f73eafe8.pdf", 25],
  ["caloms-admission", "CalOMS Treatment Admission", "SUD admission", "CalOMS admission worksheet for treatment intake; not a complete submission record.", "sud_specialist", "01_CalOMS_Admission.pdf", "/manus-storage/01_CalOMS_Admission_8e0a00d1.pdf", 2],
  ["tb-screening-consent", "Tuberculosis Screening and Consent", "Clinical screening", "Residential SUD symptom and exposure screening consent.", "medical_specialist", "02_TB_Screening_Consent.pdf", "/manus-storage/02_TB_Screening_Consent_bb737b33.pdf", 2],
  ["asam-medical-necessity", "ASAM and Medical Necessity Summary", "SUD admission", "Six-dimension summary for use with the full current assessment and authorization workflow.", "sud_specialist", "03_ASAM_Medical_Necessity.pdf", "/manus-storage/03_ASAM_Medical_Necessity_6e8c4faf.pdf", 3],
  ["bhrs-materials-acknowledgment", "Beneficiary Materials Acknowledgment", "Client rights", "Stanislaus County BHRS materials offered, provided, declined, or marked N/A.", "intake_specialist", "04_BHRS_Materials_Acknowledgment.pdf", "/manus-storage/04_BHRS_Materials_Acknowledgment_2d38cba4.pdf", 2],
  ["42-cfr-part-2-provider-consent", "42 CFR Part 2 Provider Consent", "SUD consent", "Provider consent to disclose substance-use-disorder treatment information.", "sud_specialist", "42-CFR-Part-II-Provider-Consent-Form_DC_v2_Fillable.pdf", "/manus-storage/42-CFR-Part-II-Provider-Consent-Form_DC_v2_Fillable_f9b03aee.pdf", 3],
  ["california-hipaa-medical-release", "California HIPAA Medical Release", "Medical release", "California authorization for use or disclosure of health information.", "medical_specialist", "California-HIPAA-Medical-Release-Form.pdf", "/manus-storage/California-HIPAA-Medical-Release-Form_99b48624.pdf", 6],
  ["dhcs-6236", "DHCS 6236 Protected Health Information Authorization", "Medi-Cal authorization", "DHCS authorization for release of protected health information.", "medical_specialist", "DHCS_6236.pdf", "/manus-storage/DHCS_6236_b7da914a.pdf", 7],
  ["adult-biopsychosocial-assessment", "Adult Biopsychosocial Assessment", "Behavioral health", "Adult assessment for treatment goals, history, and clinical intake.", "behavioral_health_specialist", "adult_assessment.pdf", "/manus-storage/adult_assessment_105c089a.pdf", 9],
  ["cdph-6247", "CDPH 6247 Personal Information Authorization", "Privacy authorization", "California Department of Public Health authorization for use and disclosure of personal information.", "care_coordinator", "cdph6247.pdf", "/manus-storage/cdph6247_522ab8e1.pdf", 4],
] as const;
type CaseStatus = (typeof CASE_STATUSES)[number];
type CasePriority = (typeof CASE_PRIORITIES)[number];
type GlobalEditorSettings = {
  brandColor: string;
  accentColor: string;
  surfaceColor: string;
  textScale: number;
  radiusScale: number;
  sidebarDefaultCollapsed: boolean;
};
type StudyStatus = "draft" | "active" | "paused" | "archived";
type ProtocolStatus = "draft" | "active" | "retired";
type ConsentStatus = "draft" | "active" | "retired";
type ConsentPurpose = "research_participation" | "data_use" | "contact" | "future_use";
type ConsentDecision = "granted" | "declined" | "withdrawn";
type DictionaryStatus = "draft" | "active" | "retired";
type VariableDataType = "text" | "integer" | "decimal" | "boolean" | "date" | "datetime" | "single_select" | "multi_select";
type VariableRole = "identifier" | "exposure" | "outcome" | "covariate" | "measure" | "metadata";
type InstrumentStatus = "draft" | "active" | "retired";
type InstrumentMode = "form" | "interview" | "self_report" | "import";
type ResponseType = "text" | "number" | "date" | "boolean" | "single_select" | "multi_select" | "likert" | "note";
const DEFAULT_GLOBAL_EDITOR_SETTINGS: GlobalEditorSettings = {
  brandColor: "#159d92",
  accentColor: "#0d8077",
  surfaceColor: "#f7f9fc",
  textScale: 1,
  radiusScale: 1,
  sidebarDefaultCollapsed: false,
};

interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  specialistRole?: SpecialistRole | null;
}

interface SessionContext {
  id: string;
  expiresAt: number;
  user: AppUser;
}

interface DirectoryRecord {
  sourceId: string;
  name: string;
  category: string;
  city: string;
  zip: string | null;
  address: string | null;
  phone: string | null;
  verified: boolean;
  hsaiScore: number | null;
  transitBurden: string | null;
  requiredDocs: string[];
  latitude: number | null;
  longitude: number | null;
  intakeNotes: string | null;
  accessOutcome: string | null;
  serviceNotes: string | null;
  source: string;
}

interface NavigatorProvider {
  record_id: string;
  org_name: string;
  program_name?: string;
  city: string;
  address: string;
  phone: string;
  service_category: string;
  hours?: string;
  verification_status?: string;
  hsai_score?: number;
  [key: string]: unknown;
}

const db = createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 8,
  enableKeepAlive: true,
});

function now() {
  return Date.now();
}
function isSpecialistRole(value: unknown): value is SpecialistRole { return typeof value === "string" && SPECIALIST_ROLES.includes(value as SpecialistRole); }

function parseCookies(header?: string) {
  return Object.fromEntries(
    (header || "")
      .split(";")
      .map((entry) => entry.trim().split(/=(.*)/))
      .filter(([key]) => key)
      .map(([key, value]) => [key, decodeURIComponent(value || "")])
  );
}

function userFromRow(row: RowDataPacket): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as Role,
    specialistRole: row.specialist_role || null,
  };
}

async function getSession(req: Request): Promise<SessionContext | null> {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[SESSION_COOKIE] || (req.headers["x-session-id"] as string | undefined);
  if (!sessionId) return null;

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT s.id, s.expires_at, u.id AS user_id, u.email, u.display_name, u.role, u.specialist_role
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.is_active = TRUE`,
    [sessionId, now()]
  );

  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    expiresAt: Number(rows[0].expires_at),
    user: {
      id: rows[0].user_id,
      email: rows[0].email,
      displayName: rows[0].display_name,
      role: rows[0].role as Role,
      specialistRole: rows[0].specialist_role || null,
    },
  };
}

function sendSessionCookie(res: Response, sessionId: string) {
  res.cookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_MS,
    path: "/",
  });
}

async function startSession(res: Response, userId: string) {
  const sessionId = randomBytes(32).toString("hex");
  const createdAt = now();
  await db.execute(
    "INSERT INTO app_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    [sessionId, userId, createdAt + SESSION_DURATION_MS, createdAt]
  );
  sendSessionCookie(res, sessionId);
}

async function requireSession(req: Request, res: Response): Promise<SessionContext | null> {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ error: "Sign in is required." });
    return null;
  }
  return session;
}

async function requireRole(req: Request, res: Response, roles: Role[]): Promise<SessionContext | null> {
  const session = await requireSession(req, res);
  if (!session) return null;
  if (!hasWorkspaceAccess(session.user.role, roles)) {
    res.status(403).json({ error: "You do not have permission to access this workspace." });
    return null;
  }
  return session;
}

async function hasStudyAccess(session: SessionContext, studyId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    session.user.role === "admin"
      ? "SELECT id FROM studies WHERE id = ? LIMIT 1"
      : "SELECT s.id FROM studies s JOIN study_memberships m ON m.study_id = s.id AND m.user_id = ? AND m.is_active = TRUE WHERE s.id = ? LIMIT 1",
    session.user.role === "admin" ? [studyId] : [session.user.id, studyId]
  );
  return Boolean(rows[0]);
}

async function requireCareTeam(req: Request, res: Response): Promise<SessionContext | null> {
  const session = await requireRole(req, res, ["admin", "researcher"]);
  if (!session) return null;
  return session;
}

function resolveCareTeam(session: SessionContext, requested: unknown): SpecialistRole {
  const requestedTeam = typeof requested === "string" && isSpecialistRole(requested) ? requested : null;
  if (session.user.role === "admin" && requestedTeam) return requestedTeam;
  return session.user.specialistRole || requestedTeam || "care_coordinator";
}

function hasMilestonePermission(session: SessionContext, assignedTeam: SpecialistRole, action: "read" | "write" | "complete" | "cancel") {
  if (session.user.role === "admin") return true;
  if (session.user.role === "researcher") return action === "read";
  if (!session.user.specialistRole) return false;
  if (session.user.specialistRole === "care_coordinator") return true;
  return session.user.specialistRole === assignedTeam;
}

async function syncCaseMilestone({ caseId, actorUserId, actorRole, milestoneType, assignedTeam, title, summary, status, source }: { caseId: string; actorUserId: string; actorRole: string; milestoneType: LongitudinalMilestoneType; assignedTeam: SpecialistRole; title: string; summary?: string; status: MilestoneStatus; source?: Record<string, unknown> }) {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, status, title, summary, metadata_json FROM case_milestones WHERE case_id = ? AND milestone_type = ? AND assigned_team = ? ORDER BY created_at DESC LIMIT 1", [caseId, milestoneType, assignedTeam]);
  const timestamp = now();
  if (!rows[0]) {
    const milestoneId = randomUUID();
    await db.execute("INSERT INTO case_milestones (id, case_id, milestone_type, status, assigned_team, title, summary, metadata_json, created_by, created_at, updated_by, updated_at, completed_by, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [milestoneId, caseId, milestoneType, status, assignedTeam, title.slice(0, 180), summary?.slice(0, 4000) || null, JSON.stringify({ source: source || {}, automatic: true }), actorUserId, timestamp, actorUserId, timestamp, status === "completed" ? actorUserId : null, status === "completed" ? timestamp : null]);
    await db.execute("INSERT INTO case_milestone_audit_events (id, milestone_id, case_id, actor_user_id, actor_role, action, previous_status, next_status, details_json, created_at) VALUES (?, ?, ?, ?, ?, 'MILESTONE_AUTO_SYNCED', NULL, ?, ?, ?)", [randomUUID(), milestoneId, caseId, actorUserId, actorRole, status, JSON.stringify({ automatic: true, milestoneType, assignedTeam, source: source || {} }), timestamp]);
    return milestoneId;
  }
  if (["completed", "cancelled"].includes(String(rows[0].status)) || rows[0].status === status) return rows[0].id as string;
  await db.execute("UPDATE case_milestones SET status = ?, title = ?, summary = ?, metadata_json = ?, updated_by = ?, updated_at = ?, completed_by = ?, completed_at = ? WHERE id = ?", [status, title.slice(0, 180), summary?.slice(0, 4000) || rows[0].summary || null, JSON.stringify({ ...parseJson<Record<string, unknown>>(rows[0].metadata_json, {}), source: source || {}, automatic: true }), actorUserId, timestamp, status === "completed" ? actorUserId : null, status === "completed" ? timestamp : null, rows[0].id]);
  await db.execute("INSERT INTO case_milestone_audit_events (id, milestone_id, case_id, actor_user_id, actor_role, action, previous_status, next_status, details_json, created_at) VALUES (?, ?, ?, ?, ?, 'MILESTONE_AUTO_SYNCED', ?, ?, ?, ?)", [randomUUID(), rows[0].id, caseId, actorUserId, actorRole, rows[0].status, status, JSON.stringify({ automatic: true, milestoneType, assignedTeam, source: source || {} }), timestamp]);
  return rows[0].id as string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const STUDY_STATUSES: StudyStatus[] = ["draft", "active", "paused", "archived"];
const PROTOCOL_STATUSES: ProtocolStatus[] = ["draft", "active", "retired"];
const CONSENT_STATUSES: ConsentStatus[] = ["draft", "active", "retired"];
const CONSENT_PURPOSES: ConsentPurpose[] = ["research_participation", "data_use", "contact", "future_use"];
const CONSENT_DECISIONS: ConsentDecision[] = ["granted", "declined", "withdrawn"];
const DICTIONARY_STATUSES: DictionaryStatus[] = ["draft", "active", "retired"];
const VARIABLE_DATA_TYPES: VariableDataType[] = ["text", "integer", "decimal", "boolean", "date", "datetime", "single_select", "multi_select"];
const VARIABLE_ROLES: VariableRole[] = ["identifier", "exposure", "outcome", "covariate", "measure", "metadata"];
const INSTRUMENT_STATUSES: InstrumentStatus[] = ["draft", "active", "retired"];
const INSTRUMENT_MODES: InstrumentMode[] = ["form", "interview", "self_report", "import"];
const RESPONSE_TYPES: ResponseType[] = ["text", "number", "date", "boolean", "single_select", "multi_select", "likert", "note"];

export function isSafeKey(value: unknown): value is string { return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{2,79}$/.test(value); }
function isStudyStatus(value: unknown): value is StudyStatus { return typeof value === "string" && STUDY_STATUSES.includes(value as StudyStatus); }
function isProtocolStatus(value: unknown): value is ProtocolStatus { return typeof value === "string" && PROTOCOL_STATUSES.includes(value as ProtocolStatus); }
function isConsentStatus(value: unknown): value is ConsentStatus { return typeof value === "string" && CONSENT_STATUSES.includes(value as ConsentStatus); }
function isConsentPurpose(value: unknown): value is ConsentPurpose { return typeof value === "string" && CONSENT_PURPOSES.includes(value as ConsentPurpose); }
function isConsentDecision(value: unknown): value is ConsentDecision { return typeof value === "string" && CONSENT_DECISIONS.includes(value as ConsentDecision); }
function isDictionaryStatus(value: unknown): value is DictionaryStatus { return typeof value === "string" && DICTIONARY_STATUSES.includes(value as DictionaryStatus); }
function isVariableDataType(value: unknown): value is VariableDataType { return typeof value === "string" && VARIABLE_DATA_TYPES.includes(value as VariableDataType); }
function isVariableRole(value: unknown): value is VariableRole { return typeof value === "string" && VARIABLE_ROLES.includes(value as VariableRole); }
function isInstrumentStatus(value: unknown): value is InstrumentStatus { return typeof value === "string" && INSTRUMENT_STATUSES.includes(value as InstrumentStatus); }
function isInstrumentMode(value: unknown): value is InstrumentMode { return typeof value === "string" && INSTRUMENT_MODES.includes(value as InstrumentMode); }
function isResponseType(value: unknown): value is ResponseType { return typeof value === "string" && RESPONSE_TYPES.includes(value as ResponseType); }
export function normalizeResearchValueList(value: unknown): Array<string | number | boolean> | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  return value.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean") ? value : null;
}
function nullableDate(value: unknown): string | null | undefined { return value === undefined ? undefined : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }

export function normalizeGlobalEditorSettings(input: Partial<GlobalEditorSettings>): GlobalEditorSettings {
  const hex = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  const scale = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    brandColor: hex(input.brandColor, DEFAULT_GLOBAL_EDITOR_SETTINGS.brandColor),
    accentColor: hex(input.accentColor, DEFAULT_GLOBAL_EDITOR_SETTINGS.accentColor),
    surfaceColor: hex(input.surfaceColor, DEFAULT_GLOBAL_EDITOR_SETTINGS.surfaceColor),
    textScale: scale(input.textScale, DEFAULT_GLOBAL_EDITOR_SETTINGS.textScale, 0.9, 1.2),
    radiusScale: scale(input.radiusScale, DEFAULT_GLOBAL_EDITOR_SETTINGS.radiusScale, 0.75, 1.25),
    sidebarDefaultCollapsed: typeof input.sidebarDefaultCollapsed === "boolean" ? input.sidebarDefaultCollapsed : DEFAULT_GLOBAL_EDITOR_SETTINGS.sidebarDefaultCollapsed,
  };
}

async function readGlobalEditorSettings(): Promise<GlobalEditorSettings> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT setting_key, value_json FROM admin_global_settings");
  const stored = Object.fromEntries(rows.map((row) => [row.setting_key, parseJson(row.value_json, null)]));
  return normalizeGlobalEditorSettings({ ...DEFAULT_GLOBAL_EDITOR_SETTINGS, ...stored });
}

async function recordAdminAudit(actorUserId: string, action: string, targetType: string, targetId: string | null, details: Record<string, unknown> = {}) {
  await db.execute(
    "INSERT INTO admin_audit_log (id, actor_user_id, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), actorUserId, action, targetType, targetId, JSON.stringify(details), now()]
  );
}

function compact(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCanonicalProvider(record: DirectoryRecord): NavigatorProvider | null {
  const normalizedPhone = compact(record.phone);
  const normalizedAddress = compact(record.address);
  const normalizedName = compact(record.name);
  const candidates = providersData as NavigatorProvider[];
  return candidates.find((provider) => {
    const samePhone = normalizedPhone.length >= 7 && normalizedPhone === compact(provider.phone);
    const sameAddress = normalizedAddress.length >= 8 && normalizedAddress === compact(provider.address);
    const providerName = compact(provider.org_name);
    const sameName = normalizedName.length >= 8 && (normalizedName === providerName || normalizedName.includes(providerName) || providerName.includes(normalizedName));
    return samePhone || sameName || (sameAddress && sameName);
  }) || null;
}

function normalizeCase(row: RowDataPacket) {
  return {
    id: row.id,
    caseNumber: row.case_number,
    clientName: row.client_name || "Client not yet linked",
    clientEmail: row.client_email || null,
    providerId: row.provider_id || null,
    studyId: row.study_id || null,
    protocolVersionId: row.protocol_version_id || null,
    serviceCategory: row.service_category,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_name || null,
    assignedToId: row.assigned_to || null,
    intake: parseJson<Record<string, unknown>>(row.intake_json, {}),
    resolutionNotes: row.resolution_notes || "",
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    closedAt: row.closed_at ? Number(row.closed_at) : null,
  };
}

function normalizeStudy(row: RowDataPacket) {
  return {
    id: row.id,
    studyKey: row.study_key,
    title: row.title,
    description: row.description || "",
    status: row.status as StudyStatus,
    protocolVersion: row.protocol_version,
    ownerUserId: row.owner_user_id || null,
    ownerName: row.owner_name || null,
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    memberCount: row.member_count === undefined ? undefined : Number(row.member_count),
    protocolCount: row.protocol_count === undefined ? undefined : Number(row.protocol_count),
    consentDocumentCount: row.consent_document_count === undefined ? undefined : Number(row.consent_document_count),
  };
}

function normalizeProtocol(row: RowDataPacket) {
  return { id: row.id, studyId: row.study_id, version: row.version, title: row.title, summary: parseJson<Record<string, unknown>>(row.summary_json, {}), status: row.status as ProtocolStatus, effectiveAt: row.effective_at ? Number(row.effective_at) : null, createdBy: row.created_by, createdByName: row.created_by_name || null, createdAt: Number(row.created_at) };
}

function normalizeConsentDocument(row: RowDataPacket) {
  return { id: row.id, studyId: row.study_id, purpose: row.purpose as ConsentPurpose, version: row.version, language: row.language, title: row.title, body: row.body, status: row.status as ConsentStatus, effectiveAt: row.effective_at ? Number(row.effective_at) : null, createdBy: row.created_by, createdByName: row.created_by_name || null, createdAt: Number(row.created_at), decision: row.decision || null, decidedAt: row.decided_at ? Number(row.decided_at) : null, withdrawnAt: row.withdrawn_at ? Number(row.withdrawn_at) : null };
}

function normalizeDictionary(row: RowDataPacket) {
  return { id: row.id, studyId: row.study_id, version: row.version, title: row.title, description: row.description || "", status: row.status as DictionaryStatus, createdBy: row.created_by, createdByName: row.created_by_name || null, createdAt: Number(row.created_at), variableCount: row.variable_count === undefined ? undefined : Number(row.variable_count) };
}

function normalizeVariable(row: RowDataPacket) {
  return { id: row.id, dictionaryVersionId: row.dictionary_version_id, variableKey: row.variable_key, label: row.label, description: row.description || "", dataType: row.data_type as VariableDataType, variableRole: row.variable_role as VariableRole, unit: row.unit || "", permissibleValues: parseJson<unknown[]>(row.permissible_values_json, []), sourceField: row.source_field || "", isRequired: Boolean(row.is_required), isSensitive: Boolean(row.is_sensitive), isDerived: Boolean(row.is_derived), displayOrder: Number(row.display_order) };
}

function normalizeInstrument(row: RowDataPacket) {
  return { id: row.id, studyId: row.study_id, instrumentKey: row.instrument_key, version: row.version, title: row.title, purpose: row.purpose || "", scoringRules: parseJson<Record<string, unknown>>(row.scoring_rules_json, {}), status: row.status as InstrumentStatus, mode: row.mode as InstrumentMode, createdBy: row.created_by, createdByName: row.created_by_name || null, createdAt: Number(row.created_at), itemCount: row.item_count === undefined ? undefined : Number(row.item_count) };
}

function normalizeInstrumentItem(row: RowDataPacket) {
  return { id: row.id, instrumentId: row.instrument_id, variableId: row.variable_id || null, itemKey: row.item_key, itemOrder: Number(row.item_order), prompt: row.prompt, responseType: row.response_type as ResponseType, config: parseJson<Record<string, unknown>>(row.config_json, {}), isRequired: Boolean(row.is_required), variableKey: row.variable_key || null, variableLabel: row.variable_label || null };
}

function normalizeYellowBook(row: RowDataPacket) {
  return {
    id: row.id,
    caseId: row.case_id,
    caseNumber: row.case_number || "",
    patientName: row.patient_name || "Client record",
    chiefComplaint: row.chief_complaint || "",
    narrative: row.narrative || "",
    encounterStatus: row.encounter_status || "active",
    privacyMode: Boolean(row.privacy_mode),
    adaptiveBranch: row.adaptive_branch || "general-navigation",
    hsaiScore: row.hsai_score === null || row.hsai_score === undefined ? null : Number(row.hsai_score),
    hsaiDomains: parseJson<Record<string, number>>(row.hsai_domains_json, { housing: 0, health: 0, safety: 0, access: 0 }),
    encounter: parseJson<Record<string, string>>(row.encounter_json, { question: "What would make the next 72 hours safer or more stable?", response: "", barriers: "" }),
    plan: parseJson<Record<string, string>>(row.plan_json, { immediate: "", followUp: "", referral: "" }),
    updatedAt: Number(row.updated_at),
    updatedByRole: row.updated_by_role || null,
  };
}

async function importDirectoryOnce() {
  const importedAt = now();
  for (const record of directoryResources as DirectoryRecord[]) {
    const canonicalProvider = findCanonicalProvider(record);
    await db.execute(
      `INSERT IGNORE INTO directory_resources
       (id, source_id, canonical_provider_id, name, category, city, zip, address, phone, verified, hsai_score, transit_burden,
        required_docs_json, latitude, longitude, intake_notes, access_outcome, service_notes, source, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), record.sourceId, canonicalProvider?.record_id || null, record.name, record.category, record.city, record.zip, record.address,
        record.phone, record.verified, record.hsaiScore, record.transitBurden, JSON.stringify(record.requiredDocs),
        record.latitude, record.longitude, record.intakeNotes, record.accessOutcome, record.serviceNotes,
        record.source, importedAt,
      ]
    );
    await db.execute("UPDATE directory_resources SET canonical_provider_id = ? WHERE source_id = ?", [canonicalProvider?.record_id || null, record.sourceId]);
  }
}

async function seedIntakePacketLibrary() {
  const timestamp = now();
  for (const [slug, title, category, description, requiredRole, fileName, storageUrl, pageCount] of INTAKE_PACKET_SEEDS) {
    await db.execute(
      `INSERT INTO intake_packet_forms (id, slug, title, category, description, required_role, source_file_name, storage_url, page_count, official_notice, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), category = VALUES(category), description = VALUES(description), required_role = VALUES(required_role), source_file_name = VALUES(source_file_name), storage_url = VALUES(storage_url), page_count = VALUES(page_count), updated_at = VALUES(updated_at)`,
      [randomUUID(), slug, title, category, description, requiredRole, fileName, storageUrl, pageCount, "Official source PDF supplied by the user. Preserve the original form and follow current organizational, county, state, and federal policy.", timestamp, timestamp]
    );
  }
}

async function hasAdmin() {
  const [rows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM app_users WHERE role = 'admin' AND is_active = TRUE");
  return Number(rows[0]?.count || 0) > 0;
}

async function createCase({
  clientId,
  providerId,
  studyId,
  protocolVersionId,
  serviceCategory,
  priority = "standard",
  intake,
  eventType = "CONTACT_WEBFORM_SUBMIT",
}: {
  clientId?: string | null;
  providerId?: string | null;
  studyId?: string | null;
  protocolVersionId?: string | null;
  serviceCategory: string;
  priority?: CasePriority;
  intake: Record<string, unknown>;
  eventType?: string;
}) {
  const id = randomUUID();
  const createdAt = now();
  const caseNumber = `CASE-${new Date(createdAt).getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  await db.execute(
    `INSERT INTO referral_cases
     (id, case_number, client_id, provider_id, study_id, protocol_version_id, service_category, status, priority, intake_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
    [id, caseNumber, clientId || null, providerId || null, studyId || null, protocolVersionId || null, serviceCategory, priority, JSON.stringify(intake), createdAt, createdAt]
  );
  await db.execute(
    "INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [randomUUID(), id, clientId || null, eventType, JSON.stringify(intake), "Case created from a service request.", createdAt]
  );
  if (clientId) {
    await syncCaseMilestone({ caseId: id, actorUserId: clientId, actorRole: "client", milestoneType: "intake", assignedTeam: "intake_specialist", title: "Referral received", summary: "Initial referral intake is ready for review.", status: "open", source: { eventType } });
  }
  return { id, caseNumber, createdAt };
}

export async function createZipShiftApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  await importDirectoryOnce();
  await seedIntakePacketLibrary();

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/setup/status", async (_req, res) => {
    res.json({ needsAdminSetup: !(await hasAdmin()) });
  });

  app.post("/api/setup/admin", async (req, res) => {
    const { email, password, displayName } = req.body as { email?: string; password?: string; displayName?: string };
    if (await hasAdmin()) return res.status(409).json({ error: "An administrator has already been configured." });
    if (!displayName?.trim() || displayName.trim().length < 2 || displayName.trim().length > 100 || !validateEmail(email) || !validatePassword(password)) {
      return res.status(400).json({ error: "Provide a valid name, email, and a password of at least 12 characters containing letters and numbers." });
    }
    const safeEmail = (email as string).trim().toLowerCase();
    const safePassword = password as string;
    const timestamp = now();
    const user: AppUser = { id: randomUUID(), email: safeEmail, displayName: displayName.trim(), role: "admin" };
    try {
      await db.execute(
        "INSERT INTO app_users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",
        [user.id, user.email, user.displayName, hashPassword(safePassword), timestamp, timestamp]
      );
      await startSession(res, user.id);
      res.status(201).json({ user });
    } catch (error: any) {
      res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "An account with that email already exists." : "Unable to create the administrator account." });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, displayName, dateOfBirth } = req.body as { email?: string; password?: string; displayName?: string; dateOfBirth?: string };
    if (!displayName?.trim() || displayName.trim().length < 2 || displayName.trim().length > 100 || !validateEmail(email) || !validatePassword(password)) {
      return res.status(400).json({ error: "Provide a valid name, email, and a password of at least 12 characters containing letters and numbers." });
    }
    const ageCheck = validateLogicalAge(dateOfBirth);
    if (!ageCheck.valid) {
      return res.status(400).json({ error: ageCheck.error });
    }
    const safeEmail = (email as string).trim().toLowerCase();
    const safePassword = password as string;
    const safeDateOfBirth = dateOfBirth as string;
    const timestamp = now();
    const user: AppUser = { id: randomUUID(), email: safeEmail, displayName: displayName.trim(), role: "client" };
    try {
      await db.execute(
        "INSERT INTO app_users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'client', ?, ?)",
        [user.id, user.email, user.displayName, hashPassword(safePassword), timestamp, timestamp]
      );
      await db.execute("INSERT INTO client_profiles (user_id, date_of_birth, updated_at) VALUES (?, ?, ?)", [user.id, safeDateOfBirth, timestamp]);
      await startSession(res, user.id);
      res.status(201).json({ user });
    } catch (error: any) {
      res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "An account with that email already exists." : "Unable to create the account." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, username, password } = req.body as { email?: string; username?: string; password?: string };
    const identifier = (email || username || "").trim().toLowerCase();
    if (!identifier || !password) return res.status(400).json({ error: "Email and password are required." });

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM app_users WHERE email = ? AND is_active = TRUE LIMIT 1",
      [identifier]
    );
    const row = rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const user = userFromRow(row);
    await startSession(res, user.id);
    res.json({ user });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const generic = "If an active account exists for that email, password-reset instructions are ready.";
    if (!validateEmail(email)) return res.json({ message: generic });
    const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM app_users WHERE email = ? AND is_active = TRUE LIMIT 1", [email]);
    if (!rows[0]) return res.json({ message: generic });
    const rawToken = randomBytes(32).toString("hex");
    const timestamp = now();
    await db.execute("DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at < ?", [rows[0].id, timestamp]);
    await db.execute("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)", [randomUUID(), rows[0].id, createHash("sha256").update(rawToken).digest("hex"), timestamp + 30 * 60 * 1000, timestamp]);
    res.json({ message: generic, ...(process.env.NODE_ENV !== "production" ? { resetToken: rawToken } : {}) });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !validatePassword(password)) return res.status(400).json({ error: "Use a valid reset link and a password of at least 12 characters containing letters and numbers." });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1", [tokenHash, now()]);
    if (!rows[0]) return res.status(400).json({ error: "This reset link is invalid or has expired." });
    const timestamp = now();
    await db.execute("UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ? AND is_active = TRUE", [hashPassword(password as string), timestamp, rows[0].user_id]);
    await db.execute("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?", [timestamp, rows[0].id]);
    await db.execute("DELETE FROM app_sessions WHERE user_id = ?", [rows[0].user_id]);
    res.json({ success: true, message: "Password updated. Please sign in again." });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const session = await getSession(req);
    if (session) await db.execute("DELETE FROM app_sessions WHERE id = ?", [session.id]);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Not signed in." });
    res.json({ user: session.user, expiresAt: session.expiresAt });
  });

  app.get("/api/auth/verify", async (req, res) => {
    const session = await getSession(req);
    if (!session) return res.status(401).json({ error: "Not signed in." });
    res.json({ user: session.user });
  });

  app.get("/api/profile", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT phone, city, language, accessibility_json FROM client_profiles WHERE user_id = ?", [session.user.id]);
    res.json({ user: session.user, profile: rows[0] ? { phone: rows[0].phone, city: rows[0].city, language: rows[0].language, accessibility: parseJson(rows[0].accessibility_json, []) } : null });
  });

  app.put("/api/profile", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    if (session.user.role !== "client") return res.status(403).json({ error: "Only client profiles can be updated here." });
    const profile = normalizeClientProfile(req.body as Record<string, unknown>, session.user.displayName);
    const timestamp = now();
    await db.execute("UPDATE app_users SET display_name = ?, updated_at = ? WHERE id = ?", [profile.displayName, timestamp, session.user.id]);
    await db.execute(
      `INSERT INTO client_profiles (user_id, phone, city, language, accessibility_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE phone = VALUES(phone), city = VALUES(city), language = VALUES(language), accessibility_json = VALUES(accessibility_json), updated_at = VALUES(updated_at)`,
      [
        session.user.id,
        profile.phone,
        profile.city,
        profile.language,
        JSON.stringify(profile.accessibility),
        timestamp,
      ]
    );
    res.json({ success: true });
  });

  app.get("/api/saved-resources", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT provider_id, created_at FROM saved_resources WHERE user_id = ? ORDER BY created_at DESC", [session.user.id]);
    res.json({ saved: rows.map((row) => ({ providerId: row.provider_id, createdAt: Number(row.created_at) })) });
  });

  app.put("/api/saved-resources/:providerId", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    await db.execute("INSERT IGNORE INTO saved_resources (user_id, provider_id, created_at) VALUES (?, ?, ?)", [session.user.id, req.params.providerId, now()]);
    res.json({ success: true });
  });

  app.delete("/api/saved-resources/:providerId", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    await db.execute("DELETE FROM saved_resources WHERE user_id = ? AND provider_id = ?", [session.user.id, req.params.providerId]);
    res.json({ success: true });
  });

  app.get("/api/directory", async (req, res) => {
    const search = String(req.query.search || "").trim();
    const city = String(req.query.city || "").trim();
    const category = String(req.query.category || "").trim();
    const clauses = ["1 = 1"];
    const params: unknown[] = [];
    if (search) {
      clauses.push("(name LIKE ? OR category LIKE ? OR city LIKE ? OR address LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (city) {
      clauses.push("city = ?");
      params.push(city);
    }
    if (category) {
      clauses.push("category = ?");
      params.push(category);
    }
    const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM directory_resources WHERE ${clauses.join(" AND ")} ORDER BY city, name`, params);
    res.json({ resources: rows.map((row) => ({
      id: row.id, sourceId: row.source_id, name: row.name, category: row.category, city: row.city, zip: row.zip,
      canonicalProviderId: row.canonical_provider_id || null,
      address: row.address, phone: row.phone, verified: Boolean(row.verified), hsaiScore: Number(row.hsai_score),
      transitBurden: row.transit_burden, requiredDocs: parseJson(row.required_docs_json, []), latitude: Number(row.latitude),
      longitude: Number(row.longitude), intakeNotes: row.intake_notes, accessOutcome: row.access_outcome, serviceNotes: row.service_notes,
    })) });
  });

  app.get("/api/resources/canonical", async (_req, res) => {
    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM directory_resources ORDER BY city, name");
    const [scheduleRows] = await db.query<RowDataPacket[]>("SELECT provider_id, schedule_summary, verification_state, source_document FROM provider_operating_requirements");
    const scheduleByProvider = new Map(scheduleRows.map((row) => [row.provider_id, { summary: row.schedule_summary, state: row.verification_state, source: row.source_document }]));
    const linkedDirectory = new Map<string, RowDataPacket[]>();
    const directoryOnly: RowDataPacket[] = [];
    for (const row of rows) {
      if (row.canonical_provider_id) {
        const current = linkedDirectory.get(row.canonical_provider_id) || [];
        current.push(row);
        linkedDirectory.set(row.canonical_provider_id, current);
      } else {
        directoryOnly.push(row);
      }
    }

    const navigatorResources = (providersData as NavigatorProvider[]).map((provider) => ({
      id: provider.record_id,
      source: "navigator",
      name: provider.org_name,
      programName: provider.program_name || null,
      category: provider.service_category,
      city: provider.city,
      address: provider.address,
      phone: provider.phone,
      hours: provider.hours || null,
      verified: provider.verification_status === "Verified",
      hsaiScore: provider.hsai_score || null,
      directoryReferences: (linkedDirectory.get(provider.record_id) || []).map((row) => row.source_id),
      operatingSchedule: scheduleByProvider.get(provider.record_id)?.summary || null,
      scheduleSource: scheduleByProvider.get(provider.record_id)?.source || null,
    }));
    const distinctDirectory = directoryOnly.map((row) => ({
      id: row.id,
      source: "attached-directory",
      name: row.name,
      programName: null,
      category: row.category,
      city: row.city,
      address: row.address,
      phone: row.phone,
      hours: null,
      verified: Boolean(row.verified),
      hsaiScore: Number(row.hsai_score),
      directoryReferences: [row.source_id],
    }));
    res.json({
      resources: [...navigatorResources, ...distinctDirectory],
      sourceCounts: { navigator: navigatorResources.length, directoryOnly: distinctDirectory.length, linkedDirectoryRecords: rows.length - distinctDirectory.length },
    });
  });

  app.get("/api/operations/schedules", async (_req, res) => {
    const [rows] = await db.query<RowDataPacket[]>("SELECT provider_id, provider_name, schedule_summary, verification_state, source_document FROM provider_operating_requirements ORDER BY provider_name");
    res.json({ schedules: rows.map((row) => ({ providerId: row.provider_id, providerName: row.provider_name, scheduleSummary: row.schedule_summary, verificationState: row.verification_state, sourceDocument: row.source_document })) });
  });

  app.get("/api/providers", (_req, res) => res.json(providersData));

  app.get("/api/coverage/zips", (_req, res) => {
    res.json({ zipCodes: COVERED_ZIPS, privacy: "Zip selections are aggregated by day. ZipShift does not retain IP addresses or user identifiers with search demand." });
  });

  app.post("/api/analytics/zip-search", async (req, res) => {
    const zipCode = typeof req.body?.zipCode === "string" ? req.body.zipCode.trim() : "";
    if (!isCoveredZip(zipCode)) return res.status(400).json({ error: "Select a covered five-digit ZIP code." });
    const searchDate = new Date().toISOString().slice(0, 10);
    await db.execute(
      `INSERT INTO zip_search_aggregates (search_date, zip_code, search_count, updated_at)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE search_count = search_count + 1, updated_at = VALUES(updated_at)`,
      [searchDate, zipCode, now()]
    );
    res.status(204).end();
  });

  app.post("/api/analytics/field-event", async (req, res) => {
    const eventType = typeof req.body?.eventType === "string" ? req.body.eventType : "";
    const resourceId = typeof req.body?.resourceId === "string" ? req.body.resourceId.trim().slice(0, 180) || null : null;
    const sessionKey = typeof req.body?.sessionKey === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(req.body.sessionKey) ? req.body.sessionKey : null;
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata) ? req.body.metadata : {};
    if (!FIELD_TEST_EVENT_TYPES.includes(eventType as typeof FIELD_TEST_EVENT_TYPES[number])) return res.status(400).json({ error: "Unsupported field-test event." });
    await db.execute("INSERT INTO field_test_events (id, event_type, resource_id, session_key, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)", [randomUUID(), eventType, resourceId, sessionKey, JSON.stringify(metadata), now()]);
    res.status(204).end();
  });

  app.get("/api/staff/reports/field-test", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const periodDays = 30;
    const periodStart = now() - periodDays * 24 * 60 * 60 * 1000;
    const [rows, historyRows] = await Promise.all([
      db.query<RowDataPacket[]>("SELECT event_type, COUNT(*) AS event_count, COUNT(DISTINCT NULLIF(session_key, '')) AS participant_count FROM field_test_events WHERE created_at >= ? GROUP BY event_type ORDER BY event_count DESC", [periodStart]),
      db.query<RowDataPacket[]>("SELECT event_type, created_at FROM field_test_events WHERE created_at >= ? ORDER BY created_at ASC", [periodStart]),
    ]);
    const daily = new Map<string, { guidedStart: number; guidedCompletion: number; guidedDropoff: number }>();
    for (const row of historyRows[0]) {
      const date = new Date(Number(row.created_at)).toISOString().slice(0, 10);
      const current = daily.get(date) || { guidedStart: 0, guidedCompletion: 0, guidedDropoff: 0 };
      if (row.event_type === "guided_start") current.guidedStart += 1;
      if (row.event_type === "guided_completion") current.guidedCompletion += 1;
      if (row.event_type === "guided_dropoff") current.guidedDropoff += 1;
      daily.set(date, current);
    }
    const history: Array<{ date: string; guidedStart: number; guidedCompletion: number; guidedDropoff: number; completionRate: number; dropoffRate: number }> = [];
    const cursor = new Date(periodStart);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(now());
    end.setUTCHours(0, 0, 0, 0);
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      const values = daily.get(date) || { guidedStart: 0, guidedCompletion: 0, guidedDropoff: 0 };
      history.push({ date, ...values, completionRate: values.guidedStart ? Math.round((values.guidedCompletion / values.guidedStart) * 100) : 0, dropoffRate: values.guidedStart ? Math.round((values.guidedDropoff / values.guidedStart) * 100) : 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    res.json({ periodDays, privacy: "Counts only; no IP address, account ID, or free-text identity is stored.", events: rows[0].map((row) => ({ eventType: row.event_type, count: Number(row.event_count), participants: Number(row.participant_count) })), history });
  });

  app.get("/api/staff/reports/zip-demand", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT zip_code, SUM(search_count) AS count FROM zip_search_aggregates WHERE search_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) GROUP BY zip_code ORDER BY count DESC"
    );
    // Counts below three are deliberately suppressed to avoid disclosing small cohorts.
    res.json({
      periodDays: 90,
      minimumCohort: 3,
      demand: rows.map((row) => presentAggregateDemand(row.zip_code, Number(row.count))),
      methodology: "Aggregate covered-ZIP selections only; no IP address, session ID, account ID, or search terms are stored with this metric.",
    });
  });

  app.post("/api/intake", async (req, res) => {
    const { name, phone, situation, needs, consent, providerId, priority, handoff, studyId, protocolVersionId, researchConsentDocumentId } = req.body as Record<string, unknown>;
    if (!name || !consent || !Array.isArray(needs) || needs.length === 0) {
      return res.status(400).json({ error: "Name, requested services, and consent are required." });
    }
    const session = await getSession(req);
    let validatedStudyId: string | null = null;
    let validatedProtocolVersionId: string | null = null;
    if (studyId !== undefined || protocolVersionId !== undefined || researchConsentDocumentId !== undefined) {
      if (typeof studyId !== "string" || typeof protocolVersionId !== "string" || typeof researchConsentDocumentId !== "string" || session?.user.role !== "client") return res.status(400).json({ error: "A signed-in client and active research consent are required to link intake to a study." });
      const [scopeRows] = await db.query<RowDataPacket[]>(`SELECT s.id AS study_id, p.id AS protocol_id, d.id AS document_id
        FROM studies s JOIN study_protocol_versions p ON p.study_id = s.id AND p.id = ? AND p.status = 'active'
        JOIN consent_documents d ON d.study_id = s.id AND d.id = ? AND d.status = 'active' AND d.purpose = 'research_participation'
        WHERE s.id = ? AND s.status = 'active' LIMIT 1`, [protocolVersionId, researchConsentDocumentId, studyId]);
      if (!scopeRows[0]) return res.status(400).json({ error: "The study, protocol, or research consent is not active." });
      const [consentRows] = await db.query<RowDataPacket[]>("SELECT id FROM participant_consents WHERE participant_user_id = ? AND study_id = ? AND consent_document_id = ? AND decision = 'granted' AND withdrawn_at IS NULL ORDER BY decided_at DESC LIMIT 1", [session.user.id, studyId, researchConsentDocumentId]);
      if (!consentRows[0]) return res.status(403).json({ error: "Research participation consent must be granted before linking this intake." });
      validatedStudyId = studyId; validatedProtocolVersionId = protocolVersionId;
    }
    const created = await createCase({
      clientId: session?.user.role === "client" ? session.user.id : null,
      providerId: typeof providerId === "string" ? providerId : null,
      studyId: validatedStudyId,
      protocolVersionId: validatedProtocolVersionId,
      serviceCategory: String(needs[0]),
      priority: CASE_PRIORITIES.includes(priority as CasePriority) ? (priority as CasePriority) : "standard",
      intake: { name, phone: phone || null, situation: situation || null, needs, consent: Boolean(consent), researchConsentDocumentId: researchConsentDocumentId || null, handoff: handoff && typeof handoff === "object" ? handoff : null },
    });
    res.status(201).json({ success: true, referralId: created.caseNumber, caseId: created.id, estimatedFollowUp: "1–2 business days" });
  });

  app.get("/api/cases/mine", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.*, client.display_name AS client_name, client.email AS client_email, assignee.display_name AS assigned_name
       FROM referral_cases c
       LEFT JOIN app_users client ON client.id = c.client_id
       LEFT JOIN app_users assignee ON assignee.id = c.assigned_to
       WHERE c.client_id = ? ORDER BY c.updated_at DESC`,
      [session.user.id]
    );
    res.json({ cases: rows.map(normalizeCase) });
  });

  app.get("/api/notifications", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.id, e.event_type, e.created_at, c.case_number, c.service_category
       FROM case_events e
       JOIN referral_cases c ON c.id = e.case_id
       WHERE c.client_id = ?
       ORDER BY e.created_at DESC LIMIT 50`,
      [session.user.id]
    );
    const eventLabels: Record<string, string> = {
      ACCESS_FEEDBACK_SUBMITTED: "Access feedback recorded",
      CONTACT_WEBFORM_SUBMIT: "Referral request submitted",
      YELLOWBOOK_ENCOUNTER_CREATED: "Your referral received a staff update",
      YELLOWBOOK_ENCOUNTER_SAVED: "Your referral record was updated",
      LONGITUDINAL_MILESTONE_CREATED: "Your care plan received a milestone update",
      LONGITUDINAL_MILESTONE_UPDATED: "Your care plan milestone was updated",
      LONGITUDINAL_MILESTONE_COMPLETED: "Your care plan milestone was completed",
    };
    const notices = session.user.role === "client" ? [
      { id: "privacy-notice-v1", title: "Privacy notice available", message: "Review how ZipShift uses your saved resources, referral history, and accessibility preferences.", createdAt: now() },
      { id: "consent-agreement-v1", title: "Consent agreement review", message: "Your consent choices remain in your control. Open your profile to review or update them.", createdAt: now() - 1000 },
    ] : [];
    let careNotifications: Array<{ id: string; title: string; message: string; createdAt: number }> = [];
    if (session.user.specialistRole) {
      const team = session.user.specialistRole;
      const [handoffRows] = await db.query<RowDataPacket[]>(`SELECT h.id, h.created_at, c.case_number, c.service_category, h.from_team FROM care_team_handoffs h JOIN referral_cases c ON c.id = h.case_id WHERE h.to_team = ? AND h.status = 'pending' AND c.status IN ('new', 'in_progress', 'pending') ORDER BY h.created_at ASC LIMIT 30`, [team]);
      const [documentRows] = await db.query<RowDataPacket[]>(`SELECT d.id, d.updated_at, d.title, c.case_number, c.service_category FROM care_coordination_documents d JOIN referral_cases c ON c.id = d.case_id WHERE d.status IN ('draft', 'ready') AND (d.required_role IS NULL OR d.required_role = ?) AND NOT EXISTS (SELECT 1 FROM care_document_signatures s WHERE s.document_id = d.id) AND c.status IN ('new', 'in_progress', 'pending') ORDER BY d.updated_at ASC LIMIT 30`, [team]);
      const [fileRows] = await db.query<RowDataPacket[]>(`SELECT f.id, f.uploaded_at, f.original_filename, c.case_number, c.service_category FROM case_document_files f JOIN referral_cases c ON c.id = f.case_id LEFT JOIN intake_packet_forms p ON p.id = f.packet_form_id WHERE f.status IN ('uploaded', 'review') AND (p.required_role IS NULL OR p.required_role = ?) AND c.status IN ('new', 'in_progress', 'pending') ORDER BY f.uploaded_at ASC LIMIT 30`, [team]);
      const [signatureRows] = await db.query<RowDataPacket[]>(`SELECT a.id, a.created_at, c.case_number, f.original_filename FROM case_document_audit_events a JOIN case_document_files f ON f.id = a.file_id JOIN referral_cases c ON c.id = a.case_id LEFT JOIN intake_packet_forms p ON p.id = f.packet_form_id WHERE a.action = 'PDF_SIGNED_WITH_CANVAS' AND (p.required_role IS NULL OR p.required_role = ?) ORDER BY a.created_at DESC LIMIT 30`, [team]);
      const [milestoneRows] = await db.query<RowDataPacket[]>(`SELECT m.id, m.updated_at, m.title, m.status, c.case_number, c.service_category FROM case_milestones m JOIN referral_cases c ON c.id = m.case_id WHERE m.assigned_team = ? AND m.status IN ('open', 'in_progress', 'blocked') ORDER BY m.updated_at ASC LIMIT 30`, [team]);
      const [taskRows] = await db.query<RowDataPacket[]>(`SELECT t.id, t.updated_at, t.due_at, t.title, t.status, c.case_number FROM case_tasks t JOIN referral_cases c ON c.id = t.case_id WHERE t.assigned_team = ? AND t.status IN ('open', 'in_progress', 'blocked') AND c.status IN ('new', 'in_progress', 'pending') ORDER BY t.due_at IS NULL, t.due_at, t.updated_at ASC LIMIT 30`, [team]);
      careNotifications = [
        ...handoffRows.map((row) => ({ id: `care-handoff-${row.id}`, title: "Privacy-controlled warm handoff", message: `${row.case_number} · Review minimum-necessary information before accepting · from ${String(row.from_team).replaceAll("_", " ")}`, createdAt: Number(row.created_at) })),
        ...documentRows.map((row) => ({ id: `care-document-${row.id}`, title: "Unsigned care document", message: `${row.case_number} · ${row.title}`, createdAt: Number(row.updated_at) })),
        ...fileRows.map((row) => ({ id: `care-file-${row.id}`, title: "Signature required for case PDF", message: `${row.case_number} · ${row.original_filename} · Review privacy before signing`, createdAt: Number(row.uploaded_at) })),
        ...signatureRows.map((row) => ({ id: `care-signature-${row.id}`, title: "Case PDF signature completed", message: `${row.case_number} · ${row.original_filename} · Signature recorded with audit hash`, createdAt: Number(row.created_at) })),
        ...milestoneRows.map((row) => ({ id: `care-milestone-${row.id}`, title: "Milestone needs team action", message: `${row.case_number} · ${row.title} · ${String(row.status).replaceAll("_", " ")}`, createdAt: Number(row.updated_at) })),
        ...taskRows.map((row) => ({ id: `care-task-${row.id}`, title: "Pending case task", message: `${row.case_number} · ${row.title}${row.due_at ? ` · Due ${new Date(Number(row.due_at)).toLocaleDateString()}` : ""}`, createdAt: Number(row.updated_at) })),
      ];
    }
    let researchNotifications: Array<{ id: string; title: string; message: string; createdAt: number }> = [];
    if (session.user.role === "researcher" || session.user.role === "admin") {
      const membershipClause = session.user.role === "admin" ? "" : "JOIN study_memberships sm ON sm.study_id = p.study_id AND sm.user_id = ? AND sm.is_active = TRUE";
      const membershipParams = session.user.role === "admin" ? [] : [session.user.id];
      const [retentionRows] = await db.query<RowDataPacket[]>(`SELECT p.id, p.pseudonym, p.retention_until FROM research_participant_controls p ${membershipClause} WHERE p.enrollment_status = 'enrolled' AND p.retention_until IS NOT NULL AND p.retention_until <= ? ORDER BY p.retention_until ASC LIMIT 30`, [...membershipParams, now() + 30 * 24 * 60 * 60 * 1000]);
      const [consentRows] = await db.query<RowDataPacket[]>(`SELECT d.id, d.title, d.expires_at FROM consent_documents d ${session.user.role === "admin" ? "" : "JOIN study_memberships sm ON sm.study_id = d.study_id AND sm.user_id = ? AND sm.is_active = TRUE"} WHERE d.status = 'active' AND d.expires_at IS NOT NULL AND d.expires_at <= ? ORDER BY d.expires_at ASC LIMIT 30`, [...membershipParams, now() + 30 * 24 * 60 * 60 * 1000]);
      const [safetyRows] = await db.query<RowDataPacket[]>(`SELECT a.id, a.created_at, p.pseudonym FROM research_assessments a JOIN research_participant_controls p ON p.id = a.participant_control_id ${session.user.role === "admin" ? "" : "JOIN study_memberships sm ON sm.study_id = a.study_id AND sm.user_id = ? AND sm.is_active = TRUE"} WHERE a.instrument_key = 'phq9' AND a.status = 'complete' AND JSON_EXTRACT(a.response_json, '$.q9') IS NULL ORDER BY a.created_at DESC LIMIT 30`, session.user.role === "admin" ? [] : [session.user.id]);
      researchNotifications = [
        ...retentionRows.map((row) => ({ id: `research-retention-${row.id}`, title: "Retention deadline approaching", message: `${row.pseudonym} · review the study retention control by ${new Date(Number(row.retention_until)).toLocaleDateString()}`, createdAt: Number(row.retention_until) })),
        ...consentRows.map((row) => ({ id: `research-consent-expiry-${row.id}`, title: "Consent version nearing expiry", message: `${row.title} · review or supersede before ${new Date(Number(row.expires_at)).toLocaleDateString()}`, createdAt: Number(row.expires_at) })),
        ...safetyRows.map((row) => ({ id: `research-phq9-safety-${row.id}`, title: "PHQ-9 safety item needs review", message: `${row.pseudonym} · complete the safety-item review workflow before using the record`, createdAt: Number(row.created_at) })),
      ];
    }
    res.json({ notifications: [...notices, ...careNotifications, ...researchNotifications, ...rows.map((row) => ({ id: row.id, title: eventLabels[row.event_type] || "Referral update", message: `${row.service_category} · ${row.case_number}`, createdAt: Number(row.created_at) }))] });
  });

  app.get("/api/emergency-resources", (_req, res) => {
    res.json({ emergency: emergencyResources, emergencyInstruction: "For any emergency, immediately call 911." });
  });

  app.get("/api/county-resources", (_req, res) => {
    const lastVerified = "2026-10-16";
    res.json({ resources: stanislausResources.map((resource) => ({ ...resource, lastVerified })), count: stanislausResources.length, source: "Stanislaus County Resource CSV supplied by the user", lastVerified });
  });

  app.post("/api/feedback", async (req, res) => {
    const session = await getSession(req);
    const body = req.body as { caseId?: string; accessRating?: string; barriers?: unknown; narrative?: string };
    const accessRating = body.accessRating === "easy" || body.accessRating === "not_easy" ? body.accessRating : "";
    const barriers = Array.isArray(body.barriers) ? body.barriers.filter((value): value is string => typeof value === "string").slice(0, 12) : [];
    const narrative = typeof body.narrative === "string" ? body.narrative.trim().slice(0, 2000) : "";
    if (!accessRating || (!barriers.length && !narrative)) return res.status(400).json({ error: "Choose an access outcome and provide at least one barrier or note." });
    if (body.caseId && !session) return res.status(401).json({ error: "Sign in is required to attach feedback to a referral." });
    const caseId = body.caseId || null;
    if (caseId && session?.user.role === "client") {
      const [caseRows] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? AND client_id = ? LIMIT 1", [caseId, session.user.id]);
      if (!caseRows[0]) return res.status(404).json({ error: "Referral not found." });
    }
    const createdAt = now();
    await db.execute("INSERT INTO access_feedback (id, client_id, case_id, access_rating, barriers_json, narrative, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), session?.user.id || null, caseId, accessRating, JSON.stringify(barriers), narrative || null, createdAt]);
    if (session?.user.id && caseId) {
      await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), caseId, session.user.id, "ACCESS_FEEDBACK_SUBMITTED", JSON.stringify({ accessRating, barriers }), "Client access feedback submitted.", createdAt]);
    }
    res.status(201).json({ ok: true, createdAt });
  });

  app.get("/api/cases/:caseId/events", async (req, res) => {
    const session = await requireSession(req, res);
    if (!session) return;
    const clientOnly = session.user.role === "client";
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.event_type, e.note, e.created_at
       FROM case_events e
       JOIN referral_cases c ON c.id = e.case_id
       WHERE e.case_id = ? ${clientOnly ? "AND c.client_id = ?" : ""}
       ORDER BY e.created_at ASC`,
      clientOnly ? [req.params.caseId, session.user.id] : [req.params.caseId]
    );
    if (clientOnly && !rows.length) {
      const [caseRows] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? AND client_id = ? LIMIT 1", [req.params.caseId, session.user.id]);
      if (!caseRows[0]) return res.status(404).json({ error: "Referral not found." });
    }
    res.json({ events: rows.map((row) => ({ eventType: row.event_type, note: row.note || null, createdAt: Number(row.created_at) })) });
  });

  app.get("/api/staff/cases", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const status = String(req.query.status || "");
    const clauses = ["1 = 1"];
    const params: unknown[] = [];
    if (CASE_STATUSES.includes(status as CaseStatus)) {
      clauses.push("c.status = ?");
      params.push(status);
    }
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.*, client.display_name AS client_name, client.email AS client_email, assignee.display_name AS assigned_name
       FROM referral_cases c
       LEFT JOIN app_users client ON client.id = c.client_id
       LEFT JOIN app_users assignee ON assignee.id = c.assigned_to
       WHERE ${clauses.join(" AND ")} ORDER BY FIELD(c.priority, 'urgent', 'high', 'standard', 'low'), c.updated_at DESC`,
      params
    );
    res.json({ cases: rows.map(normalizeCase) });
  });

  app.patch("/api/staff/cases/:caseId", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const { status, priority, resolutionNotes } = req.body as { status?: CaseStatus; priority?: CasePriority; resolutionNotes?: string };
    const updates: string[] = ["updated_at = ?"];
    const params: Array<string | number | null> = [now()];
    if (status && !isCaseStatus(status)) return res.status(400).json({ error: "Use a valid case status." });
    if (priority && !isCasePriority(priority)) return res.status(400).json({ error: "Use a valid case priority." });
    if (status) { updates.push("status = ?"); params.push(status); }
    if (priority) { updates.push("priority = ?"); params.push(priority); }
    if (typeof resolutionNotes === "string") { updates.push("resolution_notes = ?"); params.push(resolutionNotes); }
    if (status === "completed" || status === "denied" || status === "closed") { updates.push("closed_at = ?"); params.push(now()); }
    params.push(req.params.caseId);
    await db.execute(`UPDATE referral_cases SET ${updates.join(", ")} WHERE id = ?`, params);
    await db.execute(
      "INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), req.params.caseId, session.user.id, "CASE_STATUS_UPDATED", JSON.stringify({ status, priority }), resolutionNotes || "Case updated by staff.", now()]
    );
    if (status) {
      const terminal = status === "completed" || status === "denied" || status === "closed";
      await syncCaseMilestone({ caseId: req.params.caseId, actorUserId: session.user.id, actorRole: session.user.role, milestoneType: terminal ? "outcome" : "intake", assignedTeam: "intake_specialist", title: terminal ? `Referral ${status}` : `Referral ${status.replaceAll("_", " ")}`, summary: resolutionNotes || "Progress synchronized from the referral status.", status: status === "completed" ? "completed" : terminal ? "cancelled" : status === "pending" ? "blocked" : status === "in_progress" ? "in_progress" : "open", source: { source: "referral_case", caseStatus: status } });
    }
    res.json({ success: true });
  });

  app.post("/api/staff/navigator-events", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const body = req.body as { caseId?: unknown; eventType?: unknown; details?: unknown; note?: unknown };
    const allowed = ["NAVIGATOR_MESSAGE_SENT", "NAVIGATOR_QUIET_HOURS_UPDATED", "NAVIGATOR_FHIR_PREVIEWED"];
    if (typeof body.caseId !== "string" || !allowed.includes(String(body.eventType))) return res.status(400).json({ error: "Provide a case and supported Navigator event." });
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? LIMIT 1", [body.caseId]);
    if (!caseRows[0]) return res.status(404).json({ error: "Case not found." });
    const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), body.caseId, session.user.id, String(body.eventType), JSON.stringify(details), typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null, now()]);
    res.status(201).json({ success: true });
  });

  app.get("/api/staff/yellowbook/cases/:caseId", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT y.*, c.case_number
       FROM yellowbook_encounters y
       LEFT JOIN referral_cases c ON c.id = y.case_id
       WHERE y.case_id = ? ORDER BY y.updated_at DESC LIMIT 1`,
      [req.params.caseId]
    );
    res.json({ encounter: rows[0] ? normalizeYellowBook(rows[0]) : null });
  });

  app.post("/api/staff/yellowbook", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const body = req.body as Record<string, any>;
    if (!body.caseId || !body.patientName) return res.status(400).json({ error: "A case and patient name are required." });
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT id, case_number FROM referral_cases WHERE id = ? LIMIT 1", [body.caseId]);
    if (!caseRows[0]) return res.status(404).json({ error: "The linked case could not be found." });
    const id = randomUUID();
    const timestamp = now();
    await db.execute(
      `INSERT INTO yellowbook_encounters
       (id, case_id, patient_name, chief_complaint, narrative, encounter_status, privacy_mode, adaptive_branch, hsai_score, hsai_domains_json, encounter_json, plan_json, pause_report_json, created_by, updated_by_role, created_at, updated_at, paused_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.caseId, String(body.patientName), String(body.chiefComplaint || ""), String(body.narrative || ""), body.encounterStatus || "active", Boolean(body.privacyMode), body.adaptiveBranch || "general-navigation", body.hsaiScore ?? null, JSON.stringify(body.hsaiDomains || { housing: 0, health: 0, safety: 0, access: 0 }), JSON.stringify(body.encounter || {}), JSON.stringify(body.plan || {}), null, session.user.id, session.user.role, timestamp, timestamp, null]
    );
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), body.caseId, session.user.id, "YELLOWBOOK_ENCOUNTER_CREATED", JSON.stringify({ encounterId: id }), "YellowBook encounter opened.", timestamp]);
    const [rows] = await db.query<RowDataPacket[]>("SELECT y.*, c.case_number FROM yellowbook_encounters y LEFT JOIN referral_cases c ON c.id = y.case_id WHERE y.id = ?", [id]);
    res.status(201).json({ encounter: normalizeYellowBook(rows[0]) });
  });

  app.get("/api/staff/yellowbook/:encounterId/events", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [encounterRows] = await db.query<RowDataPacket[]>("SELECT case_id, privacy_mode FROM yellowbook_encounters WHERE id = ? LIMIT 1", [req.params.encounterId]);
    if (!encounterRows[0]) return res.status(404).json({ error: "The YellowBook encounter could not be found." });
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT e.event_type, e.note, e.created_at, actor.role AS actor_role
       FROM case_events e
       LEFT JOIN app_users actor ON actor.id = e.actor_user_id
       WHERE e.case_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(e.event_data_json, '$.encounterId')) = ?
       ORDER BY e.created_at DESC LIMIT 8`,
      [encounterRows[0].case_id, req.params.encounterId]
    );
    const privacyMode = Boolean(encounterRows[0].privacy_mode);
    res.json({ events: rows.map((row) => ({ eventType: row.event_type, note: privacyMode ? null : row.note || null, createdAt: Number(row.created_at), actorRole: privacyMode ? null : row.actor_role || null })) });
  });
  app.get("/api/staff/yellowbook/:encounterId/export.pdf", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT y.*, c.case_number FROM yellowbook_encounters y LEFT JOIN referral_cases c ON c.id = y.case_id WHERE y.id = ? LIMIT 1", [req.params.encounterId]);
    if (!rows[0]) return res.status(404).json({ error: "The YellowBook encounter could not be found." });
    const encounter = normalizeYellowBook(rows[0]);
    const pdf = buildYellowBookPdf({
      caseNumber: encounter.caseNumber,
      patientName: encounter.patientName,
      privacyMode: encounter.privacyMode,
      encounterStatus: encounter.encounterStatus,
      updatedAt: encounter.updatedAt,
      chiefComplaint: encounter.chiefComplaint,
      narrative: encounter.narrative,
      hsaiScore: encounter.hsaiScore,
      hsaiDomains: encounter.hsaiDomains,
      encounterResponse: encounter.encounter.response,
      plan: { immediate: encounter.plan.immediate || "", followUp: encounter.plan.followUp || "", referral: encounter.plan.referral || "" },
    });
    const bytes = pdf.output("arraybuffer");
    res.status(200).set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="zipshift-yellowbook-${encounter.caseNumber}.pdf"` }).send(Buffer.from(bytes));
  });

  app.patch("/api/staff/yellowbook/:encounterId", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const body = req.body as Record<string, any>;
    const statuses = ["active", "paused", "discontinued", "completed"];
    if (body.encounterStatus && !statuses.includes(body.encounterStatus)) return res.status(400).json({ error: "Use a valid encounter status." });
    const timestamp = now();
    const nextStatus = body.encounterStatus || "active";
    const updates = ["patient_name = ?", "chief_complaint = ?", "narrative = ?", "encounter_status = ?", "privacy_mode = ?", "adaptive_branch = ?", "hsai_score = ?", "hsai_domains_json = ?", "encounter_json = ?", "plan_json = ?", "pause_report_json = ?", "updated_by_role = ?", "updated_at = ?", "paused_at = ?"];
    const values: Array<string | number | boolean | null> = [String(body.patientName || "Client record"), String(body.chiefComplaint || ""), String(body.narrative || ""), nextStatus, Boolean(body.privacyMode), String(body.adaptiveBranch || "general-navigation"), body.hsaiScore === null || body.hsaiScore === undefined ? null : Number(body.hsaiScore), JSON.stringify(body.hsaiDomains || {}), JSON.stringify(body.encounter || {}), JSON.stringify(body.plan || {}), nextStatus === "paused" ? JSON.stringify({ savedAt: timestamp, narrative: body.narrative || "", plan: body.plan || {} }) : null, session.user.role, timestamp, nextStatus === "paused" ? timestamp : null, req.params.encounterId];
    const [result] = await db.execute(`UPDATE yellowbook_encounters SET ${updates.join(", ")} WHERE id = ?`, values);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "The YellowBook encounter could not be found." });
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) SELECT ?, case_id, ?, ?, ?, ?, ? FROM yellowbook_encounters WHERE id = ?", [randomUUID(), session.user.id, "YELLOWBOOK_ENCOUNTER_SAVED", JSON.stringify({ encounterId: req.params.encounterId, status: nextStatus }), nextStatus === "paused" ? "YellowBook encounter paused with a safe-to-resume report." : "YellowBook encounter saved.", timestamp, req.params.encounterId]);
    const [rows] = await db.query<RowDataPacket[]>("SELECT y.*, c.case_number FROM yellowbook_encounters y LEFT JOIN referral_cases c ON c.id = y.case_id WHERE y.id = ?", [req.params.encounterId]);
    res.json({ encounter: normalizeYellowBook(rows[0]) });
  });

  app.get("/api/staff/reports/summary", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT status, COUNT(*) AS count FROM referral_cases GROUP BY status");
    const [directoryRows] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS total, SUM(verified = TRUE) AS verified, AVG(hsai_score) AS average_hsai FROM directory_resources");
    const [eventRows] = await db.query<RowDataPacket[]>("SELECT event_type, COUNT(*) AS count FROM case_events GROUP BY event_type ORDER BY count DESC LIMIT 8");
    const byStatus: Record<string, number> = Object.fromEntries(caseRows.map((row) => [row.status, Number(row.count)]));
    const total = Object.values(byStatus).reduce<number>((sum, value) => sum + value, 0);
    const completed = Number(byStatus.completed || 0);
    res.json({
      summary: {
        totalCases: total,
        openCases: Number(byStatus.new || 0) + Number(byStatus.in_progress || 0) + Number(byStatus.pending || 0),
        completedCases: completed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
        totalDirectoryResources: Number(directoryRows[0]?.total || 0),
        verifiedDirectoryResources: Number(directoryRows[0]?.verified || 0),
        averageHsai: Number(directoryRows[0]?.average_hsai || 0),
      },
      byStatus,
      events: eventRows.map((row) => ({ eventType: row.event_type, count: Number(row.count) })),
    });
  });

  app.get("/api/staff/reports/export", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT c.case_number, c.service_category, c.status, c.priority, c.created_at, c.updated_at,
              client.display_name AS client_name, assignee.display_name AS assigned_name
       FROM referral_cases c
       LEFT JOIN app_users client ON client.id = c.client_id
       LEFT JOIN app_users assignee ON assignee.id = c.assigned_to
       ORDER BY c.created_at DESC`
    );
    const csv = createCaseCsv(rows.map((row) => ({ caseNumber: row.case_number, clientName: row.client_name, serviceCategory: row.service_category, status: row.status, priority: row.priority, assignedName: row.assigned_name, createdAt: new Date(Number(row.created_at)).toISOString(), updatedAt: new Date(Number(row.updated_at)).toISOString() })));
    await db.execute("INSERT INTO generated_reports (id, requested_by, report_type, filters_json, created_at) VALUES (?, ?, ?, ?, ?)", [randomUUID(), session.user.id, "case-export", JSON.stringify({}), now()]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=zipshift-case-report.csv");
    res.send(csv);
  });
  app.get("/api/intake-library", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM intake_packet_forms WHERE active = TRUE ORDER BY category, title");
    res.json({ forms: rows.map((row) => ({ id: row.id, slug: row.slug, title: row.title, category: row.category, description: row.description, requiredRole: row.required_role, sourceFileName: row.source_file_name, storageUrl: row.storage_url, pageCount: Number(row.page_count), officialNotice: row.official_notice })) });
  });
  app.post("/api/intake-library/assemble", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { caseId?: unknown; title?: unknown; formIds?: unknown };
    if (typeof body.caseId !== "string" || typeof body.title !== "string" || body.title.trim().length < 3 || !Array.isArray(body.formIds) || body.formIds.length < 1 || body.formIds.length > 20 || body.formIds.some((id) => typeof id !== "string")) return res.status(400).json({ error: "Choose a case, packet title, and one to twenty intake forms." });
    const [cases] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? AND status IN ('new', 'in_progress', 'pending') LIMIT 1", [body.caseId]);
    if (!cases[0]) return res.status(404).json({ error: "Active client case not found." });
    const formIds = body.formIds as string[]; const [forms] = await db.query<RowDataPacket[]>(`SELECT id FROM intake_packet_forms WHERE active = TRUE AND id IN (${formIds.map(() => "?").join(",")})`, formIds);
    if (forms.length !== formIds.length) return res.status(400).json({ error: "One or more selected forms are unavailable." });
    const packetId = randomUUID(); const timestamp = now(); await db.execute("INSERT INTO intake_packets (id, case_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, 'assembled', ?, ?, ?)", [packetId, body.caseId, body.title.trim(), session.user.id, timestamp, timestamp]);
    for (let index = 0; index < formIds.length; index += 1) await db.execute("INSERT INTO intake_packet_items (id, packet_id, packet_form_id, sort_order) VALUES (?, ?, ?, ?)", [randomUUID(), packetId, formIds[index], index]);
    await db.execute("INSERT INTO case_document_audit_events (id, case_id, packet_id, actor_user_id, action, details_json, created_at) VALUES (?, ?, ?, ?, 'PACKET_ASSEMBLED', ?, ?)", [randomUUID(), body.caseId, packetId, session.user.id, JSON.stringify({ title: body.title.trim(), formIds }), timestamp]); res.status(201).json({ packetId });
  });
  app.get("/api/care-portal/cases/:caseId/documents", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const [files] = await db.query<RowDataPacket[]>(`SELECT f.*, p.title AS packet_form_title, (SELECT s.signed_at FROM case_document_file_signatures s WHERE s.file_id = f.id ORDER BY s.signed_at DESC LIMIT 1) AS signed_at FROM case_document_files f LEFT JOIN intake_packet_forms p ON p.id = f.packet_form_id WHERE f.case_id = ? ORDER BY f.uploaded_at DESC`, [req.params.caseId]);
    const [audit] = await db.query<RowDataPacket[]>(`SELECT a.*, u.display_name AS actor_name FROM case_document_audit_events a JOIN app_users u ON u.id = a.actor_user_id WHERE a.case_id = ? ORDER BY a.created_at DESC LIMIT 100`, [req.params.caseId]);
    res.json({ files: files.map((row) => ({ id: row.id, originalFilename: row.original_filename, packetFormTitle: row.packet_form_title || null, mimeType: row.mime_type, byteSize: Number(row.byte_size), sha256: row.sha256, status: row.status, signedAt: row.signed_at ? Number(row.signed_at) : null, uploadedAt: Number(row.uploaded_at) })), audit: audit.map((row) => ({ id: row.id, fileId: row.file_id || null, packetId: row.packet_id || null, action: row.action, details: parseJson(row.details_json, {}), actorName: row.actor_name, createdAt: Number(row.created_at) })) });
  });
  app.post("/api/care-portal/cases/:caseId/files", express.raw({ type: ["application/pdf", "application/octet-stream"], limit: "20mb" }), async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0); const name = typeof req.headers["x-file-name"] === "string" ? req.headers["x-file-name"].slice(0, 255) : "uploaded-intake.pdf"; const packetFormId = typeof req.headers["x-packet-form-id"] === "string" ? req.headers["x-packet-form-id"] : null;
    if (buffer.length < 5 || buffer.subarray(0, 4).toString() !== "%PDF") return res.status(400).json({ error: "Only valid PDF files can be uploaded." });
    const [cases] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? AND status IN ('new', 'in_progress', 'pending') LIMIT 1", [req.params.caseId]); if (!cases[0]) return res.status(404).json({ error: "Active client case not found." });
    if (packetFormId) { const [forms] = await db.query<RowDataPacket[]>("SELECT id FROM intake_packet_forms WHERE id = ? AND active = TRUE LIMIT 1", [packetFormId]); if (!forms[0]) return res.status(400).json({ error: "Selected packet form is unavailable." }); }
    const sha256 = createHash("sha256").update(buffer).digest("hex"); const stored = await storagePut(`case-documents/${req.params.caseId}/${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`, buffer, "application/pdf"); const fileId = randomUUID(); const timestamp = now();
    await db.execute("INSERT INTO case_document_files (id, case_id, packet_form_id, original_filename, storage_key, storage_url, mime_type, byte_size, sha256, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?)", [fileId, req.params.caseId, packetFormId, name, stored.key, stored.url, buffer.length, sha256, session.user.id, timestamp]); await db.execute("INSERT INTO case_document_audit_events (id, case_id, file_id, actor_user_id, action, details_json, created_at) VALUES (?, ?, ?, ?, 'PDF_UPLOADED', ?, ?)", [randomUUID(), req.params.caseId, fileId, session.user.id, JSON.stringify({ originalFilename: name, byteSize: buffer.length, sha256, packetFormId }), timestamp]); res.status(201).json({ id: fileId, sha256 });
  });
  app.get("/api/care-portal/files/:fileId/download", async (req, res) => { const session = await requireCareTeam(req, res); if (!session) return; const [rows] = await db.query<RowDataPacket[]>("SELECT storage_key FROM case_document_files WHERE id = ? LIMIT 1", [req.params.fileId]); if (!rows[0]) return res.status(404).json({ error: "Document not found." }); res.redirect(await storageGetSignedUrl(rows[0].storage_key)); });
  app.patch("/api/care-portal/files/:fileId/status", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const nextStatus = req.body?.status;
    if (!['review', 'void'].includes(nextStatus)) return res.status(400).json({ error: "Choose review or void." });
    const [rows] = await db.query<RowDataPacket[]>("SELECT f.case_id, f.status, p.required_role FROM case_document_files f LEFT JOIN intake_packet_forms p ON p.id = f.packet_form_id WHERE f.id = ? LIMIT 1", [req.params.fileId]);
    if (!rows[0]) return res.status(404).json({ error: "Document not found." });
    if (rows[0].required_role && session?.user.role !== 'admin' && session?.user.specialistRole !== rows[0].required_role) return res.status(403).json({ error: "This document is restricted to its assigned specialist role." });
    if (rows[0].status === 'signed' || rows[0].status === 'void') return res.status(409).json({ error: "Signed or void documents cannot change status." });
    if (nextStatus === 'review' && rows[0].status !== 'uploaded') return res.status(409).json({ error: "Only uploaded documents can enter privacy review." });
    const timestamp = now(); await db.execute("UPDATE case_document_files SET status = ? WHERE id = ?", [nextStatus, req.params.fileId]); await db.execute("INSERT INTO case_document_audit_events (id, case_id, file_id, actor_user_id, action, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), rows[0].case_id, req.params.fileId, session.user.id, nextStatus === 'review' ? 'PDF_PRIVACY_REVIEW_STARTED' : 'PDF_VOIDED', JSON.stringify({ previousStatus: rows[0].status, nextStatus }), timestamp]); res.json({ success: true, status: nextStatus });
  });
  app.post("/api/care-portal/files/:fileId/signatures", async (req, res) => {
    const session = await requireCareTeam(req, res);
    if (!session) return;
    const body = req.body as { signerName?: unknown; signerRole?: unknown; acknowledgement?: unknown; signatureDataUrl?: unknown };
    if (typeof body.signerName !== "string" || body.signerName.trim().length < 2 || typeof body.signerRole !== "string" || body.signerRole.trim().length < 2 || typeof body.acknowledgement !== "string" || body.acknowledgement.trim().length < 20 || typeof body.signatureDataUrl !== "string") return res.status(400).json({ error: "Enter signer name, role, acknowledgement, and draw a signature." });
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.signatureDataUrl);
    if (!match || body.signatureDataUrl.length > 2_000_000) return res.status(400).json({ error: "The signature drawing must be a valid PNG under 1.5 MB." });
    const signatureBuffer = Buffer.from(match[1], "base64");
    if (signatureBuffer.length < 100 || signatureBuffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return res.status(400).json({ error: "The signature drawing is invalid." });
    const [files] = await db.query<RowDataPacket[]>("SELECT f.case_id, f.status, p.required_role FROM case_document_files f LEFT JOIN intake_packet_forms p ON p.id = f.packet_form_id WHERE f.id = ? LIMIT 1", [req.params.fileId]);
    if (!files[0]) return res.status(404).json({ error: "Document not found." });
    if (files[0].required_role && session.user.role !== 'admin' && session.user.specialistRole !== files[0].required_role) return res.status(403).json({ error: "This document is restricted to its assigned specialist role." });
    if (files[0].status === "signed") return res.status(409).json({ error: "This PDF already has a signature record." });
    if (files[0].status !== "review") return res.status(409).json({ error: "Complete privacy review before signing this PDF." });
    const signatureSha256 = createHash("sha256").update(signatureBuffer).digest("hex");
    const storedSignature = await storagePut(`case-signatures/${req.params.fileId}/signature.png`, signatureBuffer, "image/png");
    const timestamp = now();
    await db.execute("INSERT INTO case_document_file_signatures (id, file_id, signer_user_id, signer_name, signer_role, acknowledgement, signature_method, signature_storage_key, signature_storage_url, signature_sha256, signed_at) VALUES (?, ?, ?, ?, ?, ?, 'canvas_and_typed_acknowledgement', ?, ?, ?, ?)", [randomUUID(), req.params.fileId, session.user.id, body.signerName.trim(), body.signerRole.trim().slice(0, 60), body.acknowledgement.trim().slice(0, 4000), storedSignature.key, storedSignature.url, signatureSha256, timestamp]);
    await db.execute("UPDATE case_document_files SET status = 'signed' WHERE id = ?", [req.params.fileId]);
    await db.execute("INSERT INTO case_document_audit_events (id, case_id, file_id, actor_user_id, action, details_json, created_at) VALUES (?, ?, ?, ?, 'PDF_SIGNED_WITH_CANVAS', ?, ?)", [randomUUID(), files[0].case_id, req.params.fileId, session.user.id, JSON.stringify({ signerName: body.signerName.trim(), signerRole: body.signerRole.trim(), signatureSha256, signatureMethod: "canvas_and_typed_acknowledgement" }), timestamp]);
    res.status(201).json({ success: true, signatureSha256 });
  });
  app.get("/api/care-portal/milestones", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const team = resolveCareTeam(session, req.query.team);
    const caseId = typeof req.query.caseId === "string" ? req.query.caseId : null;
    const [rows] = await db.query<RowDataPacket[]>(`SELECT m.*, c.case_number, c.service_category, creator.display_name AS created_by_name, updater.display_name AS updated_by_name
      FROM case_milestones m JOIN referral_cases c ON c.id = m.case_id LEFT JOIN app_users creator ON creator.id = m.created_by LEFT JOIN app_users updater ON updater.id = m.updated_by
      WHERE (? = 'care_coordinator' OR m.assigned_team = ?) AND (? IS NULL OR m.case_id = ?) ORDER BY m.updated_at DESC LIMIT 300`, [team, team, caseId, caseId]);
    res.json({ team, milestones: rows.map((row) => ({ id: row.id, caseId: row.case_id, caseNumber: row.case_number, serviceCategory: row.service_category, milestoneType: row.milestone_type, status: row.status, assignedTeam: row.assigned_team, title: row.title, summary: row.summary || "", metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}), createdBy: row.created_by, createdByName: row.created_by_name || null, updatedBy: row.updated_by, updatedByName: row.updated_by_name || null, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), completedBy: row.completed_by || null, completedAt: row.completed_at ? Number(row.completed_at) : null })) });
  });
  app.post("/api/care-portal/cases/:caseId/milestones", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { milestoneType?: unknown; assignedTeam?: unknown; title?: unknown; summary?: unknown; metadata?: unknown };
    if (!isSpecialistRole(body.assignedTeam) || !LONGITUDINAL_MILESTONE_TYPES.includes(body.milestoneType as LongitudinalMilestoneType) || typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180 || (body.summary !== undefined && typeof body.summary !== "string") || (body.metadata !== undefined && (typeof body.metadata !== "object" || body.metadata === null || Array.isArray(body.metadata)))) return res.status(400).json({ error: "Provide a valid milestone type, assigned team, title, summary, and metadata." });
    const assignedTeam = body.assignedTeam as SpecialistRole;
    if (!hasMilestonePermission(session, assignedTeam, "write")) return res.status(403).json({ error: "You may only create milestones for your assigned care team." });
    const [cases] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? LIMIT 1", [req.params.caseId]); if (!cases[0]) return res.status(404).json({ error: "Care coordination case not found." });
    const id = randomUUID(); const timestamp = now(); const milestoneType = body.milestoneType as LongitudinalMilestoneType; const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 4000) : null; const metadata = JSON.stringify(body.metadata || {});
    await db.execute("INSERT INTO case_milestones (id, case_id, milestone_type, status, assigned_team, title, summary, metadata_json, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.caseId, milestoneType, assignedTeam, body.title.trim(), summary, metadata, session.user.id, timestamp, session.user.id, timestamp]);
    const details = { milestoneId: id, milestoneType, assignedTeam, title: body.title.trim() };
    await db.execute("INSERT INTO case_milestone_audit_events (id, milestone_id, case_id, actor_user_id, actor_role, action, previous_status, next_status, details_json, created_at) VALUES (?, ?, ?, ?, ?, 'MILESTONE_CREATED', NULL, 'open', ?, ?)", [randomUUID(), id, req.params.caseId, session.user.id, session.user.specialistRole || session.user.role, JSON.stringify(details), timestamp]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'LONGITUDINAL_MILESTONE_CREATED', ?, ?, ?)", [randomUUID(), req.params.caseId, session.user.id, JSON.stringify(details), `Milestone created for ${assignedTeam}.`, timestamp]);
    await db.execute("UPDATE referral_cases SET updated_at = ? WHERE id = ?", [timestamp, req.params.caseId]); res.status(201).json({ id, status: "open" });
  });
  app.patch("/api/care-portal/milestones/:milestoneId", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { status?: unknown; title?: unknown; summary?: unknown; metadata?: unknown };
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, case_id, assigned_team, status, title, summary, metadata_json FROM case_milestones WHERE id = ? LIMIT 1", [req.params.milestoneId]); if (!rows[0]) return res.status(404).json({ error: "Milestone not found." });
    const assignedTeam = rows[0].assigned_team as SpecialistRole; const nextStatus = body.status === undefined ? String(rows[0].status) : String(body.status);
    if (!MILESTONE_STATUSES.includes(nextStatus as MilestoneStatus)) return res.status(400).json({ error: "Unsupported milestone status." });
    const action = nextStatus === "completed" ? "complete" : nextStatus === "cancelled" ? "cancel" : "write";
    if (!hasMilestonePermission(session, assignedTeam, action)) return res.status(403).json({ error: "You do not have permission to update this team milestone." });
    if (["completed", "cancelled"].includes(String(rows[0].status))) return res.status(409).json({ error: "Completed or cancelled milestones are immutable." });
    if (body.title !== undefined && (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180)) return res.status(400).json({ error: "Milestone title must be between 3 and 180 characters." });
    if (body.summary !== undefined && typeof body.summary !== "string") return res.status(400).json({ error: "Milestone summary must be text." });
    if (body.metadata !== undefined && (typeof body.metadata !== "object" || body.metadata === null || Array.isArray(body.metadata))) return res.status(400).json({ error: "Milestone metadata must be an object." });
    const timestamp = now(); const completed = nextStatus === "completed"; const title = typeof body.title === "string" ? body.title.trim() : rows[0].title; const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 4000) : rows[0].summary || null; const metadata = body.metadata === undefined ? rows[0].metadata_json || "{}" : JSON.stringify(body.metadata);
    await db.execute("UPDATE case_milestones SET status = ?, title = ?, summary = ?, metadata_json = ?, updated_by = ?, updated_at = ?, completed_by = ?, completed_at = ? WHERE id = ?", [nextStatus, title, summary, metadata, session.user.id, timestamp, completed ? session.user.id : null, completed ? timestamp : null, req.params.milestoneId]);
    const details = { milestoneId: req.params.milestoneId, title, assignedTeam, metadataChanged: body.metadata !== undefined };
    await db.execute("INSERT INTO case_milestone_audit_events (id, milestone_id, case_id, actor_user_id, actor_role, action, previous_status, next_status, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [randomUUID(), req.params.milestoneId, rows[0].case_id, session.user.id, session.user.specialistRole || session.user.role, completed ? "MILESTONE_COMPLETED" : nextStatus === "cancelled" ? "MILESTONE_CANCELLED" : "MILESTONE_UPDATED", rows[0].status, nextStatus, JSON.stringify(details), timestamp]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), rows[0].case_id, session.user.id, completed ? "LONGITUDINAL_MILESTONE_COMPLETED" : "LONGITUDINAL_MILESTONE_UPDATED", JSON.stringify(details), `Milestone ${nextStatus} by ${session.user.displayName}.`, timestamp]);
    await db.execute("UPDATE referral_cases SET updated_at = ? WHERE id = ?", [timestamp, rows[0].case_id]); res.json({ success: true, status: nextStatus });
  });
  app.get("/api/care-portal/milestones/:milestoneId/audit", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT a.*, m.assigned_team, u.display_name AS actor_name FROM case_milestone_audit_events a JOIN case_milestones m ON m.id = a.milestone_id LEFT JOIN app_users u ON u.id = a.actor_user_id WHERE a.milestone_id = ? ORDER BY a.created_at DESC LIMIT 100", [req.params.milestoneId]);
    if (!rows[0]) return res.status(404).json({ error: "Milestone audit history not found." });
    if (!hasMilestonePermission(session, rows[0].assigned_team as SpecialistRole, "read")) return res.status(403).json({ error: "You do not have permission to view this milestone audit history." });
    res.json({ audit: rows.map((row) => ({ id: row.id, milestoneId: row.milestone_id, caseId: row.case_id, actorName: row.actor_name || "Deactivated user", actorRole: row.actor_role, action: row.action, previousStatus: row.previous_status || null, nextStatus: row.next_status || null, details: parseJson<Record<string, unknown>>(row.details_json, {}), createdAt: Number(row.created_at) })) });
  });
  app.get("/api/care-portal/tasks", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const team = resolveCareTeam(session, req.query.team); const caseId = typeof req.query.caseId === "string" ? req.query.caseId : null;
    const [rows] = await db.query<RowDataPacket[]>("SELECT t.*, c.case_number, m.title AS milestone_title FROM case_tasks t JOIN referral_cases c ON c.id = t.case_id LEFT JOIN case_milestones m ON m.id = t.milestone_id WHERE t.assigned_team = ? AND (? IS NULL OR t.case_id = ?) ORDER BY FIELD(t.status, 'open', 'in_progress', 'blocked', 'completed', 'cancelled'), t.due_at IS NULL, t.due_at, t.updated_at DESC LIMIT 300", [team, caseId, caseId]);
    res.json({ team, tasks: rows.map((row) => ({ id: row.id, caseId: row.case_id, caseNumber: row.case_number, milestoneId: row.milestone_id || null, milestoneTitle: row.milestone_title || null, assignedTeam: row.assigned_team, title: row.title, description: row.description || "", status: row.status, dueAt: row.due_at ? Number(row.due_at) : null, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at), completedAt: row.completed_at ? Number(row.completed_at) : null })) });
  });
  app.post("/api/care-portal/cases/:caseId/tasks", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { assignedTeam?: unknown; title?: unknown; description?: unknown; dueAt?: unknown; milestoneId?: unknown };
    if (!isSpecialistRole(body.assignedTeam) || typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180 || (body.description !== undefined && typeof body.description !== "string") || (body.dueAt !== undefined && body.dueAt !== null && (!Number.isFinite(Number(body.dueAt)) || Number(body.dueAt) < 0))) return res.status(400).json({ error: "Provide a valid assigned team, task title, description, and due date." });
    const assignedTeam = body.assignedTeam as SpecialistRole; if (!hasMilestonePermission(session, assignedTeam, "write")) return res.status(403).json({ error: "You may only create tasks for your assigned care team." });
    const [cases] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? LIMIT 1", [req.params.caseId]); if (!cases[0]) return res.status(404).json({ error: "Care coordination case not found." });
    if (body.milestoneId) { const [milestones] = await db.query<RowDataPacket[]>("SELECT id FROM case_milestones WHERE id = ? AND case_id = ? LIMIT 1", [body.milestoneId, req.params.caseId]); if (!milestones[0]) return res.status(400).json({ error: "Linked milestone was not found for this case." }); }
    const id = randomUUID(); const timestamp = now(); await db.execute("INSERT INTO case_tasks (id, case_id, milestone_id, assigned_team, title, description, status, due_at, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)", [id, req.params.caseId, typeof body.milestoneId === "string" ? body.milestoneId : null, assignedTeam, body.title.trim(), typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null, body.dueAt ? Number(body.dueAt) : null, session.user.id, timestamp, session.user.id, timestamp]);
    await syncCaseMilestone({ caseId: req.params.caseId, actorUserId: session.user.id, actorRole: session.user.specialistRole || session.user.role, milestoneType: "task", assignedTeam, title: body.title.trim(), summary: typeof body.description === "string" ? body.description.trim() : "Task created from the care coordination workspace.", status: "open", source: { taskId: id, milestoneId: body.milestoneId || null } });
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CASE_TASK_CREATED', ?, ?, ?)", [randomUUID(), req.params.caseId, session.user.id, JSON.stringify({ taskId: id, assignedTeam, milestoneId: body.milestoneId || null }), `Task created for ${assignedTeam}.`, timestamp]); res.status(201).json({ id });
  });
  app.patch("/api/care-portal/tasks/:taskId", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return; const status = req.body?.status; if (!MILESTONE_STATUSES.includes(status as MilestoneStatus)) return res.status(400).json({ error: "Unsupported task status." });
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, case_id, assigned_team, title, status FROM case_tasks WHERE id = ? LIMIT 1", [req.params.taskId]); if (!rows[0]) return res.status(404).json({ error: "Task not found." }); const assignedTeam = rows[0].assigned_team as SpecialistRole; const action = status === "completed" ? "complete" : status === "cancelled" ? "cancel" : "write"; if (!hasMilestonePermission(session, assignedTeam, action)) return res.status(403).json({ error: "You do not have permission to update this task." }); if (["completed", "cancelled"].includes(String(rows[0].status))) return res.status(409).json({ error: "Completed or cancelled tasks are immutable." });
    const timestamp = now(); await db.execute("UPDATE case_tasks SET status = ?, updated_by = ?, updated_at = ?, completed_by = ?, completed_at = ? WHERE id = ?", [status, session.user.id, timestamp, status === "completed" ? session.user.id : null, status === "completed" ? timestamp : null, req.params.taskId]); await syncCaseMilestone({ caseId: rows[0].case_id, actorUserId: session.user.id, actorRole: session.user.specialistRole || session.user.role, milestoneType: "task", assignedTeam, title: rows[0].title, summary: `Task ${status}.`, status: status as MilestoneStatus, source: { taskId: req.params.taskId, taskStatus: status } }); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CASE_TASK_STATUS_UPDATED', ?, ?, ?)", [randomUUID(), rows[0].case_id, session.user.id, JSON.stringify({ taskId: req.params.taskId, status }), `Task marked ${status}.`, timestamp]); res.json({ success: true, status });
  });
  app.get("/api/care-portal/queue", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const team = resolveCareTeam(session, req.query.team);
    const [rows] = await db.query<RowDataPacket[]>(`SELECT c.id, c.case_number, c.service_category, c.status, c.priority, c.intake_json, c.created_at, c.updated_at,
      client.display_name AS client_name, client.email AS client_email, assignee.display_name AS assigned_name,
      (SELECT COUNT(*) FROM care_coordination_documents d WHERE d.case_id = c.id) AS document_count,
      (SELECT COUNT(*) FROM care_coordination_documents d JOIN care_document_signatures s ON s.document_id = d.id WHERE d.case_id = c.id) AS signed_document_count,
      (SELECT h.to_team FROM care_team_handoffs h WHERE h.case_id = c.id ORDER BY h.created_at DESC LIMIT 1) AS latest_to_team,
      (SELECT h.status FROM care_team_handoffs h WHERE h.case_id = c.id ORDER BY h.created_at DESC LIMIT 1) AS latest_handoff_status
      FROM referral_cases c LEFT JOIN app_users client ON client.id = c.client_id LEFT JOIN app_users assignee ON assignee.id = c.assigned_to
      WHERE c.status IN ('new', 'in_progress', 'pending') AND (
        ? = 'care_coordinator'
        OR (? = 'intake_specialist' AND NOT EXISTS (SELECT 1 FROM care_team_handoffs h0 WHERE h0.case_id = c.id))
        OR EXISTS (SELECT 1 FROM care_team_handoffs h1 WHERE h1.case_id = c.id AND h1.to_team = ? AND h1.status IN ('pending', 'accepted') AND h1.created_at = (SELECT MAX(h2.created_at) FROM care_team_handoffs h2 WHERE h2.case_id = c.id))
      ) ORDER BY FIELD(c.priority, 'urgent', 'high', 'standard', 'low'), c.updated_at DESC LIMIT 200`, [team, team, team]);
    res.json({ team, cases: rows.map((row) => ({ id: row.id, caseNumber: row.case_number, clientName: row.client_name || "Protected client", clientEmail: row.client_email || null, serviceCategory: row.service_category, status: row.status, priority: row.priority, assignedName: row.assigned_name || null, intake: parseJson<Record<string, unknown>>(row.intake_json, {}), documentCount: Number(row.document_count || 0), signedDocumentCount: Number(row.signed_document_count || 0), latestToTeam: row.latest_to_team || null, latestHandoffStatus: row.latest_handoff_status || null, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) })) });
  });
  app.get("/api/care-portal/dashboard", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const team = resolveCareTeam(session, req.query.team);
    const scope = `(
      ? = 'care_coordinator'
      OR (? = 'intake_specialist' AND NOT EXISTS (SELECT 1 FROM care_team_handoffs h0 WHERE h0.case_id = c.id))
      OR EXISTS (SELECT 1 FROM care_team_handoffs h1 WHERE h1.case_id = c.id AND h1.to_team = ? AND h1.status IN ('pending', 'accepted') AND h1.created_at = (SELECT MAX(h2.created_at) FROM care_team_handoffs h2 WHERE h2.case_id = c.id))
    )`;
    const [activeRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS active_count FROM referral_cases c WHERE c.status IN ('new', 'in_progress', 'pending') AND ${scope}`, [team, team, team]);
    const [handoffRows] = await db.query<RowDataPacket[]>(`SELECT h.id, h.case_id, h.from_team, h.to_team, h.note, h.created_at, c.case_number, c.service_category, c.priority, client.display_name AS client_name FROM care_team_handoffs h JOIN referral_cases c ON c.id = h.case_id LEFT JOIN app_users client ON client.id = c.client_id WHERE h.to_team = ? AND h.status = 'pending' AND c.status IN ('new', 'in_progress', 'pending') ORDER BY FIELD(c.priority, 'urgent', 'high', 'standard', 'low'), h.created_at ASC LIMIT 30`, [team]);
    const [unsignedRows] = await db.query<RowDataPacket[]>(`SELECT d.id, d.case_id, d.title, d.document_type, d.required_role, d.created_at, d.updated_at, c.case_number, c.service_category, c.priority, client.display_name AS client_name FROM care_coordination_documents d JOIN referral_cases c ON c.id = d.case_id LEFT JOIN app_users client ON client.id = c.client_id WHERE d.status IN ('draft', 'ready') AND (d.required_role IS NULL OR d.required_role = ?) AND NOT EXISTS (SELECT 1 FROM care_document_signatures s WHERE s.document_id = d.id) AND c.status IN ('new', 'in_progress', 'pending') ORDER BY FIELD(c.priority, 'urgent', 'high', 'standard', 'low'), d.updated_at ASC LIMIT 30`, [team]);
    res.json({ team, summary: { activeCases: Number(activeRows[0]?.active_count || 0), pendingHandoffs: handoffRows.length, unsignedDocuments: unsignedRows.length }, pendingHandoffs: handoffRows.map((row) => ({ id: row.id, caseId: row.case_id, caseNumber: row.case_number, clientName: row.client_name || "Protected client", serviceCategory: row.service_category, priority: row.priority, fromTeam: row.from_team, toTeam: row.to_team, note: row.note || "", createdAt: Number(row.created_at) })), unsignedDocuments: unsignedRows.map((row) => ({ id: row.id, caseId: row.case_id, caseNumber: row.case_number, clientName: row.client_name || "Protected client", serviceCategory: row.service_category, priority: row.priority, title: row.title, documentType: row.document_type, requiredRole: row.required_role || null, updatedAt: Number(row.updated_at) })) });
  });
  app.get("/api/care-portal/cases/:caseId", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const [caseRows] = await db.query<RowDataPacket[]>(`SELECT c.*, client.display_name AS client_name, client.email AS client_email, assignee.display_name AS assigned_name FROM referral_cases c LEFT JOIN app_users client ON client.id = c.client_id LEFT JOIN app_users assignee ON assignee.id = c.assigned_to WHERE c.id = ? LIMIT 1`, [req.params.caseId]);
    if (!caseRows[0]) return res.status(404).json({ error: "Care coordination case not found." });
    const [documentRows] = await db.query<RowDataPacket[]>("SELECT * FROM care_coordination_documents WHERE case_id = ? ORDER BY created_at DESC", [req.params.caseId]);
    const [signatureRows] = await db.query<RowDataPacket[]>(`SELECT s.*, u.display_name AS account_name FROM care_document_signatures s LEFT JOIN app_users u ON u.id = s.signer_user_id JOIN care_coordination_documents d ON d.id = s.document_id WHERE d.case_id = ? ORDER BY s.signed_at DESC`, [req.params.caseId]);
    const [handoffRows] = await db.query<RowDataPacket[]>(`SELECT h.*, creator.display_name AS created_by_name, accepter.display_name AS accepted_by_name FROM care_team_handoffs h LEFT JOIN app_users creator ON creator.id = h.created_by LEFT JOIN app_users accepter ON accepter.id = h.accepted_by WHERE h.case_id = ? ORDER BY h.created_at DESC`, [req.params.caseId]);
    res.json({ case: normalizeCase(caseRows[0]), documents: documentRows.map((row) => ({ id: row.id, caseId: row.case_id, documentType: row.document_type, title: row.title, status: row.status, requiredRole: row.required_role || null, requiredSignerRoles: parseJson<string[] | null>(row.required_signer_roles_json, null), body: parseJson<Record<string, unknown>>(row.body_json, {}), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) })), signatures: signatureRows.map((row) => ({ id: row.id, documentId: row.document_id, signerName: row.signer_name, signerRole: row.signer_role, signatureMethod: row.signature_method, signatureSha256: row.signature_sha256 || null, consentText: row.consent_text, signedAt: Number(row.signed_at), accountName: row.account_name || null })), handoffs: handoffRows.map((row) => ({ id: row.id, caseId: row.case_id, fromTeam: row.from_team, toTeam: row.to_team, status: row.status, note: row.note || "", createdBy: row.created_by, createdByName: row.created_by_name || null, acceptedByName: row.accepted_by_name || null, createdAt: Number(row.created_at), acceptedAt: row.accepted_at ? Number(row.accepted_at) : null })) });
  });
  app.post("/api/care-portal/cases/:caseId/documents", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { documentType?: unknown; title?: unknown; requiredRole?: unknown; requiredSignerRoles?: unknown; body?: unknown };
    const allowedTypes = ["care_consent", "medicaid_authorization", "release_of_information", "treatment_planning", "peer_support_consent", "referral_handoff"];
    if (typeof body.documentType !== "string" || !allowedTypes.includes(body.documentType) || typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180 || typeof body.body !== "object" || body.body === null || Array.isArray(body.body)) return res.status(400).json({ error: "Provide a document type, title, and structured form data." });
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? LIMIT 1", [req.params.caseId]); if (!caseRows[0]) return res.status(404).json({ error: "Care coordination case not found." });
    const id = randomUUID(); const timestamp = now();
    const requiredSignerRoles = Array.isArray(body.requiredSignerRoles) && body.requiredSignerRoles.every((role) => role === "client" || role === "staff") ? Array.from(new Set(body.requiredSignerRoles as string[])) : null;
    try { await db.execute("INSERT INTO care_coordination_documents (id, case_id, document_type, title, status, required_role, required_signer_roles_json, body_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)", [id, req.params.caseId, body.documentType, body.title.trim(), typeof body.requiredRole === "string" && isSpecialistRole(body.requiredRole) ? body.requiredRole : null, requiredSignerRoles ? JSON.stringify(requiredSignerRoles) : null, JSON.stringify(body.body), session.user.id, timestamp, timestamp]); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CARE_DOCUMENT_CREATED', ?, ?, ?)", [randomUUID(), req.params.caseId, session.user.id, JSON.stringify({ documentId: id, documentType: body.documentType, requiredSignerRoles }), `Care coordination document created by ${session.user.displayName}.`, timestamp]); res.status(201).json({ id, requiredSignerRoles }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "This document type already exists for the case." : "Unable to create the care document." }); }
  });
  app.patch("/api/care-portal/documents/:documentId", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { title?: unknown; body?: unknown; status?: unknown };
    const [documentRows] = await db.query<RowDataPacket[]>("SELECT id, case_id, status FROM care_coordination_documents WHERE id = ? LIMIT 1", [req.params.documentId]); if (!documentRows[0]) return res.status(404).json({ error: "Care document not found." });
    if (documentRows[0].status === "signed") return res.status(409).json({ error: "Signed documents are immutable. Create an amended document instead." });
    const updates: string[] = []; const values: Array<string | number | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180) return res.status(400).json({ error: "Document title must be between 3 and 180 characters." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.body !== undefined) { if (typeof body.body !== "object" || body.body === null || Array.isArray(body.body)) return res.status(400).json({ error: "Document form data must be a structured object." }); updates.push("body_json = ?"); values.push(JSON.stringify(body.body)); }
    if (body.status !== undefined) { if (!['draft', 'ready', 'void'].includes(String(body.status))) return res.status(400).json({ error: "Unsupported document status." }); updates.push("status = ?"); values.push(String(body.status)); }
    if (!updates.length) return res.status(400).json({ error: "No document changes were supplied." }); updates.push("updated_at = ?"); values.push(now()); values.push(req.params.documentId);
    await db.execute(`UPDATE care_coordination_documents SET ${updates.join(", ")} WHERE id = ?`, values); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CARE_DOCUMENT_UPDATED', ?, ?, ?)", [randomUUID(), documentRows[0].case_id, session.user.id, JSON.stringify({ documentId: req.params.documentId, fields: updates }), `Care document updated by ${session.user.displayName}.`, now()]); res.json({ success: true });
  });
  app.post("/api/care-portal/documents/:documentId/signatures", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { signerName?: unknown; signerRole?: unknown; consentText?: unknown; signatureMethod?: unknown; signatureDataUrl?: unknown };
    if (typeof body.signerName !== "string" || body.signerName.trim().length < 2 || body.signerName.trim().length > 120 || typeof body.signerRole !== "string" || body.signerRole.trim().length < 2 || body.signerRole.trim().length > 40 || typeof body.consentText !== "string" || body.consentText.trim().length < 20 || (body.signatureMethod !== undefined && body.signatureMethod !== "typed_acknowledgement" && body.signatureMethod !== "canvas")) return res.status(400).json({ error: "Enter the signer name, signer role, and acknowledgement text." });
    const [documentRows] = await db.query<RowDataPacket[]>("SELECT id, case_id, status, required_signer_roles_json FROM care_coordination_documents WHERE id = ? LIMIT 1", [req.params.documentId]); if (!documentRows[0]) return res.status(404).json({ error: "Care document not found." }); if (documentRows[0].status === "void") return res.status(409).json({ error: "Void documents cannot be signed." });
    const requiredSignerRoles = parseJson<string[] | null>(documentRows[0].required_signer_roles_json, null) || [body.signerRole.trim()];
    if (requiredSignerRoles.length && !requiredSignerRoles.includes(body.signerRole.trim())) return res.status(400).json({ error: `This form requires one of these signer roles: ${requiredSignerRoles.join(", ")}.` });
    const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM care_document_signatures WHERE document_id = ? AND signer_role = ? LIMIT 1", [req.params.documentId, body.signerRole.trim()]); if (existing[0]) return res.status(409).json({ error: `A ${body.signerRole} signature is already recorded.` });
    let signatureStorageKey: string | null = null; let signatureSha256: string | null = null;
    if (typeof body.signatureDataUrl === "string") { const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(body.signatureDataUrl); if (!match) return res.status(400).json({ error: "Canvas signature must be a PNG data URL." }); const signatureBuffer = Buffer.from(match[1], "base64"); if (signatureBuffer.length < 50 || signatureBuffer.length > 2_000_000) return res.status(400).json({ error: "Canvas signature size is invalid." }); signatureSha256 = createHash("sha256").update(signatureBuffer).digest("hex"); const stored = await storagePut(`care-signatures/${documentRows[0].case_id}/${req.params.documentId}-${body.signerRole}.png`, signatureBuffer, "image/png"); signatureStorageKey = stored.key; }
    const timestamp = now(); await db.execute("INSERT INTO care_document_signatures (id, document_id, signer_user_id, signer_name, signer_role, signature_method, signature_storage_key, signature_sha256, consent_text, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [randomUUID(), req.params.documentId, session.user.id, body.signerName.trim(), body.signerRole.trim().slice(0, 40), signatureStorageKey ? "canvas" : "typed_acknowledgement", signatureStorageKey, signatureSha256, body.consentText.trim().slice(0, 4000), timestamp]); const [signedRows] = await db.query<RowDataPacket[]>("SELECT DISTINCT signer_role FROM care_document_signatures WHERE document_id = ?", [req.params.documentId]); const complete = requiredSignerRoles.every((role) => signedRows.some((row) => row.signer_role === role)); await db.execute("UPDATE care_coordination_documents SET status = ?, updated_at = ? WHERE id = ?", [complete ? "signed" : "ready", timestamp, req.params.documentId]); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CARE_DOCUMENT_SIGNED', ?, ?, ?)", [randomUUID(), documentRows[0].case_id, session.user.id, JSON.stringify({ documentId: req.params.documentId, signerRole: body.signerRole, signatureMethod: signatureStorageKey ? "canvas" : "typed_acknowledgement", complete, signatureSha256 }), `${body.signerRole.trim()} signature recorded for ${body.signerName.trim()}.`, timestamp]); res.status(201).json({ success: true, complete, status: complete ? "signed" : "ready", signatureSha256 });
  });
  app.post("/api/care-portal/cases/:caseId/handoffs", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const body = req.body as { fromTeam?: unknown; toTeam?: unknown; note?: unknown };
    if (!isSpecialistRole(body.fromTeam) || !isSpecialistRole(body.toTeam) || body.fromTeam === body.toTeam || (body.note !== undefined && typeof body.note !== "string")) return res.status(400).json({ error: "Choose different valid sending and receiving teams." });
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT id FROM referral_cases WHERE id = ? LIMIT 1", [req.params.caseId]); if (!caseRows[0]) return res.status(404).json({ error: "Care coordination case not found." });
    const id = randomUUID(); const timestamp = now(); await db.execute("INSERT INTO care_team_handoffs (id, case_id, from_team, to_team, status, note, created_by, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)", [id, req.params.caseId, body.fromTeam, body.toTeam, typeof body.note === "string" ? body.note.trim().slice(0, 4000) || null : null, session.user.id, timestamp]); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'CARE_TEAM_HANDOFF_CREATED', ?, ?, ?)", [randomUUID(), req.params.caseId, session.user.id, JSON.stringify({ handoffId: id, fromTeam: body.fromTeam, toTeam: body.toTeam }), `Care team handoff sent to ${body.toTeam}.`, timestamp]); await syncCaseMilestone({ caseId: req.params.caseId, actorUserId: session.user.id, actorRole: session.user.specialistRole || session.user.role, milestoneType: "handoff", assignedTeam: body.toTeam as SpecialistRole, title: `Warm handoff to ${body.toTeam}`, summary: typeof body.note === "string" ? body.note.trim() : "Pending receiving-team review.", status: "open", source: { handoffId: id, fromTeam: body.fromTeam, toTeam: body.toTeam } }); res.status(201).json({ id });
  });
  app.patch("/api/care-portal/handoffs/:handoffId", async (req, res) => {
    const session = await requireCareTeam(req, res); if (!session) return;
    const status = req.body?.status; if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: "Choose accepted or declined." });
    const timestamp = now(); const [handoffRows] = await db.query<RowDataPacket[]>("SELECT id, case_id, from_team, to_team FROM care_team_handoffs WHERE id = ? AND status = 'pending' LIMIT 1", [req.params.handoffId]); if (!handoffRows[0]) return res.status(404).json({ error: "Pending handoff not found." }); const [result] = await db.execute("UPDATE care_team_handoffs SET status = ?, accepted_by = ?, accepted_at = ? WHERE id = ? AND status = 'pending'", [status, session.user.id, timestamp, req.params.handoffId]); if (!(result as any).affectedRows) return res.status(404).json({ error: "Pending handoff not found." }); await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [randomUUID(), handoffRows[0].case_id, session.user.id, "CARE_TEAM_HANDOFF_STATUS_UPDATED", JSON.stringify({ handoffId: req.params.handoffId, status }), `Warm handoff ${status}.`, timestamp]); await syncCaseMilestone({ caseId: handoffRows[0].case_id, actorUserId: session.user.id, actorRole: session.user.specialistRole || session.user.role, milestoneType: "handoff", assignedTeam: handoffRows[0].to_team as SpecialistRole, title: `Warm handoff to ${handoffRows[0].to_team}`, summary: `Receiving team ${status} the handoff.`, status: status === "accepted" ? "in_progress" : "blocked", source: { handoffId: req.params.handoffId, status } }); res.json({ success: true });
  });

  app.get("/api/admin/users", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, email, display_name, role, specialist_role, is_active, created_at, updated_at FROM app_users ORDER BY created_at DESC");
    res.json({ users: rows.map((row) => ({ id: row.id, email: row.email, displayName: row.display_name, role: row.role, specialistRole: row.specialist_role || null, isActive: Boolean(row.is_active), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) })) });
  });

  app.patch("/api/admin/users/:userId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const { displayName, role, specialistRole, isActive } = req.body as { displayName?: string; role?: Role; specialistRole?: SpecialistRole | null; isActive?: boolean };
    if (req.params.userId === session.user.id && isActive === false) return res.status(400).json({ error: "You cannot deactivate your own administrator session." });
    if (displayName !== undefined && (displayName.trim().length < 2 || displayName.trim().length > 100)) return res.status(400).json({ error: "Display name must be between 2 and 100 characters." });
    if (role !== undefined && !["client", "admin", "researcher"].includes(role)) return res.status(400).json({ error: "Unsupported account role." });
    if (specialistRole !== undefined && specialistRole !== null && !isSpecialistRole(specialistRole)) return res.status(400).json({ error: "Unsupported specialist assignment." });
    const updates: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    if (displayName !== undefined) { updates.push("display_name = ?"); values.push(displayName.trim()); }
    if (role !== undefined) { updates.push("role = ?"); values.push(role); }
    if (specialistRole !== undefined) { updates.push("specialist_role = ?"); values.push(specialistRole); }
    if (isActive !== undefined) { updates.push("is_active = ?"); values.push(Boolean(isActive)); }
    if (!updates.length) return res.status(400).json({ error: "No account changes were supplied." });
    updates.push("updated_at = ?"); values.push(now()); values.push(req.params.userId);
    const [result] = await db.execute(`UPDATE app_users SET ${updates.join(", ")} WHERE id = ?`, values);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Account not found." });
    if (isActive === false) await db.execute("DELETE FROM app_sessions WHERE user_id = ?", [req.params.userId]);
    await recordAdminAudit(session.user.id, "ACCOUNT_UPDATED", "user", req.params.userId, { fields: updates.filter((field) => field !== "updated_at").map((field) => field.split(" ")[0]) });
    res.json({ success: true });
  });

  app.post("/api/admin/users/:userId/reset-password", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const { password } = req.body as { password?: string };
    if (!validatePassword(password)) return res.status(400).json({ error: "Use a password of at least 12 characters containing letters and numbers." });
    const timestamp = now();
    const [result] = await db.execute("UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ? AND is_active = TRUE", [hashPassword(password as string), timestamp, req.params.userId]);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Active account not found." });
    await db.execute("DELETE FROM app_sessions WHERE user_id = ?", [req.params.userId]);
    await recordAdminAudit(session.user.id, "PASSWORD_RESET", "user", req.params.userId);
    res.json({ success: true, message: "Password updated and existing sessions revoked." });
  });

  app.get("/api/admin/studies", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT s.*, owner.display_name AS owner_name,
        (SELECT COUNT(*) FROM study_memberships m WHERE m.study_id = s.id AND m.is_active = TRUE) AS member_count,
        (SELECT COUNT(*) FROM study_protocol_versions p WHERE p.study_id = s.id) AS protocol_count,
        (SELECT COUNT(*) FROM consent_documents d WHERE d.study_id = s.id) AS consent_document_count
       FROM studies s LEFT JOIN app_users owner ON owner.id = s.owner_user_id ORDER BY s.updated_at DESC`
    );
    res.json({ studies: rows.map(normalizeStudy) });
  });
  app.post("/api/admin/studies", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const body = req.body as { studyKey?: unknown; title?: unknown; description?: unknown; protocolVersion?: unknown; status?: unknown; ownerUserId?: unknown; startDate?: unknown; endDate?: unknown };
    const studyKey = typeof body.studyKey === "string" ? body.studyKey.trim().toLowerCase() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const protocolVersion = typeof body.protocolVersion === "string" ? body.protocolVersion.trim() : "";
    const startDate = nullableDate(body.startDate);
    const endDate = nullableDate(body.endDate);
    if (!isSafeKey(studyKey) || title.length < 3 || title.length > 180 || !protocolVersion || (body.status !== undefined && !isStudyStatus(body.status)) || startDate === null || endDate === null) return res.status(400).json({ error: "Provide a valid study key, title, protocol version, status, and ISO dates." });
    if (startDate && endDate && startDate > endDate) return res.status(400).json({ error: "Study end date cannot be before its start date." });
    const ownerUserId = typeof body.ownerUserId === "string" ? body.ownerUserId : session.user.id;
    const [ownerRows] = await db.query<RowDataPacket[]>("SELECT id FROM app_users WHERE id = ? AND is_active = TRUE AND role IN ('admin', 'researcher') LIMIT 1", [ownerUserId]);
    if (!ownerRows[0]) return res.status(400).json({ error: "The study owner must be an active staff account." });
    const id = randomUUID();
    const timestamp = now();
    try {
      await db.execute("INSERT INTO studies (id, study_key, title, description, status, protocol_version, owner_user_id, start_date, end_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, studyKey, title, typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null, isStudyStatus(body.status) ? body.status : "draft", protocolVersion, ownerUserId, startDate || null, endDate || null, session.user.id, timestamp, timestamp]);
      await db.execute("INSERT INTO study_memberships (id, study_id, user_id, membership_role, is_active, created_by, created_at) VALUES (?, ?, ?, 'owner', TRUE, ?, ?)", [randomUUID(), id, ownerUserId, session.user.id, timestamp]);
      await recordAdminAudit(session.user.id, "STUDY_CREATED", "study", id, { studyKey, protocolVersion });
      res.status(201).json({ study: { id, studyKey, title } });
    } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "A study with that key already exists." : "Unable to create the study." }); }
  });
  app.patch("/api/admin/studies/:studyId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const body = req.body as { title?: unknown; description?: unknown; status?: unknown; protocolVersion?: unknown; ownerUserId?: unknown; startDate?: unknown; endDate?: unknown };
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180) return res.status(400).json({ error: "Study title must be between 3 and 180 characters." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.description !== undefined) { updates.push("description = ?"); values.push(typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null); }
    if (body.status !== undefined) { if (!isStudyStatus(body.status)) return res.status(400).json({ error: "Unsupported study status." }); updates.push("status = ?"); values.push(body.status); }
    if (body.protocolVersion !== undefined) { if (typeof body.protocolVersion !== "string" || !body.protocolVersion.trim()) return res.status(400).json({ error: "Protocol version is required." }); updates.push("protocol_version = ?"); values.push(body.protocolVersion.trim()); }
    if (body.ownerUserId !== undefined) { if (typeof body.ownerUserId !== "string") return res.status(400).json({ error: "Choose an active staff study owner." }); const [ownerRows] = await db.query<RowDataPacket[]>("SELECT id FROM app_users WHERE id = ? AND is_active = TRUE AND role IN ('admin', 'researcher') LIMIT 1", [body.ownerUserId]); if (!ownerRows[0]) return res.status(400).json({ error: "The study owner must be an active staff account." }); updates.push("owner_user_id = ?"); values.push(body.ownerUserId); }
    for (const [field, value] of [["start_date", body.startDate], ["end_date", body.endDate]] as const) { if (value !== undefined) { const date = nullableDate(value); if (date === null) return res.status(400).json({ error: "Study dates must use YYYY-MM-DD format." }); updates.push(`${field} = ?`); values.push(date || null); } }
    if (!updates.length) return res.status(400).json({ error: "No study changes were supplied." });
    updates.push("updated_at = ?"); values.push(now()); values.push(req.params.studyId);
    const [result] = await db.execute(`UPDATE studies SET ${updates.join(", ")} WHERE id = ?`, values);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Study not found." });
    await recordAdminAudit(session.user.id, "STUDY_UPDATED", "study", req.params.studyId, { fields: updates.filter((field) => field !== "updated_at").map((field) => field.split(" ")[0]) });
    res.json({ success: true });
  });
  app.get("/api/admin/studies/:studyId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT s.*, owner.display_name AS owner_name FROM studies s LEFT JOIN app_users owner ON owner.id = s.owner_user_id WHERE s.id = ? LIMIT 1", [req.params.studyId]);
    if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const [protocolRows] = await db.query<RowDataPacket[]>("SELECT p.*, u.display_name AS created_by_name FROM study_protocol_versions p LEFT JOIN app_users u ON u.id = p.created_by WHERE p.study_id = ? ORDER BY p.created_at DESC", [req.params.studyId]);
    const [consentRows] = await db.query<RowDataPacket[]>("SELECT d.*, u.display_name AS created_by_name FROM consent_documents d LEFT JOIN app_users u ON u.id = d.created_by WHERE d.study_id = ? ORDER BY d.created_at DESC", [req.params.studyId]);
    const [memberRows] = await db.query<RowDataPacket[]>("SELECT m.*, u.email, u.display_name, u.role FROM study_memberships m JOIN app_users u ON u.id = m.user_id WHERE m.study_id = ? ORDER BY u.display_name", [req.params.studyId]);
    res.json({ study: normalizeStudy(studyRows[0]), protocols: protocolRows.map(normalizeProtocol), consentDocuments: consentRows.map(normalizeConsentDocument), members: memberRows.map((row) => ({ id: row.id, userId: row.user_id, email: row.email, displayName: row.display_name, role: row.role, membershipRole: row.membership_role, isActive: Boolean(row.is_active) })) });
  });
  app.post("/api/admin/studies/:studyId/protocols", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const body = req.body as { version?: unknown; title?: unknown; summary?: unknown; status?: unknown; effectiveAt?: unknown };
    if (typeof body.version !== "string" || !body.version.trim() || typeof body.title !== "string" || body.title.trim().length < 3 || (body.status !== undefined && !isProtocolStatus(body.status)) || (body.summary !== undefined && (typeof body.summary !== "object" || body.summary === null || Array.isArray(body.summary)))) return res.status(400).json({ error: "Provide a protocol version, title, object summary, and valid status." });
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]);
    if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const id = randomUUID(); const timestamp = now();
    try { await db.execute("INSERT INTO study_protocol_versions (id, study_id, version, title, summary_json, status, effective_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.studyId, body.version.trim(), body.title.trim(), JSON.stringify(body.summary || {}), isProtocolStatus(body.status) ? body.status : "draft", typeof body.effectiveAt === "number" ? body.effectiveAt : null, session.user.id, timestamp]); await recordAdminAudit(session.user.id, "PROTOCOL_CREATED", "protocol", id, { studyId: req.params.studyId, version: body.version.trim() }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That protocol version already exists for this study." : "Unable to create the protocol version." }); }
  });
  app.patch("/api/admin/protocols/:protocolId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const body = req.body as { title?: unknown; summary?: unknown; status?: unknown; effectiveAt?: unknown };
    const updates: string[] = []; const values: Array<string | number | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3) return res.status(400).json({ error: "Protocol title is required." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.summary !== undefined) { if (typeof body.summary !== "object" || body.summary === null || Array.isArray(body.summary)) return res.status(400).json({ error: "Protocol summary must be an object." }); updates.push("summary_json = ?"); values.push(JSON.stringify(body.summary)); }
    if (body.status !== undefined) { if (!isProtocolStatus(body.status)) return res.status(400).json({ error: "Unsupported protocol status." }); updates.push("status = ?"); values.push(body.status); }
    if (body.effectiveAt !== undefined) { if (body.effectiveAt !== null && typeof body.effectiveAt !== "number") return res.status(400).json({ error: "Protocol effective date must be a timestamp." }); updates.push("effective_at = ?"); values.push(body.effectiveAt as number | null); }
    if (!updates.length) return res.status(400).json({ error: "No protocol changes were supplied." }); values.push(req.params.protocolId);
    const [result] = await db.execute(`UPDATE study_protocol_versions SET ${updates.join(", ")} WHERE id = ?`, values);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Protocol version not found." });
    await recordAdminAudit(session.user.id, "PROTOCOL_UPDATED", "protocol", req.params.protocolId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.post("/api/admin/studies/:studyId/members", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { userId?: unknown; membershipRole?: unknown };
    if (typeof body.userId !== "string" || !["owner", "researcher", "data_steward", "reviewer"].includes(String(body.membershipRole || "researcher"))) return res.status(400).json({ error: "Choose a staff account and membership role." });
    const [userRows] = await db.query<RowDataPacket[]>("SELECT id FROM app_users WHERE id = ? AND is_active = TRUE AND role IN ('admin', 'researcher') LIMIT 1", [body.userId]);
    if (!userRows[0]) return res.status(400).json({ error: "Study members must be active staff accounts." });
    try { await db.execute("INSERT INTO study_memberships (id, study_id, user_id, membership_role, is_active, created_by, created_at) VALUES (?, ?, ?, ?, TRUE, ?, ?)", [randomUUID(), req.params.studyId, body.userId, String(body.membershipRole || "researcher"), session.user.id, now()]); await recordAdminAudit(session.user.id, "STUDY_MEMBER_ADDED", "study", req.params.studyId, { userId: body.userId }); res.status(201).json({ success: true }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That account is already a member of this study." : "Unable to add the study member." }); }
  });
  app.get("/api/admin/studies/:studyId/research-config", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]);
    if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const [dictionaryRows] = await db.query<RowDataPacket[]>(`SELECT d.*, u.display_name AS created_by_name,
      (SELECT COUNT(*) FROM data_dictionary_variables v WHERE v.dictionary_version_id = d.id) AS variable_count
      FROM data_dictionary_versions d LEFT JOIN app_users u ON u.id = d.created_by
      WHERE d.study_id = ? ORDER BY d.created_at DESC`, [req.params.studyId]);
    const [instrumentRows] = await db.query<RowDataPacket[]>(`SELECT i.*, u.display_name AS created_by_name,
      (SELECT COUNT(*) FROM research_instrument_items ii WHERE ii.instrument_id = i.id) AS item_count
      FROM research_instruments i LEFT JOIN app_users u ON u.id = i.created_by
      WHERE i.study_id = ? ORDER BY i.created_at DESC`, [req.params.studyId]);
    res.json({ dictionaries: dictionaryRows.map(normalizeDictionary), instruments: instrumentRows.map(normalizeInstrument) });
  });
  app.get("/api/research/studies/:studyId/research-config", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    if (session.user.role === "researcher") {
      const [membershipRows] = await db.query<RowDataPacket[]>("SELECT id FROM study_memberships WHERE study_id = ? AND user_id = ? AND is_active = TRUE LIMIT 1", [req.params.studyId, session.user.id]);
      if (!membershipRows[0]) return res.status(403).json({ error: "You are not assigned to this study." });
    }
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]); if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const [dictionaryRows] = await db.query<RowDataPacket[]>(`SELECT d.*, u.display_name AS created_by_name,
      (SELECT COUNT(*) FROM data_dictionary_variables v WHERE v.dictionary_version_id = d.id) AS variable_count
      FROM data_dictionary_versions d LEFT JOIN app_users u ON u.id = d.created_by WHERE d.study_id = ? ORDER BY d.created_at DESC`, [req.params.studyId]);
    const [instrumentRows] = await db.query<RowDataPacket[]>(`SELECT i.*, u.display_name AS created_by_name,
      (SELECT COUNT(*) FROM research_instrument_items ii WHERE ii.instrument_id = i.id) AS item_count
      FROM research_instruments i LEFT JOIN app_users u ON u.id = i.created_by WHERE i.study_id = ? ORDER BY i.created_at DESC`, [req.params.studyId]);
    const [protocolRows] = await db.query<RowDataPacket[]>("SELECT p.*, u.display_name AS created_by_name FROM study_protocol_versions p LEFT JOIN app_users u ON u.id = p.created_by WHERE p.study_id = ? AND p.status = 'active' ORDER BY p.created_at DESC", [req.params.studyId]);
    const [consentRows] = await db.query<RowDataPacket[]>("SELECT d.*, u.display_name AS created_by_name FROM consent_documents d LEFT JOIN app_users u ON u.id = d.created_by WHERE d.study_id = ? AND d.status = 'active' ORDER BY d.created_at DESC", [req.params.studyId]);
    res.json({ dictionaries: dictionaryRows.map(normalizeDictionary), instruments: instrumentRows.map(normalizeInstrument), protocols: protocolRows.map(normalizeProtocol), consentDocuments: consentRows.map(normalizeConsentDocument), readOnly: session.user.role !== "admin" });
  });
  app.post("/api/admin/studies/:studyId/dictionaries", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { version?: unknown; title?: unknown; description?: unknown; status?: unknown };
    if (typeof body.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(body.version.trim()) || typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180 || (body.status !== undefined && !isDictionaryStatus(body.status))) return res.status(400).json({ error: "Provide a valid dictionary version, title, and status." });
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]); if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const id = randomUUID(); const timestamp = now();
    try { await db.execute("INSERT INTO data_dictionary_versions (id, study_id, version, title, description, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.studyId, body.version.trim(), body.title.trim(), typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null, isDictionaryStatus(body.status) ? body.status : "draft", session.user.id, timestamp]); await recordAdminAudit(session.user.id, "DICTIONARY_CREATED", "data-dictionary", id, { studyId: req.params.studyId, version: body.version.trim() }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That dictionary version already exists for this study." : "Unable to create the dictionary version." }); }
  });
  app.get("/api/admin/dictionaries/:dictionaryId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const [dictionaryRows] = await db.query<RowDataPacket[]>("SELECT d.*, u.display_name AS created_by_name FROM data_dictionary_versions d LEFT JOIN app_users u ON u.id = d.created_by WHERE d.id = ? LIMIT 1", [req.params.dictionaryId]);
    if (!dictionaryRows[0]) return res.status(404).json({ error: "Dictionary version not found." });
    const [variableRows] = await db.query<RowDataPacket[]>("SELECT * FROM data_dictionary_variables WHERE dictionary_version_id = ? ORDER BY display_order, variable_key", [req.params.dictionaryId]);
    res.json({ dictionary: normalizeDictionary(dictionaryRows[0]), variables: variableRows.map(normalizeVariable) });
  });
  app.patch("/api/admin/dictionaries/:dictionaryId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { title?: unknown; description?: unknown; status?: unknown };
    const [currentRows] = await db.query<RowDataPacket[]>("SELECT status FROM data_dictionary_versions WHERE id = ? LIMIT 1", [req.params.dictionaryId]);
    if (!currentRows[0]) return res.status(404).json({ error: "Dictionary version not found." });
    if (body.status === "draft" && currentRows[0].status !== "draft") return res.status(409).json({ error: "Active or retired dictionary versions cannot be reopened. Create a new version." });
    const updates: string[] = []; const values: Array<string | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180) return res.status(400).json({ error: "Dictionary title must be between 3 and 180 characters." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.description !== undefined) { updates.push("description = ?"); values.push(typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null); }
    if (body.status !== undefined) { if (!isDictionaryStatus(body.status)) return res.status(400).json({ error: "Unsupported dictionary status." }); updates.push("status = ?"); values.push(body.status); }
    if (!updates.length) return res.status(400).json({ error: "No dictionary changes were supplied." }); values.push(req.params.dictionaryId);
    const [result] = await db.execute(`UPDATE data_dictionary_versions SET ${updates.join(", ")} WHERE id = ?`, values);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Dictionary version not found." });
    await recordAdminAudit(session.user.id, "DICTIONARY_UPDATED", "data-dictionary", req.params.dictionaryId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.post("/api/admin/dictionaries/:dictionaryId/variables", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { variableKey?: unknown; label?: unknown; description?: unknown; dataType?: unknown; variableRole?: unknown; unit?: unknown; permissibleValues?: unknown; sourceField?: unknown; isRequired?: unknown; isSensitive?: unknown; isDerived?: unknown; displayOrder?: unknown };
    const variableKey = typeof body.variableKey === "string" ? body.variableKey.trim() : "";
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const permissibleValues = normalizeResearchValueList(body.permissibleValues);
    if (!isSafeKey(variableKey) || variableKey.length > 100 || label.length < 2 || label.length > 180 || !isVariableDataType(body.dataType) || !isVariableRole(body.variableRole || "measure") || !permissibleValues) return res.status(400).json({ error: "Provide a valid variable key, label, data type, role, and permissible values list." });
    const dataType = body.dataType as VariableDataType;
    const variableRole = (body.variableRole || "measure") as VariableRole;
    const [dictionaryRows] = await db.query<RowDataPacket[]>("SELECT id, status FROM data_dictionary_versions WHERE id = ? LIMIT 1", [req.params.dictionaryId]); if (!dictionaryRows[0]) return res.status(404).json({ error: "Dictionary version not found." });
    if (dictionaryRows[0].status !== "draft") return res.status(409).json({ error: "Only draft dictionary versions can be edited. Create a new version for changes." });
    const id = randomUUID();
    try { await db.execute("INSERT INTO data_dictionary_variables (id, dictionary_version_id, variable_key, label, description, data_type, variable_role, unit, permissible_values_json, source_field, is_required, is_sensitive, is_derived, display_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.dictionaryId, variableKey, label, typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null, dataType, variableRole, typeof body.unit === "string" ? body.unit.trim().slice(0, 80) || null : null, JSON.stringify(permissibleValues), typeof body.sourceField === "string" ? body.sourceField.trim().slice(0, 120) || null : null, Boolean(body.isRequired), Boolean(body.isSensitive), Boolean(body.isDerived), typeof body.displayOrder === "number" && Number.isInteger(body.displayOrder) ? Math.max(0, Math.min(9999, body.displayOrder)) : 0, now()]); await recordAdminAudit(session.user.id, "DICTIONARY_VARIABLE_CREATED", "data-dictionary-variable", id, { dictionaryId: req.params.dictionaryId, variableKey }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That variable key already exists in this dictionary version." : "Unable to create the variable." }); }
  });
  app.patch("/api/admin/dictionary-variables/:variableId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const [versionRows] = await db.query<RowDataPacket[]>("SELECT d.status FROM data_dictionary_variables v JOIN data_dictionary_versions d ON d.id = v.dictionary_version_id WHERE v.id = ? LIMIT 1", [req.params.variableId]);
    if (!versionRows[0]) return res.status(404).json({ error: "Variable not found." });
    if (versionRows[0].status !== "draft") return res.status(409).json({ error: "Only variables in draft dictionary versions can be edited." });
    const body = req.body as { label?: unknown; description?: unknown; dataType?: unknown; variableRole?: unknown; unit?: unknown; permissibleValues?: unknown; sourceField?: unknown; isRequired?: unknown; isSensitive?: unknown; isDerived?: unknown; displayOrder?: unknown };
    const updates: string[] = []; const values: Array<string | number | boolean | null> = [];
    if (body.label !== undefined) { if (typeof body.label !== "string" || body.label.trim().length < 2 || body.label.trim().length > 180) return res.status(400).json({ error: "Variable label must be between 2 and 180 characters." }); updates.push("label = ?"); values.push(body.label.trim()); }
    if (body.description !== undefined) { updates.push("description = ?"); values.push(typeof body.description === "string" ? body.description.trim().slice(0, 4000) || null : null); }
    if (body.dataType !== undefined) { if (!isVariableDataType(body.dataType)) return res.status(400).json({ error: "Unsupported variable data type." }); updates.push("data_type = ?"); values.push(body.dataType); }
    if (body.variableRole !== undefined) { if (!isVariableRole(body.variableRole)) return res.status(400).json({ error: "Unsupported variable role." }); updates.push("variable_role = ?"); values.push(body.variableRole); }
    if (body.unit !== undefined) { updates.push("unit = ?"); values.push(typeof body.unit === "string" ? body.unit.trim().slice(0, 80) || null : null); }
    if (body.permissibleValues !== undefined) { if (!Array.isArray(body.permissibleValues) || body.permissibleValues.length > 100) return res.status(400).json({ error: "Permissible values must be an array of at most 100 items." }); updates.push("permissible_values_json = ?"); values.push(JSON.stringify(body.permissibleValues)); }
    if (body.sourceField !== undefined) { updates.push("source_field = ?"); values.push(typeof body.sourceField === "string" ? body.sourceField.trim().slice(0, 120) || null : null); }
    for (const [field, value] of [["is_required", body.isRequired], ["is_sensitive", body.isSensitive], ["is_derived", body.isDerived]] as const) { if (value !== undefined) { if (typeof value !== "boolean") return res.status(400).json({ error: "Variable flags must be boolean." }); updates.push(`${field} = ?`); values.push(value); } }
    if (body.displayOrder !== undefined) { if (typeof body.displayOrder !== "number" || !Number.isInteger(body.displayOrder)) return res.status(400).json({ error: "Display order must be an integer." }); updates.push("display_order = ?"); values.push(Math.max(0, Math.min(9999, body.displayOrder))); }
    if (!updates.length) return res.status(400).json({ error: "No variable changes were supplied." }); values.push(req.params.variableId);
    const [result] = await db.execute(`UPDATE data_dictionary_variables SET ${updates.join(", ")} WHERE id = ?`, values); if (!(result as any).affectedRows) return res.status(404).json({ error: "Variable not found." });
    await recordAdminAudit(session.user.id, "DICTIONARY_VARIABLE_UPDATED", "data-dictionary-variable", req.params.variableId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.post("/api/admin/studies/:studyId/instruments", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { instrumentKey?: unknown; version?: unknown; title?: unknown; purpose?: unknown; scoringRules?: unknown; status?: unknown; mode?: unknown };
    const instrumentKey = typeof body.instrumentKey === "string" ? body.instrumentKey.trim() : "";
    if (!isSafeKey(instrumentKey) || instrumentKey.length > 100 || typeof body.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(body.version.trim()) || typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180 || (body.status !== undefined && !isInstrumentStatus(body.status)) || (body.mode !== undefined && !isInstrumentMode(body.mode))) return res.status(400).json({ error: "Provide a valid instrument key, version, title, status, and mode." });
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]); if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const id = randomUUID(); const timestamp = now();
    if (body.scoringRules !== undefined && (typeof body.scoringRules !== "object" || body.scoringRules === null || Array.isArray(body.scoringRules))) return res.status(400).json({ error: "Scoring rules must be a JSON object." });
    try { await db.execute("INSERT INTO research_instruments (id, study_id, instrument_key, version, title, purpose, scoring_rules_json, status, mode, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.studyId, instrumentKey, body.version.trim(), body.title.trim(), typeof body.purpose === "string" ? body.purpose.trim().slice(0, 4000) || null : null, body.scoringRules ? JSON.stringify(body.scoringRules) : null, isInstrumentStatus(body.status) ? body.status : "draft", isInstrumentMode(body.mode) ? body.mode : "form", session.user.id, timestamp]); await recordAdminAudit(session.user.id, "INSTRUMENT_CREATED", "research-instrument", id, { studyId: req.params.studyId, instrumentKey, version: body.version.trim() }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That instrument version already exists for this study." : "Unable to create the instrument." }); }
  });
  app.get("/api/admin/instruments/:instrumentId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const [instrumentRows] = await db.query<RowDataPacket[]>("SELECT i.*, u.display_name AS created_by_name FROM research_instruments i LEFT JOIN app_users u ON u.id = i.created_by WHERE i.id = ? LIMIT 1", [req.params.instrumentId]);
    if (!instrumentRows[0]) return res.status(404).json({ error: "Instrument not found." });
    const [itemRows] = await db.query<RowDataPacket[]>(`SELECT ii.*, v.variable_key, v.label AS variable_label
      FROM research_instrument_items ii LEFT JOIN data_dictionary_variables v ON v.id = ii.variable_id
      WHERE ii.instrument_id = ? ORDER BY ii.item_order, ii.item_key`, [req.params.instrumentId]);
    res.json({ instrument: normalizeInstrument(instrumentRows[0]), items: itemRows.map(normalizeInstrumentItem) });
  });
  app.patch("/api/admin/instruments/:instrumentId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { title?: unknown; purpose?: unknown; scoringRules?: unknown; status?: unknown; mode?: unknown };
    const [currentRows] = await db.query<RowDataPacket[]>("SELECT status FROM research_instruments WHERE id = ? LIMIT 1", [req.params.instrumentId]);
    if (!currentRows[0]) return res.status(404).json({ error: "Instrument not found." });
    if (body.status === "draft" && currentRows[0].status !== "draft") return res.status(409).json({ error: "Active or retired instrument versions cannot be reopened. Create a new version." });
    const updates: string[] = []; const values: Array<string | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3 || body.title.trim().length > 180) return res.status(400).json({ error: "Instrument title must be between 3 and 180 characters." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.purpose !== undefined) { updates.push("purpose = ?"); values.push(typeof body.purpose === "string" ? body.purpose.trim().slice(0, 4000) || null : null); }
    if (body.scoringRules !== undefined) { if (typeof body.scoringRules !== "object" || body.scoringRules === null || Array.isArray(body.scoringRules)) return res.status(400).json({ error: "Scoring rules must be a JSON object." }); updates.push("scoring_rules_json = ?"); values.push(JSON.stringify(body.scoringRules)); }
    if (body.status !== undefined) { if (!isInstrumentStatus(body.status)) return res.status(400).json({ error: "Unsupported instrument status." }); updates.push("status = ?"); values.push(body.status); }
    if (body.mode !== undefined) { if (!isInstrumentMode(body.mode)) return res.status(400).json({ error: "Unsupported instrument mode." }); updates.push("mode = ?"); values.push(body.mode); }
    if (!updates.length) return res.status(400).json({ error: "No instrument changes were supplied." }); values.push(req.params.instrumentId);
    const [result] = await db.execute(`UPDATE research_instruments SET ${updates.join(", ")} WHERE id = ?`, values); if (!(result as any).affectedRows) return res.status(404).json({ error: "Instrument not found." });
    await recordAdminAudit(session.user.id, "INSTRUMENT_UPDATED", "research-instrument", req.params.instrumentId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.post("/api/admin/instruments/:instrumentId/items", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { variableId?: unknown; itemKey?: unknown; itemOrder?: unknown; prompt?: unknown; responseType?: unknown; config?: unknown; isRequired?: unknown };
    const itemKey = typeof body.itemKey === "string" ? body.itemKey.trim() : "";
    if (!isSafeKey(itemKey) || itemKey.length > 100 || typeof body.prompt !== "string" || body.prompt.trim().length < 2 || body.prompt.trim().length > 4000 || !isResponseType(body.responseType) || (body.config !== undefined && (typeof body.config !== "object" || body.config === null || Array.isArray(body.config))) || (body.variableId !== undefined && body.variableId !== null && typeof body.variableId !== "string")) return res.status(400).json({ error: "Provide a valid item key, prompt, response type, configuration, and variable link." });
    const [instrumentRows] = await db.query<RowDataPacket[]>("SELECT id, study_id, status FROM research_instruments WHERE id = ? LIMIT 1", [req.params.instrumentId]); if (!instrumentRows[0]) return res.status(404).json({ error: "Instrument not found." });
    if (instrumentRows[0].status !== "draft") return res.status(409).json({ error: "Only draft instruments can be edited. Create a new version for changes." });
    if (body.variableId) { const [variableRows] = await db.query<RowDataPacket[]>(`SELECT v.id FROM data_dictionary_variables v JOIN data_dictionary_versions d ON d.id = v.dictionary_version_id WHERE v.id = ? AND d.study_id = ? LIMIT 1`, [body.variableId, instrumentRows[0].study_id]); if (!variableRows[0]) return res.status(400).json({ error: "The selected variable must belong to the same study." }); }
    const id = randomUUID();
    try { await db.execute("INSERT INTO research_instrument_items (id, instrument_id, variable_id, item_key, item_order, prompt, response_type, config_json, is_required, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.instrumentId, body.variableId || null, itemKey, typeof body.itemOrder === "number" && Number.isInteger(body.itemOrder) ? Math.max(0, Math.min(9999, body.itemOrder)) : 0, body.prompt.trim().slice(0, 4000), body.responseType, body.config ? JSON.stringify(body.config) : null, Boolean(body.isRequired), now()]); await recordAdminAudit(session.user.id, "INSTRUMENT_ITEM_CREATED", "research-instrument-item", id, { instrumentId: req.params.instrumentId, itemKey }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That item key already exists in this instrument." : "Unable to create the instrument item." }); }
  });
  app.patch("/api/admin/instrument-items/:itemId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { variableId?: unknown; itemOrder?: unknown; prompt?: unknown; responseType?: unknown; config?: unknown; isRequired?: unknown };
    const [itemRows] = await db.query<RowDataPacket[]>(`SELECT ii.id, i.status, i.study_id FROM research_instrument_items ii JOIN research_instruments i ON i.id = ii.instrument_id WHERE ii.id = ? LIMIT 1`, [req.params.itemId]);
    if (!itemRows[0]) return res.status(404).json({ error: "Instrument item not found." });
    if (itemRows[0].status !== "draft") return res.status(409).json({ error: "Only items in draft instruments can be edited." });
    const updates: string[] = []; const values: Array<string | number | boolean | null> = [];
    if (body.variableId !== undefined) { if (body.variableId !== null && typeof body.variableId !== "string") return res.status(400).json({ error: "Variable link must be a valid ID or null." }); if (body.variableId) { const [variableRows] = await db.query<RowDataPacket[]>(`SELECT v.id FROM data_dictionary_variables v JOIN data_dictionary_versions d ON d.id = v.dictionary_version_id WHERE v.id = ? AND d.study_id = ? LIMIT 1`, [body.variableId, itemRows[0].study_id]); if (!variableRows[0]) return res.status(400).json({ error: "The selected variable must belong to the same study." }); } updates.push("variable_id = ?"); values.push(body.variableId as string | null); }
    if (body.itemOrder !== undefined) { if (typeof body.itemOrder !== "number" || !Number.isInteger(body.itemOrder)) return res.status(400).json({ error: "Item order must be an integer." }); updates.push("item_order = ?"); values.push(Math.max(0, Math.min(9999, body.itemOrder))); }
    if (body.prompt !== undefined) { if (typeof body.prompt !== "string" || body.prompt.trim().length < 2 || body.prompt.trim().length > 4000) return res.status(400).json({ error: "Item prompt must be between 2 and 4000 characters." }); updates.push("prompt = ?"); values.push(body.prompt.trim()); }
    if (body.responseType !== undefined) { if (!isResponseType(body.responseType)) return res.status(400).json({ error: "Unsupported response type." }); updates.push("response_type = ?"); values.push(body.responseType); }
    if (body.config !== undefined) { if (typeof body.config !== "object" || body.config === null || Array.isArray(body.config)) return res.status(400).json({ error: "Item configuration must be an object." }); updates.push("config_json = ?"); values.push(JSON.stringify(body.config)); }
    if (body.isRequired !== undefined) { if (typeof body.isRequired !== "boolean") return res.status(400).json({ error: "Required flag must be boolean." }); updates.push("is_required = ?"); values.push(body.isRequired); }
    if (!updates.length) return res.status(400).json({ error: "No instrument item changes were supplied." }); values.push(req.params.itemId);
    const [result] = await db.execute(`UPDATE research_instrument_items SET ${updates.join(", ")} WHERE id = ?`, values); if (!(result as any).affectedRows) return res.status(404).json({ error: "Instrument item not found." });
    await recordAdminAudit(session.user.id, "INSTRUMENT_ITEM_UPDATED", "research-instrument-item", req.params.itemId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.post("/api/admin/studies/:studyId/consent-documents", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { purpose?: unknown; version?: unknown; language?: unknown; title?: unknown; body?: unknown; status?: unknown; effectiveAt?: unknown };
    if (!isConsentPurpose(body.purpose) || typeof body.version !== "string" || !body.version.trim() || typeof body.language !== "string" || !["en", "es"].includes(body.language) || typeof body.title !== "string" || body.title.trim().length < 3 || typeof body.body !== "string" || body.body.trim().length < 20 || (body.status !== undefined && !isConsentStatus(body.status))) return res.status(400).json({ error: "Provide a valid purpose, version, English or Spanish language, title, consent text, and status." });
    const [studyRows] = await db.query<RowDataPacket[]>("SELECT id FROM studies WHERE id = ? LIMIT 1", [req.params.studyId]); if (!studyRows[0]) return res.status(404).json({ error: "Study not found." });
    const id = randomUUID(); const timestamp = now();
    try { await db.execute("INSERT INTO consent_documents (id, study_id, purpose, version, language, title, body, status, effective_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, req.params.studyId, body.purpose, body.version.trim(), body.language, body.title.trim(), body.body.trim().slice(0, 20000), isConsentStatus(body.status) ? body.status : "draft", typeof body.effectiveAt === "number" ? body.effectiveAt : null, session.user.id, timestamp]); await recordAdminAudit(session.user.id, "CONSENT_DOCUMENT_CREATED", "consent-document", id, { studyId: req.params.studyId, purpose: body.purpose, version: body.version.trim(), language: body.language }); res.status(201).json({ id }); } catch (error: any) { res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "That consent document version already exists for this study, purpose, and language." : "Unable to create the consent document." }); }
  });
  app.patch("/api/admin/consent-documents/:documentId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]); if (!session) return;
    const body = req.body as { title?: unknown; body?: unknown; status?: unknown; effectiveAt?: unknown };
    const updates: string[] = []; const values: Array<string | number | null> = [];
    if (body.title !== undefined) { if (typeof body.title !== "string" || body.title.trim().length < 3) return res.status(400).json({ error: "Consent title is required." }); updates.push("title = ?"); values.push(body.title.trim()); }
    if (body.body !== undefined) { if (typeof body.body !== "string" || body.body.trim().length < 20) return res.status(400).json({ error: "Consent text must be at least 20 characters." }); updates.push("body = ?"); values.push(body.body.trim().slice(0, 20000)); }
    if (body.status !== undefined) { if (!isConsentStatus(body.status)) return res.status(400).json({ error: "Unsupported consent status." }); updates.push("status = ?"); values.push(body.status); }
    if (body.effectiveAt !== undefined) { if (body.effectiveAt !== null && typeof body.effectiveAt !== "number") return res.status(400).json({ error: "Consent effective date must be a timestamp." }); updates.push("effective_at = ?"); values.push(body.effectiveAt as number | null); }
    if (!updates.length) return res.status(400).json({ error: "No consent document changes were supplied." }); values.push(req.params.documentId);
    const [result] = await db.execute(`UPDATE consent_documents SET ${updates.join(", ")} WHERE id = ?`, values); if (!(result as any).affectedRows) return res.status(404).json({ error: "Consent document not found." });
    await recordAdminAudit(session.user.id, "CONSENT_DOCUMENT_UPDATED", "consent-document", req.params.documentId, { fields: updates.map((field) => field.split(" ")[0]) }); res.json({ success: true });
  });
  app.get("/api/research/studies", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    const query = session.user.role === "admin" ? "" : "JOIN study_memberships m ON m.study_id = s.id AND m.user_id = ? AND m.is_active = TRUE";
    const params = session.user.role === "admin" ? [] : [session.user.id];
    const [rows] = await db.query<RowDataPacket[]>(`SELECT s.*, owner.display_name AS owner_name FROM studies s ${query} ORDER BY s.updated_at DESC`, params);
    res.json({ studies: rows.map(normalizeStudy) });
  });

  app.get("/api/research/studies/:studyId/participant-controls", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    if (!(await hasStudyAccess(session, req.params.studyId))) return res.status(403).json({ error: "You are not assigned to this study." });
    const [rows] = await db.query<RowDataPacket[]>(`SELECT p.id, p.pseudonym, p.enrollment_status, p.consented_at, p.withdrawn_at, p.retention_until, p.created_at, p.updated_at,
        c.case_number,
        (SELECT COUNT(*) FROM research_assessments a WHERE a.participant_control_id = p.id AND a.status = 'complete') AS assessment_count,
        (SELECT MAX(a.created_at) FROM research_assessments a WHERE a.participant_control_id = p.id AND a.status = 'complete') AS last_assessment_at
      FROM research_participant_controls p JOIN referral_cases c ON c.id = p.case_id
      WHERE p.study_id = ? ORDER BY p.updated_at DESC`, [req.params.studyId]);
    res.json({ participants: rows.map((row) => ({ id: row.id, pseudonym: row.pseudonym, enrollmentStatus: row.enrollment_status, caseNumber: row.case_number, consentedAt: Number(row.consented_at), withdrawnAt: row.withdrawn_at ? Number(row.withdrawn_at) : null, retentionUntil: row.retention_until ? Number(row.retention_until) : null, assessmentCount: Number(row.assessment_count || 0), lastAssessmentAt: row.last_assessment_at ? Number(row.last_assessment_at) : null, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) })) });
  });

  app.post("/api/research/studies/:studyId/participant-controls", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    if (!(await hasStudyAccess(session, req.params.studyId))) return res.status(403).json({ error: "You are not assigned to this study." });
    const body = req.body as { caseId?: unknown; retentionUntil?: unknown };
    if (typeof body.caseId !== "string") return res.status(400).json({ error: "Choose a case to enroll." });
    const [caseRows] = await db.query<RowDataPacket[]>("SELECT id, client_id FROM referral_cases WHERE id = ? AND study_id = ? LIMIT 1", [body.caseId, req.params.studyId]);
    if (!caseRows[0] || !caseRows[0].client_id) return res.status(404).json({ error: "A study-linked client case is required." });
    const [consentRows] = await db.query<RowDataPacket[]>("SELECT pc.id FROM participant_consents pc JOIN consent_documents d ON d.id = pc.consent_document_id WHERE pc.study_id = ? AND pc.participant_user_id = ? AND pc.decision = 'granted' AND pc.withdrawn_at IS NULL AND d.status = 'active' ORDER BY pc.decided_at DESC LIMIT 1", [req.params.studyId, caseRows[0].client_id]);
    if (!consentRows[0]) return res.status(409).json({ error: "Active research consent is required before enrollment." });
    const [existingRows] = await db.query<RowDataPacket[]>("SELECT id FROM research_participant_controls WHERE study_id = ? AND case_id = ? LIMIT 1", [req.params.studyId, body.caseId]);
    if (existingRows[0]) return res.status(409).json({ error: "This case is already enrolled in the study." });
    const timestamp = now(); const id = randomUUID(); const pseudonym = `STUDY-${randomBytes(4).toString("hex").toUpperCase()}`;
    const retentionUntil = typeof body.retentionUntil === "number" && Number.isFinite(body.retentionUntil) ? body.retentionUntil : null;
    await db.execute("INSERT INTO research_participant_controls (id, study_id, case_id, pseudonym, enrollment_status, consented_at, retention_until, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'enrolled', ?, ?, ?, ?, ?)", [id, req.params.studyId, body.caseId, pseudonym, timestamp, retentionUntil, session.user.id, timestamp, timestamp]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'RESEARCH_PARTICIPANT_ENROLLED', ?, ?, ?)", [randomUUID(), body.caseId, session.user.id, JSON.stringify({ studyId: req.params.studyId, pseudonym, retentionUntil }), "Participant enrolled using active consent; direct identifiers are excluded from the research record.", timestamp]);
    res.status(201).json({ id, pseudonym, enrollmentStatus: "enrolled", retentionUntil });
  });

  app.patch("/api/research/participant-controls/:controlId/retention", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    const body = req.body as { retentionUntil?: unknown };
    if (body.retentionUntil !== null && (typeof body.retentionUntil !== "number" || !Number.isFinite(body.retentionUntil))) return res.status(400).json({ error: "Retention date must be a timestamp or null." });
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, study_id, case_id FROM research_participant_controls WHERE id = ? LIMIT 1", [req.params.controlId]);
    if (!rows[0] || !(await hasStudyAccess(session, rows[0].study_id))) return res.status(404).json({ error: "Participant control not found." });
    const timestamp = now();
    await db.execute("UPDATE research_participant_controls SET retention_until = ?, updated_at = ? WHERE id = ?", [body.retentionUntil as number | null, timestamp, req.params.controlId]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'RESEARCH_RETENTION_UPDATED', ?, ?, ?)", [randomUUID(), rows[0].case_id, session.user.id, JSON.stringify({ retentionUntil: body.retentionUntil }), "Research retention control updated.", timestamp]);
    res.json({ success: true, retentionUntil: body.retentionUntil });
  });

  app.post("/api/research/participant-controls/:controlId/withdraw", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, study_id, case_id, enrollment_status FROM research_participant_controls WHERE id = ? LIMIT 1", [req.params.controlId]);
    if (!rows[0] || !(await hasStudyAccess(session, rows[0].study_id))) return res.status(404).json({ error: "Participant control not found." });
    const timestamp = now();
    await db.execute("UPDATE research_participant_controls SET enrollment_status = 'withdrawn', withdrawn_at = ?, updated_at = ? WHERE id = ?", [timestamp, timestamp, req.params.controlId]);
    await db.execute("UPDATE research_assessments SET status = 'withdrawn', withdrawn_at = ? WHERE participant_control_id = ? AND status = 'complete'", [timestamp, req.params.controlId]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'RESEARCH_PARTICIPANT_WITHDRAWN', ?, ?, ?)", [randomUUID(), rows[0].case_id, session.user.id, JSON.stringify({ participantControlId: req.params.controlId }), "Research participation withdrawn; assessment rows are excluded from active research views.", timestamp]);
    res.json({ success: true, enrollmentStatus: "withdrawn", withdrawnAt: timestamp });
  });

  app.get("/api/research/participant-controls/:controlId/assessments", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    const [controlRows] = await db.query<RowDataPacket[]>("SELECT id, study_id, pseudonym FROM research_participant_controls WHERE id = ? LIMIT 1", [req.params.controlId]);
    if (!controlRows[0] || !(await hasStudyAccess(session, controlRows[0].study_id))) return res.status(404).json({ error: "Participant control not found." });
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, instrument_key, instrument_version, response_json, score, status, created_at FROM research_assessments WHERE participant_control_id = ? ORDER BY created_at DESC", [req.params.controlId]);
    res.json({ pseudonym: controlRows[0].pseudonym, assessments: rows.map((row) => ({ id: row.id, instrumentKey: row.instrument_key, instrumentVersion: row.instrument_version, responses: parseJson<Record<string, unknown>>(row.response_json, {}), score: row.score === null ? null : Number(row.score), status: row.status, createdAt: Number(row.created_at) })) });
  });

  app.post("/api/research/participant-controls/:controlId/assessments", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    const body = req.body as { instrumentKey?: unknown; responses?: unknown; score?: unknown };
    const instrumentKey = body.instrumentKey === "phq9" || body.instrumentKey === "prapare" ? body.instrumentKey : "";
    if (!instrumentKey || !body.responses || typeof body.responses !== "object" || Array.isArray(body.responses)) return res.status(400).json({ error: "Choose PHQ-9 or PRAPARE and provide structured responses." });
    const [controlRows] = await db.query<RowDataPacket[]>("SELECT id, study_id, case_id, enrollment_status FROM research_participant_controls WHERE id = ? LIMIT 1", [req.params.controlId]);
    if (!controlRows[0] || !(await hasStudyAccess(session, controlRows[0].study_id))) return res.status(404).json({ error: "Participant control not found." });
    if (controlRows[0].enrollment_status !== "enrolled") return res.status(409).json({ error: "Withdrawn participants cannot receive new assessments." });
    const responses = body.responses as Record<string, unknown>;
    if (instrumentKey === "phq9") {
      const values = Array.from({ length: 9 }, (_, index) => responses[`q${index + 1}`]);
      if (values.some((value) => !Number.isInteger(value) || Number(value) < 0 || Number(value) > 3)) return res.status(400).json({ error: "PHQ-9 items must be integers from 0 through 3." });
    }
    const score = typeof body.score === "number" && Number.isFinite(body.score) ? body.score : instrumentKey === "phq9" ? Array.from({ length: 9 }, (_, index) => Number(responses[`q${index + 1}`])).reduce((sum, value) => sum + value, 0) : null;
    const timestamp = now(); const id = randomUUID();
    await db.execute("INSERT INTO research_assessments (id, study_id, case_id, participant_control_id, instrument_key, instrument_version, response_json, score, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?)", [id, controlRows[0].study_id, controlRows[0].case_id, req.params.controlId, instrumentKey, instrumentKey === "phq9" ? "2.0" : "1.0", JSON.stringify(responses), score, session.user.id, timestamp]);
    await db.execute("INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, 'RESEARCH_ASSESSMENT_RECORDED', ?, ?, ?)", [randomUUID(), controlRows[0].case_id, session.user.id, JSON.stringify({ participantControlId: req.params.controlId, instrumentKey, score, item9SafetyFlag: instrumentKey === "phq9" && Number(responses.q9) > 0 }), "Research assessment recorded without direct identifiers.", timestamp]);
    res.status(201).json({ id, instrumentKey, score, createdAt: timestamp });
  });

  app.get("/api/research/studies/:studyId/export.csv", async (req, res) => {
    const session = await requireRole(req, res, ["admin", "researcher"]); if (!session) return;
    if (!(await hasStudyAccess(session, req.params.studyId))) return res.status(403).json({ error: "You are not assigned to this study." });
    const [rows] = await db.query<RowDataPacket[]>(`SELECT p.pseudonym, p.enrollment_status, p.retention_until, a.instrument_key, a.instrument_version, a.score, a.status, a.created_at
      FROM research_participant_controls p LEFT JOIN research_assessments a ON a.participant_control_id = p.id AND a.status = 'complete'
      WHERE p.study_id = ? AND p.enrollment_status = 'enrolled' ORDER BY p.pseudonym, a.created_at`, [req.params.studyId]);
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csvRows = [["Study ID", "Enrollment Status", "Retention Until", "Instrument", "Instrument Version", "Score", "Assessment Status", "Recorded At"], ...rows.map((row) => [row.pseudonym, row.enrollment_status, row.retention_until ? new Date(Number(row.retention_until)).toISOString() : "", row.instrument_key, row.instrument_version, row.score, row.status, row.created_at ? new Date(Number(row.created_at)).toISOString() : ""])];
    await db.execute("INSERT INTO generated_reports (id, requested_by, report_type, filters_json, created_at) VALUES (?, ?, ?, ?, ?)", [randomUUID(), session.user.id, "research-deidentified-export", JSON.stringify({ studyId: req.params.studyId }), now()]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=zipshift-research-deidentified.csv"); res.send(csvRows.map((row) => row.map(escape).join(",")).join("\n"));
  });

  app.get("/api/profile/consents", async (req, res) => {
    const session = await requireRole(req, res, ["client"]); if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>(`SELECT d.*, u.display_name AS created_by_name, pc.decision, pc.decided_at, pc.withdrawn_at
      FROM consent_documents d JOIN studies s ON s.id = d.study_id LEFT JOIN app_users u ON u.id = d.created_by
      LEFT JOIN participant_consents pc ON pc.consent_document_id = d.id AND pc.participant_user_id = ?
        AND pc.id = (SELECT pc2.id FROM participant_consents pc2 WHERE pc2.consent_document_id = d.id AND pc2.participant_user_id = ? ORDER BY pc2.decided_at DESC, pc2.created_at DESC LIMIT 1)
      WHERE s.status = 'active' AND d.status = 'active' ORDER BY s.title, d.purpose, d.language, d.created_at DESC`, [session.user.id, session.user.id]);
    res.json({ consents: rows.map(normalizeConsentDocument) });
  });
  app.post("/api/profile/consents", async (req, res) => {
    const session = await requireRole(req, res, ["client"]); if (!session) return;
    const body = req.body as { documentId?: unknown; decision?: unknown };
    if (typeof body.documentId !== "string" || !isConsentDecision(body.decision)) return res.status(400).json({ error: "Choose a consent document and a valid decision." });
    const [documentRows] = await db.query<RowDataPacket[]>("SELECT d.id, d.study_id FROM consent_documents d JOIN studies s ON s.id = d.study_id WHERE d.id = ? AND d.status = 'active' AND s.status = 'active' LIMIT 1", [body.documentId]);
    if (!documentRows[0]) return res.status(404).json({ error: "That consent document is no longer active." });
    const timestamp = now();
    await db.execute("INSERT INTO participant_consents (id, study_id, consent_document_id, participant_user_id, decision, decided_at, withdrawn_at, source, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'profile', ?, ?)", [randomUUID(), documentRows[0].study_id, documentRows[0].id, session.user.id, body.decision, timestamp, body.decision === "withdrawn" ? timestamp : null, session.user.id, timestamp]);
    res.status(201).json({ success: true, decidedAt: timestamp });
  });

  app.get("/api/global-settings", async (_req, res) => {
    res.json({ settings: await readGlobalEditorSettings() });
  });

  app.get("/api/admin/global-settings", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const settings = await readGlobalEditorSettings();
    const [revisionRows] = await db.query<RowDataPacket[]>("SELECT r.id, r.setting_key, r.previous_value_json, r.next_value_json, r.created_at, u.display_name AS changed_by FROM admin_global_setting_revisions r LEFT JOIN app_users u ON u.id = r.changed_by ORDER BY r.created_at DESC LIMIT 40");
    res.json({
      settings,
      revisions: revisionRows.map((row) => ({ id: row.id, settingKey: row.setting_key, previousValue: parseJson(row.previous_value_json, null), nextValue: parseJson(row.next_value_json, null), changedBy: row.changed_by || "Administrator", createdAt: Number(row.created_at) })),
    });
  });

  app.patch("/api/admin/global-settings", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const requested = req.body?.settings as Partial<GlobalEditorSettings> | undefined;
    if (!requested || typeof requested !== "object") return res.status(400).json({ error: "Provide global settings to save." });
    const previous = await readGlobalEditorSettings();
    const next = normalizeGlobalEditorSettings({ ...previous, ...requested });
    const timestamp = now();
    for (const key of Object.keys(next) as Array<keyof GlobalEditorSettings>) {
      if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue;
      await db.execute(
        `INSERT INTO admin_global_setting_revisions (id, setting_key, previous_value_json, next_value_json, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), key, JSON.stringify(previous[key]), JSON.stringify(next[key]), session.user.id, timestamp]
      );
      await db.execute(
        `INSERT INTO admin_global_settings (setting_key, value_json, updated_by, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
        [key, JSON.stringify(next[key]), session.user.id, timestamp]
      );
    }
    await recordAdminAudit(session.user.id, "GLOBAL_SETTINGS_UPDATED", "global-settings", null, { changedKeys: (Object.keys(next) as Array<keyof GlobalEditorSettings>).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key])) });
    res.json({ settings: next });
  });

  app.post("/api/admin/global-settings/undo", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const key = req.body?.settingKey as keyof GlobalEditorSettings | undefined;
    const allowedKeys = Object.keys(DEFAULT_GLOBAL_EDITOR_SETTINGS) as Array<keyof GlobalEditorSettings>;
    if (!key || !allowedKeys.includes(key)) return res.status(400).json({ error: "Choose a valid global setting to undo." });
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, previous_value_json FROM admin_global_setting_revisions WHERE setting_key = ? ORDER BY created_at DESC LIMIT 1", [key]);
    if (!rows[0]) return res.status(404).json({ error: "There is no saved change to undo for this setting." });
    const previousValue = parseJson(rows[0].previous_value_json, DEFAULT_GLOBAL_EDITOR_SETTINGS[key]);
    const timestamp = now();
    await db.execute(
      `INSERT INTO admin_global_settings (setting_key, value_json, updated_by, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)`,
      [key, JSON.stringify(previousValue), session.user.id, timestamp]
    );
    await db.execute("DELETE FROM admin_global_setting_revisions WHERE id = ?", [rows[0].id]);
    await recordAdminAudit(session.user.id, "GLOBAL_SETTING_UNDONE", "global-setting", key, { revisionId: rows[0].id });
    res.json({ settings: await readGlobalEditorSettings() });
  });

  app.get("/api/admin/audit", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT a.id, a.action, a.target_type, a.target_id, a.details_json, a.created_at, u.display_name AS actor_name FROM admin_audit_log a LEFT JOIN app_users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 100");
    res.json({ entries: rows.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, details: parseJson(row.details_json, {}), createdAt: Number(row.created_at), actorName: row.actor_name || "Unknown administrator" })) });
  });

  app.get("/api/admin/pages", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const [rows] = await db.query<RowDataPacket[]>("SELECT id, slug, title, content_json, is_published, updated_by, created_at, updated_at FROM admin_pages ORDER BY updated_at DESC");
    res.json({ pages: rows.map((row) => ({ id: row.id, slug: row.slug, title: row.title, content: parseJson(row.content_json, {}), isPublished: Boolean(row.is_published), updatedBy: row.updated_by, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) })) });
  });

  app.get("/api/pages/:slug", async (req, res) => {
    const [rows] = await db.query<RowDataPacket[]>("SELECT slug, title, content_json, updated_at FROM admin_pages WHERE slug = ? AND is_published = TRUE LIMIT 1", [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ error: "Page not found." });
    res.json({ page: { slug: rows[0].slug, title: rows[0].title, content: parseJson(rows[0].content_json, {}), updatedAt: Number(rows[0].updated_at) } });
  });

  app.post("/api/admin/pages", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const { slug, title, content, isPublished = true } = req.body as { slug?: string; title?: string; content?: Record<string, unknown>; isPublished?: boolean };
    const safeSlug = (slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!safeSlug || !title?.trim() || !content || typeof content !== "object") return res.status(400).json({ error: "Provide a page slug, title, and content object." });
    const timestamp = now();
    try {
      const id = randomUUID();
      await db.execute("INSERT INTO admin_pages (id, slug, title, content_json, is_published, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [id, safeSlug, title.trim(), JSON.stringify(content), Boolean(isPublished), session.user.id, timestamp, timestamp]);
      await recordAdminAudit(session.user.id, "PAGE_CREATED", "page", id, { slug: safeSlug });
      res.status(201).json({ id, slug: safeSlug });
    } catch (error: any) {
      res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "A page with that slug already exists." : "Unable to create the page." });
    }
  });

  app.patch("/api/admin/pages/:pageId", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const { title, content, isPublished } = req.body as { title?: string; content?: Record<string, unknown>; isPublished?: boolean };
    if (!title?.trim() || !content || typeof content !== "object") return res.status(400).json({ error: "Provide a page title and content object." });
    const timestamp = now();
    const [result] = await db.execute("UPDATE admin_pages SET title = ?, content_json = ?, is_published = ?, updated_by = ?, updated_at = ? WHERE id = ?", [title.trim(), JSON.stringify(content), Boolean(isPublished), session.user.id, timestamp, req.params.pageId]);
    if (!(result as any).affectedRows) return res.status(404).json({ error: "Page not found." });
    await recordAdminAudit(session.user.id, "PAGE_UPDATED", "page", req.params.pageId, { isPublished: Boolean(isPublished) });
    res.json({ success: true });
  });

  app.post("/api/staff/users", async (req, res) => {
    const session = await requireRole(req, res, ["admin"]);
    if (!session) return;
    const { email, password, displayName, role, specialistRole } = req.body as { email?: string; password?: string; displayName?: string; role?: Role; specialistRole?: SpecialistRole | null };
    if (!email || !displayName || !password || password.length < 12 || !["admin", "researcher"].includes(role || "")) {
      return res.status(400).json({ error: "Provide a name, email, 12-character password, and a staff role." });
    }
    if (specialistRole !== undefined && specialistRole !== null && !isSpecialistRole(specialistRole)) return res.status(400).json({ error: "Unsupported specialist assignment." });
    const staffRole = role as "admin" | "researcher";
    const timestamp = now();
    try {
      await db.execute(
        "INSERT INTO app_users (id, email, display_name, password_hash, role, specialist_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), email.trim().toLowerCase(), displayName.trim(), hashPassword(password), staffRole, specialistRole || null, timestamp, timestamp]
      );
      res.status(201).json({ success: true });
    } catch (error: any) {
      res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "An account with that email already exists." : "Unable to create the staff account." });
    }
  });

  app.post("/api/events", async (req, res) => {
    const session = await getSession(req);
    const { caseId, eventType, eventData, note } = req.body as { caseId?: string; eventType?: string; eventData?: Record<string, unknown>; note?: string };
    if (!caseId || !eventType) return res.status(400).json({ error: "caseId and eventType are required." });
    await db.execute(
      "INSERT INTO case_events (id, case_id, actor_user_id, event_type, event_data_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [randomUUID(), caseId, session?.user.id || null, eventType, JSON.stringify(eventData || {}), note || null, now()]
    );
    res.status(201).json({ success: true });
  });

  const staticPath = process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(__dirname, "..", "dist", "public");
  app.use(express.static(staticPath));
  app.get("*", (_req, res) => res.sendFile(path.join(staticPath, "index.html")));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  });

  return app;
}

export async function startServer() {
  const app = await createZipShiftApp();
  const server = createServer(app);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`ZipShift API server listening on port ${port}`));
  return server;
}

if (process.env.VITEST !== "true") {
  startServer().catch((error) => {
    console.error("Unable to start ZipShift API server", error);
    process.exitCode = 1;
  });
}
