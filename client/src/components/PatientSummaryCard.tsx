import React from "react";

type PatientSummaryCardProps = {
  patientName: string;
  privacyMode: boolean;
  serviceCategory: string;
  encounterStatus: string;
  caseNumber: string;
  updatedAt?: number;
  updatedByRole?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function patientInitials(name: string, privacyMode: boolean) {
  if (privacyMode) return "PP";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "PR").toUpperCase();
}

export function formatPatientUpdatedAt(updatedAt?: number) {
  if (!updatedAt) return "Not yet saved";
  return new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatPatientUpdatedByRole(role?: string | null, privacyMode = false) {
  if (privacyMode) return "Authorized staff";
  if (role === "admin") return "Administrator";
  if (role === "researcher") return "Researcher";
  return "Authorized staff";
}

export default function PatientSummaryCard({ patientName, privacyMode, serviceCategory, encounterStatus, caseNumber, updatedAt, updatedByRole, open, onOpenChange }: PatientSummaryCardProps) {
  return (
    <div className="relative" onMouseEnter={() => onOpenChange(true)} onMouseLeave={() => onOpenChange(false)}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Patient record</p>
      <button type="button" onClick={() => onOpenChange(!open)} onFocus={() => onOpenChange(true)} aria-expanded={open} aria-controls="patient-summary-card" className="mt-2 rounded-md text-left text-xl font-black outline-none focus-visible:ring-2 focus-visible:ring-[#159d92] focus-visible:ring-offset-2">
        {privacyMode ? "Privacy-protected record" : patientName}
      </button>
      <p className="mt-1 text-sm text-slate-500">{serviceCategory} · {encounterStatus}</p>
      {open && <div id="patient-summary-card" role="status" onMouseEnter={() => onOpenChange(true)} onMouseLeave={() => onOpenChange(false)} className="absolute left-0 top-full z-20 mt-3 w-[min(22rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e3f5f3] text-sm font-black text-[#0f766e]">{patientInitials(patientName, privacyMode)}</div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Completed patient information</p>
            <p className="mt-1 truncate text-base font-black text-[#142846]">{privacyMode ? "Privacy-protected record" : patientName}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{serviceCategory}</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">{encounterStatus}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
          <div><dt className="font-bold uppercase tracking-wide text-slate-400">Case</dt><dd className="mt-1 font-black text-[#148d84]">{caseNumber}</dd></div>
          <div><dt className="font-bold uppercase tracking-wide text-slate-400">Privacy</dt><dd className="mt-1 font-semibold text-slate-600">{privacyMode ? "Protected" : "Standard"}</dd></div>
          <div className="col-span-2"><dt className="font-bold uppercase tracking-wide text-slate-400">Last updated</dt><dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-slate-600"><span>{formatPatientUpdatedAt(updatedAt)}</span><span aria-hidden="true" className="text-slate-300">·</span><span>Updated by {formatPatientUpdatedByRole(updatedByRole, privacyMode)}</span></dd></div>
        </dl>
      </div>}
    </div>
  );
}

export { patientInitials };
