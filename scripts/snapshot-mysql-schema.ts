import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const databaseUrl = process.env.LEGACY_DATABASE_URL || process.env.DATABASE_URL;
const outputDir = path.resolve(process.cwd(), process.env.MYSQL_SCHEMA_SNAPSHOT_DIR || "db/baseline");
const outputFile = path.join(outputDir, "mysql-schema.sql");

if (!databaseUrl) {
  throw new Error("LEGACY_DATABASE_URL or DATABASE_URL is required. The script never prints connection values.");
}

const pool = mysql.createPool({ uri: databaseUrl, waitForConnections: true, connectionLimit: 2, enableKeepAlive: true });
try {
  const [tableRows] = await pool.query<Array<{ Tables_in_database?: string; [key: string]: unknown }>>("SHOW TABLES");
  const tableNames = tableRows.map((row) => Object.values(row)[0]).filter((value): value is string => typeof value === "string").sort();
  if (!tableNames.length) throw new Error("The legacy database returned no tables; refusing to write an empty baseline snapshot.");

  const statements: string[] = [
    "-- ZipShift baseline schema snapshot generated from the legacy MySQL/MariaDB database.",
    `-- Generated at ${new Date().toISOString()}. This file contains DDL only; no row data or credentials are included.`,
    "-- Review and translate with pnpm db:translate-mysql before applying to CockroachDB.",
    "",
  ];
  const manifest: { generatedAt: string; tables: Array<{ name: string; sha256: string }> } = { generatedAt: new Date().toISOString(), tables: [] };

  for (const tableName of tableNames) {
    const [rows] = await pool.query<Array<{ [key: string]: unknown }>>(`SHOW CREATE TABLE \`${tableName.replace(/`/g, "``")}\``);
    const createStatement = String(rows[0]?.["Create Table"] || rows[0]?.["Create View"] || "").trim();
    if (!createStatement) throw new Error(`No CREATE statement returned for ${tableName}.`);
    const statement = `${createStatement};`;
    statements.push(`-- ${tableName}`, statement, "");
    manifest.tables.push({ name: tableName, sha256: createHash("sha256").update(statement).digest("hex") });
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, statements.join("\n"), "utf8");
  await writeFile(path.join(outputDir, "mysql-schema.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote a DDL-only snapshot of ${tableNames.length} tables to ${path.relative(process.cwd(), outputFile)}.`);
} finally {
  await pool.end();
}
