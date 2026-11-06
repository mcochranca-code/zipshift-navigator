export const CASE_STATUSES = ["new", "in_progress", "pending", "completed", "denied", "closed"] as const;
export const CASE_PRIORITIES = ["low", "standard", "high", "urgent"] as const;

/** Checks whether a role belongs to the supplied workspace allowlist. */
export function hasWorkspaceAccess(role: string, allowedRoles: readonly string[]) {
  return allowedRoles.includes(role);
}

/** Narrows an unknown value to a supported case status. */
export function isCaseStatus(value: unknown): value is (typeof CASE_STATUSES)[number] {
  return typeof value === "string" && (CASE_STATUSES as readonly string[]).includes(value);
}

/** Narrows an unknown value to a supported case priority. */
export function isCasePriority(value: unknown): value is (typeof CASE_PRIORITIES)[number] {
  return typeof value === "string" && (CASE_PRIORITIES as readonly string[]).includes(value);
}

/** Normalizes optional profile updates while preserving the existing display name. */
export function normalizeClientProfile(input: { displayName?: unknown; phone?: unknown; city?: unknown; language?: unknown; accessibility?: unknown }, currentName: string) {
  return {
    displayName: typeof input.displayName === "string" && input.displayName.trim() ? input.displayName.trim() : currentName,
    phone: typeof input.phone === "string" ? input.phone : null,
    city: typeof input.city === "string" ? input.city : null,
    language: input.language === "es" ? "es" : "en",
    accessibility: Array.isArray(input.accessibility) ? input.accessibility.filter((item): item is string => typeof item === "string") : [],
  };
}

/** Serializes case records as escaped CSV with the standard report columns. */
export function createCaseCsv(rows: Array<Record<string, unknown>>) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Case Number", "Client", "Service Category", "Status", "Priority", "Assigned To", "Created At", "Updated At"],
    ...rows.map((row) => [row.caseNumber, row.clientName, row.serviceCategory, row.status, row.priority, row.assignedName, row.createdAt, row.updatedAt]),
  ].map((row) => row.map(escape).join(",")).join("\n");
}

/**
 * Who may record access outcomes or edit housing status on a referral:
 * administrators and care-team members (staff accounts with a specialist
 * role). Researchers without a care-team role read de-identified aggregates
 * only and cannot write to individual referrals.
 */
export function canRecordAccessOutcome(user: { role: string; specialistRole?: string | null }) {
  return user.role === "admin" || (user.role === "researcher" && Boolean(user.specialistRole));
}
