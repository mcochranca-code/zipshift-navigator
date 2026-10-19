import { createHash } from "node:crypto";
import { Pool as CockroachPool, type QueryResultRow } from "pg";
import mysql, { type Pool as MySqlPool, type RowDataPacket } from "mysql2/promise";

export type DatabaseMode = "legacy" | "shadow" | "cockroach" | "cockroach-readonly-legacy-backup";
export type DatabaseTarget = "cockroach" | "legacy";

type QueryValue = unknown;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type AdapterOptions = {
  cockroachUrl?: string;
  legacyUrl?: string;
  mode?: DatabaseMode;
  shadowSampleRate?: number;
};

export type ParitySnapshot = {
  mode: DatabaseMode;
  configured: { cockroach: boolean; legacy: boolean };
  windowStartedAt: string;
  totals: { shadowQueries: number; matches: number; mismatches: number; errors: number };
  lastMismatch?: { fingerprint: string; operation: string; observedAt: string };
  lastError?: { target: DatabaseTarget; operation: string; observedAt: string };
};

function modeFromEnvironment(): DatabaseMode {
  const requested = process.env.DB_MODE;
  return requested === "shadow" || requested === "cockroach" || requested === "cockroach-readonly-legacy-backup" ? requested : "legacy";
}

/** Converts the existing repository-style `?` placeholders to PostgreSQL `$1` placeholders. */
export function toPostgresPlaceholders(sql: string): string {
  let output = "";
  let parameter = 0;
  let quoted = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (character === "'" && sql[index - 1] !== "\\") quoted = !quoted;
    if (character === "?" && !quoted) output += `$${++parameter}`;
    else output += character;
  }
  return output;
}

function normalize(value: unknown): JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isNaN(value)) return null;
  return value as JsonValue;
}

