import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPool,
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("database cursor pagination load", () => {
  const tableName = `zipshift_cursor_load_${process.pid}`;
  let pool: Pool;
  let connection: PoolConnection;

  beforeAll(async () => {
    pool = createPool({
      uri: databaseUrl!,
      waitForConnections: true,
      connectionLimit: 2,
    });
    connection = await pool.getConnection();
    await connection.query(
      `CREATE TABLE ${tableName} (id CHAR(36) NOT NULL PRIMARY KEY, created_at BIGINT NOT NULL, event_type VARCHAR(80) NOT NULL, INDEX idx_cursor_load_created_id (created_at, id))`
    );
    const rows = Array.from({ length: 20_000 }, (_, index) => [
      `load-event-${String(index).padStart(6, "0")}`,
      1_700_000_000_000 + Math.floor(index / 10),
      "LOAD_TEST",
    ]);
    await connection.query(
      `INSERT INTO ${tableName} (id, created_at, event_type) VALUES ?`,
      [rows]
    );
  });

  afterAll(async () => {
    await connection.query(`DROP TABLE IF EXISTS ${tableName}`);
    connection.release();
    await pool.end();
  });

  it("uses the cursor index and walks all rows without gaps under load", async () => {
    const [plan] = await connection.query<RowDataPacket[]>(
      `EXPLAIN SELECT id, created_at FROM ${tableName} WHERE (created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT ?`,
      [1_700_000_000_000, 1_700_000_000_000, "", 101]
    );
    expect(JSON.stringify(plan)).toContain("idx_cursor_load_created_id");

    const started = performance.now();
    let createdAt = 1_700_000_000_000 - 1;
    let id = "";
    let count = 0;
    for (;;) {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, created_at FROM ${tableName} WHERE (created_at > ? OR (created_at = ? AND id > ?)) ORDER BY created_at ASC, id ASC LIMIT 101`,
        [createdAt, createdAt, id]
      );
      count += Math.min(rows.length, 100);
      if (rows.length <= 100) break;
      const last = rows[99];
      createdAt = Number(last.created_at);
      id = String(last.id);
    }

    expect(count).toBe(20_000);
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});
