import { z } from "zod";

export const CASE_EVENT_TYPES = [
  "CONTACT_WEBFORM_SUBMIT",
  "ACCESS_FEEDBACK_SUBMITTED",
  "CASE_STATUS_UPDATED",
  "CLIENT_PROFILE_UPDATED",
  "REFERRAL_CREATED",
  "NAVIGATOR_MESSAGE_SENT",
  "NAVIGATOR_QUIET_HOURS_UPDATED",
  "NAVIGATOR_FHIR_PREVIEWED",
] as const;

const caseEventSchema = z
  .object({
    caseId: z.string().min(1).max(80),
    eventType: z.enum(CASE_EVENT_TYPES),
    eventData: z.record(z.string(), z.unknown()).default({}),
    note: z.string().trim().max(2000).optional(),
    idempotencyKey: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{16,100}$/)
      .optional(),
  })
  .strict();

function boundedJson(value: unknown, depth = 0): boolean {
  if (depth > 3) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (Array.isArray(value))
    return (
      value.length <= 50 && value.every(item => boundedJson(item, depth + 1))
    );
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      entries.length <= 50 &&
      entries.every(
        ([key, item]) => key.length <= 80 && boundedJson(item, depth + 1)
      )
    );
  }
  return false;
}

export type CaseEventInput = z.infer<typeof caseEventSchema>;

export function parseCaseEventInput(input: unknown): CaseEventInput | null {
  const parsed = caseEventSchema.safeParse(input);
  if (!parsed.success || !boundedJson(parsed.data.eventData)) return null;
  const serialized = JSON.stringify(parsed.data.eventData);
  return serialized.length <= 16_000 ? parsed.data : null;
}
