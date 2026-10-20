import { createHmac, timingSafeEqual } from "node:crypto";

export type EventCursor = {
  version: 1;
  sort: "created_at,id:asc";
  createdAt: number;
  id: string;
};

function cursorSecret() {
  return (
    process.env.CURSOR_SIGNING_SECRET || "zipshift-development-cursor-secret"
  );
}

export function parseLimit(value: unknown, fallback = 50, maximum = 100) {
  const parsed =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : fallback;
  return Math.min(maximum, Math.max(1, parsed));
}

export function encodeEventCursor(cursor: EventCursor) {
  const body = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  const signature = createHmac("sha256", cursorSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function decodeEventCursor(value: unknown): EventCursor | null {
  if (typeof value !== "string" || value.length > 512) return null;
  const [body, suppliedSignature] = value.split(".");
  if (!body || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", cursorSecret())
    .update(body)
    .digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as Partial<EventCursor>;
    if (
      parsed.version !== 1 ||
      parsed.sort !== "created_at,id:asc" ||
      typeof parsed.id !== "string" ||
      !Number.isFinite(parsed.createdAt)
    )
      return null;
    return {
      version: 1,
      sort: "created_at,id:asc",
      createdAt: Number(parsed.createdAt),
      id: parsed.id,
    };
  } catch {
    return null;
  }
}
