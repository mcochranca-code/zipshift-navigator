import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, FileDown, LockKeyhole, PauseCircle, PlayCircle, Save, ShieldCheck, UserRound } from "lucide-react";
import { downloadYellowBookPdf } from "../lib/yellowbookPdf";
import PatientSummaryCard from "./PatientSummaryCard";
import PatientActivityTimeline, { type PatientActivityEvent } from "./PatientActivityTimeline";

type DomainScores = Record<"housing" | "health" | "safety" | "access", number>;
type EncounterStatus = "active" | "paused" | "discontinued" | "completed";

type Encounter = {
  id: string;
  caseId: string;
  caseNumber: string;
  patientName: string;
  chiefComplaint: string;
  narrative: string;
  encounterStatus: EncounterStatus;
  privacyMode: boolean;
  adaptiveBranch: string;
  hsaiScore: number | null;
  hsaiDomains: DomainScores;
  encounter: { question: string; response: string; barriers: string };
  plan: { immediate: string; followUp: string; referral: string };
  updatedAt: number;
  updatedByRole: string | null;
};

type EncounterState = Omit<Encounter, "id" | "updatedAt"> & { id?: string; updatedAt?: number; updatedByRole?: string | null };

type YellowBookEncounterProps = {
  caseId: string;
  caseNumber: string;
  clientName: string;
  serviceCategory: string;
  onBack: () => void;
};

const emptyDomains: DomainScores = { housing: 0, health: 0, safety: 0, access: 0 };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.text();
  let parsed: any = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { throw new Error("The server returned an unexpected response."); }
  if (!response.ok) throw new Error(parsed?.error || "Request failed.");
  return parsed as T;
}

function defaultEncounter(caseId: string, caseNumber: string, clientName: string): Omit<Encounter, "id" | "updatedAt"> {
  return {
    caseId, caseNumber, patientName: clientName || "Client record",
    chiefComplaint: "", narrative: "", encounterStatus: "active", privacyMode: false,
    adaptiveBranch: "general", hsaiScore: null, hsaiDomains: { ...emptyDomains },
    encounter: { question: "What would make the next 72 hours safer or more stable?", response: "", barriers: "" },
    plan: { immediate: "", followUp: "", referral: "" },
    updatedByRole: null,
  };
}

function branchFor(complaint: string, category: string) {
  const text = `${complaint} ${category}`.toLowerCase();
  if (text.includes("shelter") || text.includes("housing") || text.includes("homeless")) return "housing-stability";
  if (text.includes("medical") || text.includes("health") || text.includes("medication")) return "health-access";
  if (text.includes("safety") || text.includes("violence") || text.includes("crisis")) return "safety-planning";
  return "general-navigation";
}

