import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPool } from "mysql2/promise";

const migrationFile = path.resolve(
  process.cwd(),
  "server/migrations/20261019_add_cursor_indexes_and_event_idempotency.sql"
);

export function splitMigrationStatements(source: string) {
  return source
    .split(/;\s*(?:\n|$)/)
    .map(statement => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export async function loadMigrationStatements() {
  return splitMigrationStatements(await readFile(migrationFile, "utf8"));
}

async function main() {
  const statements = await loadMigrationStatements();
  console.log(
    `Loaded ${statements.length} migration statements from ${path.relative(process.cwd(), migrationFile)}.`
  );
  if (!process.argv.includes("--apply")) {
    console.log(
      "Dry run only. Pass --apply with DATABASE_URL configured to execute this migration."
    );
    statements.forEach((statement, index) =>
      console.log(`\n-- statement ${index + 1} --\n${statement}`)
    );
    return;
  }

  const databaseUrl =
    process.env.DATABASE_URL || process.env.LEGACY_DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL or LEGACY_DATABASE_URL is required with --apply."
    );
  const pool = createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: 2,
  });
  const connection = await pool.getConnection();
  let applied = 0;
  try {
    for (const [index, statement] of statements.entries()) {
      console.log(`Applying statement ${index + 1}/${statements.length}...`);
      await connection.query(statement);
      applied += 1;
    }
    console.log("Cursor/index and event-idempotency migration applied.");
  } catch (error) {
    throw new Error(
      `Migration failed after ${applied}/${statements.length} statements. MySQL DDL is not transactional; inspect applied indexes before retrying. ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    connection.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("migrate-cursor-indexes.ts")) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
