import { describe, expect, it } from "vitest";
import { buildYellowBookPdf } from "./yellowbookPdf";

describe("YellowBook PDF export", () => {
  it("creates a non-empty PDF with privacy-safe encounter content", () => {
    const pdf = buildYellowBookPdf({
      caseNumber: "CASE-2026-TEST",
      patientName: "Jane Doe",
      privacyMode: true,
      encounterStatus: "paused",
      updatedAt: 1_756_000_000_000,
      chiefComplaint: "Housing navigation",
      narrative: "Client requested a safe next step.",
      hsaiScore: 72,
      hsaiDomains: { housing: 80, health: 65, safety: 70, access: 73 },
      encounterResponse: "Review shelter options and transportation.",
      plan: { immediate: "Call verified shelter", followUp: "Check in tomorrow", referral: "AOR referral destination" },
    });

    const output = pdf.output("arraybuffer");
    expect(output.byteLength).toBeGreaterThan(500);
    expect(new TextDecoder().decode(new Uint8Array(output))).toContain("ZIPSHIFT YELLOWBOOK ENCOUNTER");
    expect(new TextDecoder().decode(new Uint8Array(output))).not.toContain("Jane Doe");
  });
});
