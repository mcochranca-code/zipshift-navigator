import type { Pool, PoolConnection } from "mysql2/promise";

export type SqlExecutor = Pick<PoolConnection, "query" | "execute">;

/** Runs all callback queries on one MySQL connection and always releases it. */
export async function withMySqlTransaction<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Preserve the original application/database error if rollback also fails.
    }
    throw error;
  } finally {
    connection.release();
  }
}
