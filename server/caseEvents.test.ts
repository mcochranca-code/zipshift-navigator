import { describe, expect, it } from "vitest";
import { parseCaseEventInput } from "./caseEvents";

describe("case event input validation", () => {
  it("accepts a supported bounded event", () => {
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "NAVIGATOR_MESSAGE_SENT",
        eventData: { channel: "secure_chat", queued: true },
        note: "Message queued.",
        idempotencyKey: "retry-key-123456",
      })
    ).toMatchObject({
      caseId: "case-123",
      eventType: "NAVIGATOR_MESSAGE_SENT",
    });
  });

  it("rejects missing authentication-independent fields, unknown types, and extra fields", () => {
    expect(
      parseCaseEventInput({ eventType: "CASE_STATUS_UPDATED" })
    ).toBeNull();
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "ARBITRARY_SQL_EVENT",
      })
    ).toBeNull();
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        unexpected: true,
      })
    ).toBeNull();
  });

  it("rejects oversized notes and invalid idempotency keys", () => {
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        note: "x".repeat(2001),
      })
    ).toBeNull();
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        idempotencyKey: "short",
      })
    ).toBeNull();
  });

  it("rejects deeply nested or oversized event data", () => {
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        eventData: { a: { b: { c: { d: true } } } },
      })
    ).toBeNull();
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        eventData: Object.fromEntries(
          Array.from({ length: 51 }, (_, index) => [`key-${index}`, true])
        ),
      })
    ).toBeNull();
    expect(
      parseCaseEventInput({
        caseId: "case-123",
        eventType: "CASE_STATUS_UPDATED",
        eventData: { payload: "x".repeat(16_001) },
      })
    ).toBeNull();
  });
});
