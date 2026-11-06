/**
 * Access-outcome and housing-status vocabulary shared by the client, the API
 * and the de-identified research reports.
 *
 * Research question this supports: do people experiencing homelessness actually
 * reach the services they are referred to, how long does it take, and what
 * blocks them? Housing status is treated as a social determinant of health
 * (SDOH) exposure; the referral outcome and its barriers are the access outcome.
 */

// ── Housing status (HUD-aligned categories) ────────────────────────────────
// Mapped to HUD homeless definitions: unsheltered and emergency shelter are
// Category 1 literal homelessness; transitional housing is Category 1 when
// entered from homelessness; doubled-up and at-risk follow the McKinney-Vento /
// HUD "at risk" framing. "prefer_not_to_say" is always a valid answer.
export const HOUSING_STATUSES = [
  "unsheltered",
  "emergency_shelter",
  "transitional_housing",
  "doubled_up",
  "at_risk",
  "housed",
  "prefer_not_to_say",
] as const;
export type HousingStatus = (typeof HOUSING_STATUSES)[number];

export const HOUSING_STATUS_LABELS: Record<HousingStatus, { en: string; es: string; hint: { en: string; es: string } }> = {
  unsheltered: { en: "Sleeping outside or in a car", es: "Duermo afuera o en un carro", hint: { en: "Street, park, vehicle, or another place not meant for sleeping", es: "Calle, parque, vehículo u otro lugar no hecho para dormir" } },
  emergency_shelter: { en: "In a shelter", es: "En un refugio", hint: { en: "Emergency shelter, warming center, or motel voucher", es: "Refugio de emergencia, centro de calentamiento o vale de motel" } },
  transitional_housing: { en: "In transitional housing", es: "En vivienda de transición", hint: { en: "Time-limited program housing", es: "Vivienda de un programa por tiempo limitado" } },
  doubled_up: { en: "Staying with friends or family", es: "Me quedo con amigos o familia", hint: { en: "Temporarily, because you have nowhere else", es: "Temporalmente, porque no tiene otro lugar" } },
  at_risk: { en: "Housed, but may lose it soon", es: "Tengo vivienda, pero puedo perderla pronto", hint: { en: "Eviction notice, can't pay rent, or unsafe", es: "Aviso de desalojo, no puede pagar la renta o es inseguro" } },
  housed: { en: "Stable housing", es: "Vivienda estable", hint: { en: "Your own place or a stable lease", es: "Su propio lugar o un contrato estable" } },
  prefer_not_to_say: { en: "Prefer not to say", es: "Prefiero no decir", hint: { en: "You can still get help", es: "Aún puede recibir ayuda" } },
};

/** Statuses that count as experiencing homelessness for the research comparison. */
export const HOMELESS_HOUSING_STATUSES: readonly HousingStatus[] = ["unsheltered", "emergency_shelter", "transitional_housing", "doubled_up"];

export function isHousingStatus(value: unknown): value is HousingStatus {
  return typeof value === "string" && (HOUSING_STATUSES as readonly string[]).includes(value);
}

/** Maps older free-text intake values onto the HUD-aligned vocabulary. */
const LEGACY_HOUSING_MAP: Record<string, HousingStatus> = {
  homeless: "unsheltered",
  "at-risk": "at_risk",
  unstable: "doubled_up",
  housed: "housed",
};

/**
 * Returns the housing status to store, or null. Housing status is SDOH data and
 * is only kept when the person agreed to it being used to improve services.
 */
export function normalizeHousingStatus(value: unknown, sdohConsent: unknown): HousingStatus | null {
  if (sdohConsent !== true) return null;
  if (isHousingStatus(value)) return value;
  if (typeof value === "string" && LEGACY_HOUSING_MAP[value]) return LEGACY_HOUSING_MAP[value];
  return null;
}

// ── Contact preference (reachability is itself an access barrier) ───────────
export const CONTACT_PREFERENCES = ["call", "text", "shared_phone_no_details", "case_manager", "check_back_with_code"] as const;
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number];
export const CONTACT_PREFERENCE_LABELS: Record<ContactPreference, { en: string; es: string }> = {
  call: { en: "Call me", es: "Llámenme" },
  text: { en: "Text me", es: "Envíenme un mensaje de texto" },
  shared_phone_no_details: { en: "Shared phone — don't leave details", es: "Teléfono compartido — no dejen detalles" },
  case_manager: { en: "Through my case manager or shelter staff", es: "Por medio de mi administrador de caso o personal del refugio" },
  check_back_with_code: { en: "No phone — I'll check back with my referral code", es: "Sin teléfono — volveré a revisar con mi código" },
};
export function isContactPreference(value: unknown): value is ContactPreference {
  return typeof value === "string" && (CONTACT_PREFERENCES as readonly string[]).includes(value);
}
/** Preferences where a phone number is optional or must not be used for details. */
export function contactNeedsPhone(preference: ContactPreference | null) {
  return preference === "call" || preference === "text" || preference === "shared_phone_no_details";
}

