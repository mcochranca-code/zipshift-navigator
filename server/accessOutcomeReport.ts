import { isAccessBarrier, isAccessOutcome, isHousingStatus, type OutcomeReportRow } from "../shared/accessOutcomes";

export type CaseOutcomeSourceRow = {
  case_id: string;
  created_at: number | string;
  housing_status: string | null;
  sdoh_consent: number | boolean | null;
};

export type OutcomeLedgerSourceRow = {
  case_id: string;
  outcome: string;
  barriers_json: unknown;
  housing_status_snapshot: string | null;
  connected_at: number | string | null;
  created_at: number | string;
};

function parseBarriers(value: unknown) {
  let parsed: unknown = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { parsed = []; } }
  return Array.isArray(parsed) ? Array.from(new Set(parsed.filter(isAccessBarrier))) : [];
}

/**
 * Turns referral rows plus the outcome ledger into report rows: one row per
 * referral, using its most recent outcome. Housing status is only used when
 * the person consented; the outcome-time snapshot wins over the current value
 * so later housing changes do not rewrite what was true at follow-up.
 * The returned rows carry no identifiers.
 */
export function toOutcomeReportRows(cases: CaseOutcomeSourceRow[], ledger: OutcomeLedgerSourceRow[]): OutcomeReportRow[] {
  const latest = new Map<string, OutcomeLedgerSourceRow>();
  for (const entry of ledger) {
    const current = latest.get(entry.case_id);
    if (!current || Number(entry.created_at) >= Number(current.created_at)) latest.set(entry.case_id, entry);
  }
  return cases.map((record) => {
    const consented = record.sdoh_consent === true || record.sdoh_consent === 1;
    const entry = latest.get(record.case_id);
    const snapshot = entry?.housing_status_snapshot;
    const housing = consented ? (isHousingStatus(snapshot) ? snapshot : isHousingStatus(record.housing_status) ? record.housing_status : null) : null;
    const outcome = entry && isAccessOutcome(entry.outcome) ? entry.outcome : null;
    return {
      housingStatus: housing,
      outcome,
      barriers: entry ? parseBarriers(entry.barriers_json) : [],
      createdAt: Number(record.created_at),
      connectedAt: outcome === "connected" && entry?.connected_at !== null && entry?.connected_at !== undefined ? Number(entry.connected_at) : null,
    };
  });
}
