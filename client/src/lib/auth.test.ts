import { describe, expect, it } from "vitest";
import { readLoginResponse } from "./auth";

describe("readLoginResponse", () => {
  it("returns a session from a valid JSON login response", async () => {
    const result = await readLoginResponse(
      new Response(JSON.stringify({ success: true, sessionId: "session_123" }))
    );

    expect(result).toEqual({
      data: { success: true, sessionId: "session_123" },
      error: null,
    });
  });

  it("returns a friendly error for an empty response", async () => {
    const result = await readLoginResponse(new Response(""));

    expect(result.data).toBeNull();
    expect(result.error).toContain("empty response");
  });

  it("returns a friendly error for a non-JSON response", async () => {
    const result = await readLoginResponse(new Response("<!doctype html><html></html>"));

    expect(result.data).toBeNull();
    expect(result.error).toContain("unexpected response");
  });
});
