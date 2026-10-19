import { describe, expect, it } from "vitest";
import { DualDatabaseAdapter, normalizeRows, toPostgresPlaceholders } from "./dualDatabase";

describe("dual database utilities", () => {
  it("converts unquoted MySQL placeholders without touching quoted question marks", () => {
    expect(toPostgresPlaceholders("SELECT * FROM t WHERE id = ? AND note = '?' AND status = ?")).toBe("SELECT * FROM t WHERE id = $1 AND note = '?' AND status = $2");
  });

  it("normalizes dates, buffers, object keys, and row ordering for parity comparison", () => {
    expect(normalizeRows([{ z: 1, a: new Date("2026-01-01T00:00:00.000Z") }, { a: 2, z: Buffer.from("x") }])).toEqual([
      [{ a: "2026-01-01T00:00:00.000Z", z: 1 }][0],
      [{ a: 2, z: "eA==" }][0],
    ]);
  });

  it("does not require credentials to expose an explicit unconfigured runtime", () => {
    const adapter = new DualDatabaseAdapter({ mode: "shadow", cockroachUrl: "", legacyUrl: "" });
    expect(adapter.snapshot()).toMatchObject({ mode: "shadow", configured: { cockroach: false, legacy: false }, totals: { shadowQueries: 0, matches: 0, mismatches: 0, errors: 0 } });
  });
});
