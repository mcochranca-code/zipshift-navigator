export const AOR_OUTCOMES = ["access-achieved", "partial-access", "alternative-provided", "no-access"] as const;
export type AorOutcome = (typeof AOR_OUTCOMES)[number];

export const AOR_FAILURE_REASONS = ["documents", "hours", "transit", "language", "capacity", "wrong-information", "provider-unreachable", "other"] as const;
export type AorFailureReason = (typeof AOR_FAILURE_REASONS)[number];

export const AOR_DOCUMENT_BURDENS = ["none", "light", "high"] as const;
export type AorDocumentBurden = (typeof AOR_DOCUMENT_BURDENS)[number];

export const AOR_TRANSIT_FEASIBILITY = ["feasible", "limited", "not-assessed"] as const;
export type AorTransitFeasibility = (typeof AOR_TRANSIT_FEASIBILITY)[number];

export const AOR_NEXT_ACTIONS = ["close-loop", "follow-up", "offer-alternative", "re-refer"] as const;
export type AorNextAction = (typeof AOR_NEXT_ACTIONS)[number];

export type AorHandoff = {
  outcome: AorOutcome;
  failureReason: AorFailureReason | "";
  documentBurden: AorDocumentBurden;
  requestedDocuments: string[];
  transitFeasibility: AorTransitFeasibility;
  nextAction: AorNextAction;
  referralEligible: boolean;
  reviewConfirmed: boolean;
};

const LEGACY_OUTCOME_MAP: Record<string, AorOutcome> = {
  confirmed: "access-achieved",
  "needs-review": "partial-access",
  "not-reached": "no-access",
  "service-unavailable": "no-access",
};

export function isAorOutcome(value: unknown): value is AorOutcome {
  return typeof value === "string" && (AOR_OUTCOMES as readonly string[]).includes(value);
}

export function normalizeAorHandoff(input: unknown): AorHandoff | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const rawOutcome = typeof value.outcome === "string" ? value.outcome : "";
  const outcome = (isAorOutcome(rawOutcome) ? rawOutcome : LEGACY_OUTCOME_MAP[rawOutcome]) as AorOutcome | undefined;
  if (!outcome) return null;

  const failureReason = typeof value.failureReason === "string" && (AOR_FAILURE_REASONS as readonly string[]).includes(value.failureReason)
    ? value.failureReason as AorFailureReason
    : "";
  const requestedDocuments = Array.isArray(value.requestedDocuments)
    ? value.requestedDocuments.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 12)
    : [];
  const documentBurden = typeof value.documentBurden === "string" && (AOR_DOCUMENT_BURDENS as readonly string[]).includes(value.documentBurden)
    ? value.documentBurden as AorDocumentBurden
    : "none";
  const transitFeasibility = typeof value.transitFeasibility === "string" && (AOR_TRANSIT_FEASIBILITY as readonly string[]).includes(value.transitFeasibility)
    ? value.transitFeasibility as AorTransitFeasibility
    : "not-assessed";
  const nextAction = typeof value.nextAction === "string" && (AOR_NEXT_ACTIONS as readonly string[]).includes(value.nextAction)
    ? value.nextAction as AorNextAction
    : outcome === "access-achieved" ? "close-loop" : outcome === "alternative-provided" ? "offer-alternative" : "follow-up";

  return {
    outcome,
    failureReason,
    documentBurden,
    requestedDocuments,
    transitFeasibility,
    nextAction,
    referralEligible: typeof value.referralEligible === "boolean" ? Boolean(value.referralEligible) : outcome !== "access-achieved",
    reviewConfirmed: value.reviewConfirmed === true,
  };
}

export function validateAorHandoff(input: unknown): { ok: true; handoff: AorHandoff } | { ok: false; error: string } {
  const handoff = normalizeAorHandoff(input);
  if (!handoff) return { ok: false, error: "Choose a valid AOR access outcome." };
  if ((handoff.outcome === "partial-access" || handoff.outcome === "no-access") && !handoff.failureReason) {
    return { ok: false, error: "Select a reason for partial or no access." };
  }
  if (handoff.outcome === "alternative-provided" && handoff.nextAction !== "offer-alternative") {
    return { ok: false, error: "Choose the alternative-resource follow-up action." };
  }
  if (!handoff.reviewConfirmed) return { ok: false, error: "Confirm that the AOR outcome and follow-up fields were reviewed." };
  return { ok: true, handoff };
}

export function aorOutcomeLabel(outcome: AorOutcome) {
  return {
    "access-achieved": "Access achieved",
    "partial-access": "Partial access",
    "alternative-provided": "Alternative provided",
    "no-access": "No access",
  }[outcome];
}