export default function YellowBookEncounter({ caseId, caseNumber, clientName, serviceCategory, onBack }: YellowBookEncounterProps) {
  const [encounter, setEncounter] = useState<EncounterState>(() => defaultEncounter(caseId, caseNumber, clientName));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patientCardOpen, setPatientCardOpen] = useState(false);
  const [activityEvents, setActivityEvents] = useState<PatientActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    requestJson<{ encounter: Encounter | null }>(`/api/staff/yellowbook/cases/${caseId}`)
      .then((data) => { if (active && data.encounter) setEncounter(data.encounter); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load the encounter."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [caseId]);

  useEffect(() => {
    if (!encounter.id) {
      setActivityEvents([]);
      setActivityLoading(false);
      return;
    }
    let active = true;
    setActivityLoading(true);
    setActivityError(null);
    requestJson<{ events: PatientActivityEvent[] }>(`/api/staff/yellowbook/${encounter.id}/events`)
      .then((data) => { if (active) setActivityEvents(data.events); })
      .catch((err) => { if (active) setActivityError(err instanceof Error ? err.message : "Unable to load recent activity."); })
      .finally(() => { if (active) setActivityLoading(false); });
    return () => { active = false; };
  }, [encounter.id]);

  const domainAverage = useMemo(() => {
    const values = Object.values(encounter.hsaiDomains);
    return values.some(Boolean) ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }, [encounter.hsaiDomains]);

  const update = <K extends keyof EncounterState>(key: K, value: EncounterState[K]) => setEncounter((current) => ({ ...current, [key]: value }));
  const updateNested = <K extends "encounter" | "plan", P extends keyof Encounter[K]>(group: K, key: P, value: Encounter[K][P]) => {
    setEncounter((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
  };

  const save = async (nextStatus?: EncounterStatus) => {
    setSaving(true); setError(null); setMessage(null);
    const next = { ...encounter, encounterStatus: nextStatus || encounter.encounterStatus, adaptiveBranch: branchFor(encounter.chiefComplaint, serviceCategory), hsaiScore: domainAverage };
    try {
      const result = encounter.id
        ? await requestJson<{ encounter: Encounter }>(`/api/staff/yellowbook/${encounter.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
        : await requestJson<{ encounter: Encounter }>("/api/staff/yellowbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      setEncounter(result.encounter);
      setMessage(nextStatus === "paused" ? "Encounter paused with a safe-to-resume report." : "Encounter saved to the case record.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save the encounter."); }
    finally { setSaving(false); }
  };

  const exportPdf = async () => {
    if (!encounter.id) {
      downloadYellowBookPdf({ caseNumber, patientName: encounter.patientName, privacyMode: encounter.privacyMode, encounterStatus: encounter.encounterStatus, updatedAt: encounter.updatedAt || Date.now(), chiefComplaint: encounter.chiefComplaint, narrative: encounter.narrative, hsaiScore: domainAverage, hsaiDomains: encounter.hsaiDomains, encounterResponse: encounter.encounter.response, plan: encounter.plan });
      return;
    }
    try {
      const response = await fetch(`/api/staff/yellowbook/${encounter.id}/export.pdf`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to export the encounter PDF.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `zipshift-yellowbook-${caseNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("YellowBook PDF exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export the encounter PDF.");
    }
  };

  const branchLabel = encounter.adaptiveBranch.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading YellowBook encounter…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><button onClick={onBack} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Back to cases"><ArrowLeft size={18} /></button><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#148d84]">Ceramic encounter workspace</p><h2 className="mt-1 text-2xl font-black">YellowBook · {caseNumber}</h2></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><FileDown size={16} />Export pause-safe PDF</button><button disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white hover:bg-[#0d8077] disabled:opacity-60"><Save size={16} />{saving ? "Saving" : "Save encounter"}</button></div>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-[#0f766e]">{message}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between gap-4"><PatientSummaryCard patientName={encounter.patientName} privacyMode={encounter.privacyMode} serviceCategory={serviceCategory} encounterStatus={encounter.encounterStatus} caseNumber={caseNumber} updatedAt={encounter.updatedAt} updatedByRole={encounter.updatedByRole} open={patientCardOpen} onOpenChange={setPatientCardOpen} /><div className="rounded-lg bg-teal-50 p-3 text-[#148d84]"><UserRound size={22} /></div></div><PatientActivityTimeline events={activityEvents} privacyMode={encounter.privacyMode} loading={activityLoading} error={activityError} /><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Chief Complaint<textarea value={encounter.chiefComplaint} onChange={(event) => update("chiefComplaint", event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" placeholder="Primary need or reason for encounter" /></label><label className="text-sm font-bold text-slate-700">Narrative<textarea value={encounter.narrative} onChange={(event) => update("narrative", event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" placeholder="Context, barriers, and client-stated goals" /></label></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3"><span className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><CalendarDays size={15} />Synthetic appointment context · {new Date().toLocaleDateString()}</span><button onClick={() => update("privacyMode", !encounter.privacyMode)} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-black ${encounter.privacyMode ? "bg-[#182d4d] text-white" : "bg-white text-slate-600"}`}><LockKeyhole size={14} />{encounter.privacyMode ? "Privacy mode on" : "Enable privacy mode"}</button></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">HSAI Progress</p><h3 className="mt-1 text-lg font-black">Draft access-domain assessment</h3></div><div className="text-right"><div className="text-2xl font-black text-[#148d84]">{domainAverage ?? "—"}</div><div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">average / 100</div></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{(Object.keys(encounter.hsaiDomains) as Array<keyof DomainScores>).map((domain) => <label key={domain} className="text-xs font-black uppercase tracking-wide text-slate-500">{domain}<input type="range" min="0" max="100" value={encounter.hsaiDomains[domain]} onChange={(event) => update("hsaiDomains", { ...encounter.hsaiDomains, [domain]: Number(event.target.value) })} className="mt-3 w-full accent-[#159d92]" /><span className="mt-1 block text-sm font-black text-[#148d84]">{encounter.hsaiDomains[domain]} / 100</span></label>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">Scores remain a draft until a researcher completes the adjudication workflow. No score is treated as a final determination from this encounter screen.</p></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Encounter</p><h3 className="mt-1 text-lg font-black">Adaptive interview prompt</h3></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-[#148d84]">{branchLabel}</span></div><label className="mt-5 block text-sm font-bold text-slate-700">Current question<textarea value={encounter.encounter.question} onChange={(event) => updateNested("encounter", "question", event.target.value)} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" /></label><label className="mt-4 block text-sm font-bold text-slate-700">Response and client narrative<textarea value={encounter.encounter.response} onChange={(event) => updateNested("encounter", "response", event.target.value)} className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" placeholder="Document the response without adding unsupported assumptions." /></label><label className="mt-4 block text-sm font-bold text-slate-700">Barriers identified<textarea value={encounter.encounter.barriers} onChange={(event) => updateNested("encounter", "barriers", event.target.value)} className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" placeholder="Transportation, documentation, scheduling, or other access barriers" /></label></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ClipboardList size={18} className="text-[#148d84]" /><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Plan</p><h3 className="mt-1 text-lg font-black">Next actions and follow-up</h3></div></div><div className="mt-5 grid gap-4 md:grid-cols-3">{(["immediate", "followUp", "referral"] as const).map((field) => <label key={field} className="text-sm font-bold text-slate-700">{field === "immediate" ? "Immediate" : field === "followUp" ? "Follow-up" : "Referral"}<textarea value={encounter.plan[field]} onChange={(event) => updateNested("plan", field, event.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#159d92]" placeholder="Document next action" /></label>)}</div></section>
        </div>
        <aside className="space-y-5"><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#148d84]" /><h3 className="font-black">Patient details</h3></div><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Case</dt><dd className="mt-1 font-black text-[#148d84]">{caseNumber}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Service type</dt><dd className="mt-1 font-semibold text-slate-700">{serviceCategory}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Branch</dt><dd className="mt-1 font-semibold text-slate-700">{branchLabel}</dd></div></dl></section><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-[#148d84]" /><h3 className="font-black">Encounter actions</h3></div><div className="mt-4 space-y-2"><button disabled={saving} onClick={() => void save("paused")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"><PauseCircle size={16} />Pause and save report</button><button disabled={saving} onClick={() => void save("active")} className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-black text-[#148d84] hover:bg-teal-100 disabled:opacity-60"><PlayCircle size={16} />Resume encounter</button><button disabled={saving} onClick={() => void save("completed")} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#182d4d] px-3 py-2.5 text-sm font-black text-white hover:bg-[#243b5e] disabled:opacity-60"><CheckCircle2 size={16} />Complete encounter</button></div></section></aside>
      </div>
    </div>
  );
}