export function normalizeRows(rows: unknown[]): JsonValue[] {
  return rows.map(normalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function fingerprint(operation: string, rows: unknown[]): string {
  return createHash("sha256").update(`${operation}:${JSON.stringify(normalizeRows(rows))}`).digest("hex").slice(0, 16);
}

export class ParityMonitor {
  private readonly startedAt = new Date().toISOString();
  private shadowQueries = 0;
  private matches = 0;
  private mismatches = 0;
  private errors = 0;
  private lastMismatch?: ParitySnapshot["lastMismatch"];
  private lastError?: ParitySnapshot["lastError"];

  recordMatch() { this.shadowQueries += 1; this.matches += 1; }
  recordMismatch(operation: string, rows: unknown[]) {
    this.shadowQueries += 1;
    this.mismatches += 1;
    this.lastMismatch = { fingerprint: fingerprint(operation, rows), operation, observedAt: new Date().toISOString() };
  }
  recordError(target: DatabaseTarget, operation: string) {
    this.shadowQueries += 1;
    this.errors += 1;
    this.lastError = { target, operation, observedAt: new Date().toISOString() };
  }
  snapshot(adapter: DualDatabaseAdapter): ParitySnapshot {
    return {
      mode: adapter.mode,
      configured: { cockroach: adapter.hasCockroach, legacy: adapter.hasLegacy },
      windowStartedAt: this.startedAt,
      totals: { shadowQueries: this.shadowQueries, matches: this.matches, mismatches: this.mismatches, errors: this.errors },
      lastMismatch: this.lastMismatch,
      lastError: this.lastError,
    };
  }
}

export class DualDatabaseAdapter {
  readonly mode: DatabaseMode;
  readonly hasCockroach: boolean;
  readonly hasLegacy: boolean;
  readonly parity = new ParityMonitor();
  private readonly cockroach?: CockroachPool;
  private readonly legacy?: MySqlPool;
  private readonly shadowSampleRate: number;

  constructor(options: AdapterOptions = {}) {
    this.mode = options.mode || modeFromEnvironment();
    const cockroachUrl = options.cockroachUrl || process.env.COCKROACH_DATABASE_URL;
    const legacyUrl = options.legacyUrl || process.env.LEGACY_DATABASE_URL || process.env.DATABASE_URL;
    this.shadowSampleRate = Math.min(1, Math.max(0, options.shadowSampleRate ?? Number(process.env.DB_SHADOW_SAMPLE_RATE || 0.05)));
    this.hasCockroach = Boolean(cockroachUrl);
    this.hasLegacy = Boolean(legacyUrl);
    if (cockroachUrl) this.cockroach = new CockroachPool({ connectionString: cockroachUrl, max: Number(process.env.COCKROACH_POOL_SIZE || 8), application_name: "zipshift-navigator" });
    if (legacyUrl) this.legacy = mysql.createPool({ uri: legacyUrl, waitForConnections: true, connectionLimit: Number(process.env.LEGACY_POOL_SIZE || 8), enableKeepAlive: true });
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: QueryValue[] = [], operation = "query"): Promise<T[]> {
    if (this.mode === "legacy") return this.queryLegacy<T>(sql, params, operation);
    if (this.mode === "shadow") {
      const primary = await this.queryCockroach<T>(sql, params, operation);
      if (this.hasLegacy && Math.random() < this.shadowSampleRate) void this.compareWithLegacy(sql, params, operation, primary);
      return primary;
    }
    return this.queryCockroach<T>(sql, params, operation);
  }

  async queryLegacy<T extends QueryResultRow = QueryResultRow>(sql: string, params: QueryValue[] = [], operation = "legacy-query"): Promise<T[]> {
    if (!this.legacy) throw new Error("Legacy database is not configured.");
    try {
      const [rows] = await this.legacy.query<RowDataPacket[]>(sql, params);
      return rows as T[];
    } catch (error) {
      this.parity.recordError("legacy", operation);
      throw error;
    }
  }

  async queryCockroach<T extends QueryResultRow = QueryResultRow>(sql: string, params: QueryValue[] = [], operation = "cockroach-query"): Promise<T[]> {
    if (!this.cockroach) throw new Error("CockroachDB is not configured.");
    try {
      const result = await this.cockroach.query<T>(toPostgresPlaceholders(sql), params);
      return result.rows;
    } catch (error) {
      this.parity.recordError("cockroach", operation);
      throw error;
    }
  }

  private async compareWithLegacy<T extends QueryResultRow>(sql: string, params: QueryValue[], operation: string, primary: T[]) {
    try {
      const legacy = await this.queryLegacy<T>(sql, params, `${operation}:shadow`);
      if (JSON.stringify(normalizeRows(primary)) === JSON.stringify(normalizeRows(legacy))) this.parity.recordMatch();
      else this.parity.recordMismatch(operation, primary);
    } catch {
      // queryLegacy already records the target error; shadow comparison must not affect the user response
    }
  }

  async health() {
    const result: Record<DatabaseTarget, { configured: boolean; ok: boolean; latencyMs?: number; error?: string }> = {
      cockroach: { configured: this.hasCockroach, ok: false },
      legacy: { configured: this.hasLegacy, ok: false },
    };
    for (const target of ["cockroach", "legacy"] as const) {
      if (!result[target].configured) continue;
      const started = Date.now();
      try {
        await (target === "cockroach" ? this.queryCockroach("SELECT 1 AS ok", [], "health") : this.queryLegacy("SELECT 1 AS ok", [], "health"));
        result[target] = { configured: true, ok: true, latencyMs: Date.now() - started };
      } catch (error) {
        result[target] = { configured: true, ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "Database health check failed" };
      }
    }
    return result;
  }

  snapshot(): ParitySnapshot { return this.parity.snapshot(this); }

  async close() {
    await Promise.all([this.cockroach?.end(), this.legacy?.end()]);
  }
}

let singleton: DualDatabaseAdapter | undefined;
export function getDualDatabase(): DualDatabaseAdapter {
  singleton ??= new DualDatabaseAdapter();
  return singleton;
}
