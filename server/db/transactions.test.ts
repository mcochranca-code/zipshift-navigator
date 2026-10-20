import { describe, expect, it, vi } from "vitest";
import { withMySqlTransaction } from "./transactions";

type FakeConnection = {
  beginTransaction: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  rollback: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
};

function fakeConnection(): FakeConnection {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    query: vi.fn().mockResolvedValue([[], []]),
    execute: vi.fn().mockResolvedValue([{ affectedRows: 1 }, []]),
  };
}

describe("withMySqlTransaction", () => {
  it("commits successful work and releases the connection", async () => {
    const connection = fakeConnection();
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
    } as any;
    const result = await withMySqlTransaction(pool, async transaction => {
      await transaction.execute("INSERT INTO events (id) VALUES (?)", [
        "event-1",
      ]);
      return "committed";
    });

    expect(result).toBe("committed");
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back, releases, and preserves the original error", async () => {
    const connection = fakeConnection();
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
    } as any;
    const failure = new Error("constraint failure");
    connection.execute.mockRejectedValueOnce(failure);

    await expect(
      withMySqlTransaction(pool, async transaction => {
        await transaction.execute("INSERT INTO events (id) VALUES (?)", [
          "event-1",
        ]);
        return "unreachable";
      })
    ).rejects.toBe(failure);

    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("does not mask a work error when rollback itself fails", async () => {
    const connection = fakeConnection();
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
    } as any;
    const failure = new Error("primary failure");
    connection.rollback.mockRejectedValueOnce(new Error("rollback failure"));

    await expect(
      withMySqlTransaction(pool, async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("does not commit when the callback rejects before any query", async () => {
    const connection = fakeConnection();
    const pool = {
      getConnection: vi.fn().mockResolvedValue(connection),
    } as any;

    await expect(
      withMySqlTransaction(pool, async () =>
        Promise.reject(new Error("cancelled"))
      )
    ).rejects.toThrow("cancelled");
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});