// ── Access outcome (closed-loop referral) ──────────────────────────────────
export const ACCESS_OUTCOMES = ["connected", "not_connected", "lost_contact"] as const;
export type AccessOutcome = (typeof ACCESS_OUTCOMES)[number];
export const ACCESS_OUTCOME_LABELS: Record<AccessOutcome, string> = {
  connected: "Connected — received the service",
  not_connected: "Not connected — did not receive the service",
  lost_contact: "Lost contact — outcome unknown",
};
export function isAccessOutcome(value: unknown): value is AccessOutcome {
  return typeof value === "string" && (ACCESS_OUTCOMES as readonly string[]).includes(value);
}

export const ACCESS_BARRIERS = [
  "no_transport",
  "no_id",
  "no_phone",
  "no_address",
  "hours",
  "eligibility",
  "waitlist",
  "cost",
  "documentation",
  "safety",
  "stigma",
  "language",
  "other",
] as const;
export type AccessBarrier = (typeof ACCESS_BARRIERS)[number];
export const ACCESS_BARRIER_LABELS: Record<AccessBarrier, { en: string; es: string }> = {
  no_transport: { en: "No way to get there", es: "No hay cómo llegar" },
  no_id: { en: "No ID", es: "Sin identificación" },
  no_phone: { en: "No phone / couldn't be reached", es: "Sin teléfono / no se pudo contactar" },
  no_address: { en: "No mailing address", es: "Sin dirección postal" },
  hours: { en: "Closed or hours didn't work", es: "Cerrado o el horario no funcionó" },
  eligibility: { en: "Not eligible", es: "No cumple requisitos" },
  waitlist: { en: "Waitlist or full", es: "Lista de espera o lleno" },
  cost: { en: "Cost", es: "Costo" },
  documentation: { en: "Other paperwork needed", es: "Se necesitaban otros documentos" },
  safety: { en: "Didn't feel safe", es: "No se sintió seguro" },
  stigma: { en: "Felt judged or unwelcome", es: "Se sintió juzgado o no bienvenido" },
  language: { en: "Language", es: "Idioma" },
  other: { en: "Other", es: "Otro" },
};
export function isAccessBarrier(value: unknown): value is AccessBarrier {
  return typeof value === "string" && (ACCESS_BARRIERS as readonly string[]).includes(value);
}

export type OutcomeSource = "staff" | "client";

export type AccessOutcomeInput = {
  outcome: AccessOutcome;
  barriers: AccessBarrier[];
  connectedAt: number | null;
};

/**
 * Validates a recorded outcome. "Not connected" must name at least one barrier
 * so the barrier data is never silently empty; "connected" may still list the
 * barriers that were overcome. The connection time cannot precede the referral
 * or be in the future.
 */
export function validateAccessOutcome(
  input: unknown,
  context: { caseCreatedAt: number; now: number },
): { ok: true; value: AccessOutcomeInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Choose an access outcome." };
  const raw = input as Record<string, unknown>;
  if (!isAccessOutcome(raw.outcome)) return { ok: false, error: "Choose connected, not connected, or lost contact." };
  const barriers = Array.isArray(raw.barriers)
    ? Array.from(new Set(raw.barriers.filter(isAccessBarrier)))
    : [];
  if (raw.outcome === "not_connected" && barriers.length === 0) {
    return { ok: false, error: "Select at least one barrier when the person was not connected." };
  }
  let connectedAt: number | null = null;
  if (raw.outcome === "connected") {
    const value = raw.connectedAt === undefined || raw.connectedAt === null || raw.connectedAt === "" ? context.now : Number(raw.connectedAt);
    if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid connection date." };
    if (value < context.caseCreatedAt) return { ok: false, error: "The connection date cannot be before the referral was made." };
    if (value > context.now + 60_000) return { ok: false, error: "The connection date cannot be in the future." };
    connectedAt = Math.round(value);
  }
  return { ok: true, value: { outcome: raw.outcome, barriers, connectedAt } };
}

