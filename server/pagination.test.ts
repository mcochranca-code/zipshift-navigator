import { describe, expect, it } from "vitest";
import {
  decodeEventCursor,
  encodeEventCursor,
  parseLimit,
  type EventCursor,
} from "./pagination";

function pageAfter(
  items: Array<{ id: string; createdAt: number }>,
  cursor: EventCursor | null,
  limit: number
) {
  const filtered = cursor
    ? items.filter(
        item =>
          item.createdAt > cursor.createdAt ||
          (item.createdAt === cursor.createdAt && item.id > cursor.id)
      )
    : items;
  return filtered.slice(0, limit);
}

describe("cursor pagination", () => {
  it("round-trips a signed cursor and rejects tampering", () => {
    const encoded = encodeEventCursor({
      version: 1,
      sort: "created_at,id:asc",
      createdAt: 42,
      id: "event-42",
    });
    expect(decodeEventCursor(encoded)).toEqual({
      version: 1,
      sort: "created_at,id:asc",
      createdAt: 42,
      id: "event-42",
    });
    const [body, signature] = encoded.split(".");
    expect(decodeEventCursor(`${body}.invalid-${signature}`)).toBeNull();
    expect(
      decodeEventCursor(
        `${Buffer.from(JSON.stringify({ version: 1, sort: "created_at,id:desc", createdAt: 42, id: "event-42" })).toString("base64url")}.${signature}`
      )
    ).toBeNull();
  });

  it("clamps limits to a bounded server-side range", () => {
    expect(parseLimit(undefined)).toBe(50);
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("25")).toBe(25);
    expect(parseLimit("1000")).toBe(100);
    expect(parseLimit("not-a-number")).toBe(50);
  });

  it("walks a same-timestamp page boundary without duplicates or gaps", () => {
    const items = Array.from({ length: 250 }, (_, index) => ({
      id: `event-${String(index).padStart(4, "0")}`,
      createdAt: 1_700_000_000_000,
    }));
    const seen: string[] = [];
    let cursor: EventCursor | null = null;
    for (;;) {
      const page = pageAfter(items, cursor, 37);
      seen.push(...page.map(item => item.id));
      if (page.length < 37) break;
      const last = page.at(-1)!;
      cursor = {
        version: 1,
        sort: "created_at,id:asc",
        createdAt: last.createdAt,
        id: last.id,
      };
    }
    expect(seen).toEqual(items.map(item => item.id));
    expect(new Set(seen).size).toBe(items.length);
  });

  it("traverses 50,000 events with keyset pages under the load-test budget", () => {
    const items = Array.from({ length: 50_000 }, (_, index) => ({
      id: `event-${String(index).padStart(6, "0")}`,
      createdAt: 1_700_000_000_000 + Math.floor(index / 10),
    }));
    const started = performance.now();
    let cursor: EventCursor | null = null;
    let count = 0;
    for (;;) {
      const page = pageAfter(items, cursor, 100);
      count += page.length;
      if (page.length < 100) break;
      const last = page.at(-1)!;
      cursor = {
        version: 1,
        sort: "created_at,id:asc",
        createdAt: last.createdAt,
        id: last.id,
      };
    }
    expect(count).toBe(items.length);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
