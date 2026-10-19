import { jsPDF } from "jspdf";

export type YellowBookPdfInput = {
  caseNumber: string;
  patientName: string;
  privacyMode: boolean;
  encounterStatus: string;
  updatedAt: number;
  chiefComplaint: string;
  narrative: string;
  hsaiScore: number | null;
  hsaiDomains: Record<string, number>;
  encounterResponse: string;
  plan: { immediate: string; followUp: string; referral: string };
};

export function buildYellowBookPdf(input: YellowBookPdfInput) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const lines = [
    "ZIPSHIFT YELLOWBOOK ENCOUNTER",
    `Case: ${input.caseNumber}`,
    `Patient: ${input.privacyMode ? "Privacy-protected record" : input.patientName}`,
    `Status: ${input.encounterStatus}`,
    `Updated: ${new Date(input.updatedAt).toLocaleString()}`,
    "",
    "CHIEF COMPLAINT",
    input.chiefComplaint || "Not documented",
    "",
    "NARRATIVE",
    input.narrative || "Not documented",
    "",
    "HSAI PROGRESS",
    `Draft score: ${input.hsaiScore ?? "Not assessed"}`,
    ...Object.entries(input.hsaiDomains).map(([key, value]) => `${key}: ${value}/100`),
    "",
    "ENCOUNTER",
    input.encounterResponse || "Not documented",
    "",
    "PLAN",
    `Immediate: ${input.plan.immediate || "Not documented"}`,
    `Follow-up: ${input.plan.followUp || "Not documented"}`,
    `Referral: ${input.plan.referral || "Not documented"}`,
  ];

  let y = 52;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(lines[0], 44, y);
  y += 26;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  lines.slice(1).forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, 520);
    if (y > 730) {
      pdf.addPage();
      y = 52;
    }
    pdf.text(wrapped, 44, y);
    y += Math.max(15, wrapped.length * 13);
  });
  return pdf;
}

export function downloadYellowBookPdf(input: YellowBookPdfInput) {
  buildYellowBookPdf(input).save(`zipshift-yellowbook-${input.caseNumber}.pdf`);
}