// ── Follow-up nudges ───────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
export const OPEN_CASE_STATUSES = ["new", "in_progress", "pending"] as const;
/** Days without activity before an open referral needs follow-up, by priority. */
export const FOLLOW_UP_THRESHOLD_DAYS: Record<string, number> = { urgent: 1, high: 2, standard: 3, low: 7 };

export function referralFollowUpState(record: { status: string; priority: string; updatedAt: number; createdAt: number }, now: number) {
  const open = (OPEN_CASE_STATUSES as readonly string[]).includes(record.status);
  const lastActivity = Math.max(record.updatedAt || 0, record.createdAt || 0);
  const idleDays = Math.max(0, Math.floor((now - lastActivity) / DAY_MS));
  const threshold = FOLLOW_UP_THRESHOLD_DAYS[record.priority] ?? FOLLOW_UP_THRESHOLD_DAYS.standard;
  return { open, idleDays, threshold, stale: open && idleDays >= threshold };
}

// ── De-identified aggregate report ─────────────────────────────────────────
/** Cells with fewer than this many people are suppressed (CMS cell-size rule). */
export const MIN_CELL_SIZE = 11;

export type OutcomeReportRow = {
  housingStatus: HousingStatus | null;
  outcome: AccessOutcome | null; // null = referral still has no recorded outcome
  barriers: AccessBarrier[];
  createdAt: number;
  connectedAt: number | null;
};

export type SuppressedCount = { value: number | null; suppressed: boolean };

export type HousingGroupReport = {
  housingStatus: HousingStatus | "not_recorded";
  referrals: SuppressedCount;
  connected: SuppressedCount;
  notConnected: SuppressedCount;
  lostContact: SuppressedCount;
  noOutcomeYet: SuppressedCount;
  connectionRate: number | null; // percent of referrals with a recorded outcome
  medianDaysToConnection: number | null;
  barriers: Array<{ barrier: AccessBarrier; count: SuppressedCount }>;
};

export type AccessOutcomeReport = {
  minimumCellSize: number;
  groups: HousingGroupReport[];
  homelessVsHoused: {
    experiencingHomelessness: { referrals: SuppressedCount; connectionRate: number | null; medianDaysToConnection: number | null };
    housedOrAtRisk: { referrals: SuppressedCount; connectionRate: number | null; medianDaysToConnection: number | null };
  };
  totals: { referrals: SuppressedCount; withOutcome: SuppressedCount };
};

