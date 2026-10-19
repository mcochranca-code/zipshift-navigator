export const CASE_STATUSES = ["new", "in_progress", "pending", "completed", "denied", "closed"] as const;
export const CASE_PRIORITIES = ["low", "standard", "high", "urgent"] as const;

export function hasWorkspaceAccess(role: string, allowedRoles: readonly string[]) {
  return allowedRoles.includes(role);
}

export function isCaseStatus(value: unknown): value is (typeof CASE_STATUSES)[number] {
  return typeof value === "string" && (CASE_STATUSES as readonly string[]).includes(value);
}

export function isCasePriority(value: unknown): value is (typeof CASE_PRIORITIES)[number] {
  return typeof value === "string" && (CASE_PRIORITIES as readonly string[]).includes(value);
}

export function normalizeClientProfile(input: { displayName?: unknown; phone?: unknown; city?: unknown; language?: unknown; accessibility?: unknown }, currentName: string) {
  return {
    displayName: typeof input.displayName === "string" && input.displayName.trim() ? input.displayName.trim() : currentName,
    phone: typeof input.phone === "string" ? input.phone : null,
    city: typeof input.city === "string" ? input.city : null,
    language: input.language === "es" ? "es" : "en",
    accessibility: Array.isArray(input.accessibility) ? input.accessibility.filter((item): item is string => typeof item === "string") : [],
  };
}

export function createCaseCsv(rows: Array<Record<string, unknown>>) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Case Number", "Client", "Service Category", "Status", "Priority", "Assigned To", "Created At", "Updated At"],
    ...rows.map((row) => [row.caseNumber, row.clientName, row.serviceCategory, row.status, row.priority, row.assignedName, row.createdAt, row.updatedAt]),
  ].map((row) => row.map(escape).join(",")).join("\n");
}
