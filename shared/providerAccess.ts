/**
 * Honest, data-backed access facts for a provider listing. Everything here is
 * derived from fields in the provider record; when the record does not say,
 * the answer is "unknown" so the UI tells people to call rather than guessing.
 */

export type ProviderAccessFields = {
  hours?: string | null;
  walk_in_allowed?: string | null;
  documents_required?: string[] | null;
  document_alternatives?: string[] | null;
  verification_status?: string | null;
};

export type HoursState = "open" | "closed" | "unknown";

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function parseClock(text: string): number | null {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3] === "pm") hour += 12;
  return hour * 60 + Number(match[2] || 0);
}

function formatClock(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${suffix}`;
}

/**
 * Parses the simple, unambiguous schedule forms found in the directory
 * ("24/7", "Mon-Fri 8am-5pm", "Mon-Fri 9am-12:30pm and 1pm-4pm"). Anything
 * that mentions variation, verification, or calling is treated as unknown.
 */
export function parseWeeklyHours(hours: string | null | undefined): { always: true } | { days: number[]; ranges: Array<[number, number]> } | null {
  const text = (hours || "").toLowerCase();
  if (!text.trim()) return null;
  if (/\b(var(y|ies)|verify|call|confirm|must be verified|cutoffs?)\b/.test(text)) {
    return /^\s*(24\/7|24 hours|open 24 hours)\s*$/.test(text) ? { always: true } : null;
  }
  if (/24\/7|24 hours/.test(text)) return { always: true };
  const dayMatch = text.match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\s*[-–]\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/);
  if (!dayMatch) return null;
  const start = DAY_INDEX[dayMatch[1]];
  const end = DAY_INDEX[dayMatch[2]];
  const days: number[] = [];
  for (let day = start; ; day = (day + 1) % 7) { days.push(day); if (day === end) break; }
  const ranges: Array<[number, number]> = [];
  const rangePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/g;
  let range: RegExpExecArray | null;
  while ((range = rangePattern.exec(text))) {
    const open = parseClock(range[1]);
    const close = parseClock(range[2]);
    if (open !== null && close !== null && close > open) ranges.push([open, close]);
  }
  return ranges.length ? { days, ranges } : null;
}

/** Whether the provider is open at `date` (local time), or unknown. */
export function hoursStatus(hours: string | null | undefined, date: Date): { state: HoursState; closesAt: string | null } {
  const parsed = parseWeeklyHours(hours);
  if (!parsed) return { state: "unknown", closesAt: null };
  if ("always" in parsed) return { state: "open", closesAt: null };
  if (!parsed.days.includes(date.getDay())) return { state: "closed", closesAt: null };
  const minutes = date.getHours() * 60 + date.getMinutes();
  const current = parsed.ranges.find(([open, close]) => minutes >= open && minutes < close);
  return current ? { state: "open", closesAt: formatClock(current[1]) } : { state: "closed", closesAt: null };
}

/** True only when the listing explicitly says walk-ins are accepted. */
export function acceptsWalkIns(provider: ProviderAccessFields) {
  if ((provider.walk_in_allowed || "").trim().toLowerCase() === "yes") return true;
  return (provider.document_alternatives || []).some((item) => /walk-?in welcome|first-come/i.test(item));
}

/**
 * True only when the listing says no documents are required, ID is optional
 * ("ID if available"), or self-attestation is accepted.
 */
export function noIdRequired(provider: ProviderAccessFields) {
  const docs = (provider.documents_required || []).map((item) => item.toLowerCase());
  if (docs.length > 0 && docs.every((item) => item.includes("none required") || item.includes("if available"))) return true;
  return (provider.document_alternatives || []).some((item) => /self-attestation accepted/i.test(item));
}

export function isVerified(provider: ProviderAccessFields) {
  return (provider.verification_status || "").trim().toLowerCase() === "verified";
}

/** What to bring, phrased for the visit checklist, without generic filler. */
export function documentsToBring(provider: ProviderAccessFields) {
  return (provider.documents_required || []).filter((item) => item && !/none required/i.test(item));
}