function cell(value: number, min: number): SuppressedCount {
  return value > 0 && value < min ? { value: null, suppressed: true } : { value, suppressed: false };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(rows: OutcomeReportRow[], min: number) {
  const withOutcome = rows.filter((row) => row.outcome !== null);
  const connected = rows.filter((row) => row.outcome === "connected");
  const days = connected
    .filter((row) => row.connectedAt !== null && row.connectedAt >= row.createdAt)
    .map((row) => ((row.connectedAt as number) - row.createdAt) / DAY_MS);
  // A rate or median is only shown when both its denominator and numerator
  // clear the cell-size threshold; otherwise it could reveal a small cell.
  const rateVisible = withOutcome.length >= min && (connected.length === 0 || connected.length >= min) && (withOutcome.length - connected.length === 0 || withOutcome.length - connected.length >= min);
  return {
    referrals: cell(rows.length, min),
    connectionRate: rateVisible ? Math.round((connected.length / withOutcome.length) * 1000) / 10 : null,
    medianDaysToConnection: days.length >= min ? Math.round((median(days) as number) * 10) / 10 : null,
  };
}

/**
 * Applies complementary suppression to a set of cells that sum to a visible
 * total: if exactly one cell is suppressed, the next-smallest non-zero cell is
 * also suppressed so the hidden value cannot be recovered by subtraction.
 */
function complementarySuppress(cells: SuppressedCount[], totalVisible: boolean) {
  if (!totalVisible) return;
  const suppressed = cells.filter((item) => item.suppressed).length;
  if (suppressed !== 1) return;
  const candidate = cells
    .filter((item) => !item.suppressed && (item.value ?? 0) > 0)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  if (candidate) { candidate.value = null; candidate.suppressed = true; }
}

/** Builds the de-identified, small-cell-suppressed access outcome report. */
export function buildAccessOutcomeReport(rows: OutcomeReportRow[], minimumCellSize = MIN_CELL_SIZE): AccessOutcomeReport {
  const min = Math.max(1, Math.floor(minimumCellSize));
  const keys: Array<HousingStatus | "not_recorded"> = [...HOUSING_STATUSES, "not_recorded"];
  const groups: HousingGroupReport[] = keys.map((key) => {
    const groupRows = rows.filter((row) => (row.housingStatus ?? "not_recorded") === key);
    const counts = {
      connected: groupRows.filter((row) => row.outcome === "connected").length,
      notConnected: groupRows.filter((row) => row.outcome === "not_connected").length,
      lostContact: groupRows.filter((row) => row.outcome === "lost_contact").length,
      noOutcomeYet: groupRows.filter((row) => row.outcome === null).length,
    };
    const summary = summarize(groupRows, min);
    const outcomeCells = {
      connected: cell(counts.connected, min),
      notConnected: cell(counts.notConnected, min),
      lostContact: cell(counts.lostContact, min),
      noOutcomeYet: cell(counts.noOutcomeYet, min),
    };
    complementarySuppress(Object.values(outcomeCells), !summary.referrals.suppressed);
    const barrierCounts = ACCESS_BARRIERS.map((barrier) => ({
      barrier,
      count: cell(groupRows.filter((row) => row.outcome !== null && row.barriers.includes(barrier)).length, min),
    }));
    return { housingStatus: key, referrals: summary.referrals, ...outcomeCells, connectionRate: summary.connectionRate, medianDaysToConnection: summary.medianDaysToConnection, barriers: barrierCounts };
  });
  // Complementary suppression across the housing groups as well, so a single
  // suppressed group cannot be recovered from the overall total.
  complementarySuppress(groups.map((group) => group.referrals), rows.length >= min);

  const homeless = rows.filter((row) => row.housingStatus !== null && HOMELESS_HOUSING_STATUSES.includes(row.housingStatus));
  const housed = rows.filter((row) => row.housingStatus === "housed" || row.housingStatus === "at_risk");
  return {
    minimumCellSize: min,
    groups,
    homelessVsHoused: { experiencingHomelessness: summarize(homeless, min), housedOrAtRisk: summarize(housed, min) },
    totals: { referrals: cell(rows.length, min), withOutcome: cell(rows.filter((row) => row.outcome !== null).length, min) },
  };
}

/** CSV of aggregate cells only. There is no individual-level row in this file. */
export function accessOutcomeReportToCsv(report: AccessOutcomeReport) {
  const show = (item: SuppressedCount) => (item.suppressed ? `<${report.minimumCellSize}` : String(item.value ?? 0));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines: unknown[][] = [
    ["section", "housing_status", "measure", "value"],
  ];
  for (const group of report.groups) {
    lines.push(["outcomes", group.housingStatus, "referrals", show(group.referrals)]);
    lines.push(["outcomes", group.housingStatus, "connected", show(group.connected)]);
    lines.push(["outcomes", group.housingStatus, "not_connected", show(group.notConnected)]);
    lines.push(["outcomes", group.housingStatus, "lost_contact", show(group.lostContact)]);
    lines.push(["outcomes", group.housingStatus, "no_outcome_yet", show(group.noOutcomeYet)]);
    lines.push(["outcomes", group.housingStatus, "connection_rate_pct", group.connectionRate ?? "suppressed"]);
    lines.push(["outcomes", group.housingStatus, "median_days_to_connection", group.medianDaysToConnection ?? "suppressed"]);
    for (const barrier of group.barriers) lines.push(["barriers", group.housingStatus, barrier.barrier, show(barrier.count)]);
  }
  const compare = report.homelessVsHoused;
  lines.push(["comparison", "experiencing_homelessness", "referrals", show(compare.experiencingHomelessness.referrals)]);
  lines.push(["comparison", "experiencing_homelessness", "connection_rate_pct", compare.experiencingHomelessness.connectionRate ?? "suppressed"]);
  lines.push(["comparison", "experiencing_homelessness", "median_days_to_connection", compare.experiencingHomelessness.medianDaysToConnection ?? "suppressed"]);
  lines.push(["comparison", "housed_or_at_risk", "referrals", show(compare.housedOrAtRisk.referrals)]);
  lines.push(["comparison", "housed_or_at_risk", "connection_rate_pct", compare.housedOrAtRisk.connectionRate ?? "suppressed"]);
  lines.push(["comparison", "housed_or_at_risk", "median_days_to_connection", compare.housedOrAtRisk.medianDaysToConnection ?? "suppressed"]);
  lines.push(["totals", "all", "referrals", show(report.totals.referrals)]);
  lines.push(["totals", "all", "with_outcome", show(report.totals.withOutcome)]);
  return lines.map((line) => line.map(escape).join(",")).join("\n");
}
