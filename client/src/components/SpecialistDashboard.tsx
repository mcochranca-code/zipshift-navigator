import React, { useEffect, useState } from "react";
import { ArrowLeft, BellRing, CheckCircle2, ClipboardSignature, Clock3, FileWarning, Handshake, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";

type Team = "intake_specialist" | "medical_specialist" | "peer_support_specialist" | "sud_specialist" | "behavioral_health_specialist" | "residential_care_specialist" | "care_coordinator";
type DashboardData = {
  team: Team;
  summary: { activeCases: number; pendingHandoffs: number; unsignedDocuments: number };
  pendingHandoffs: Array<{ id: string; caseId: string; caseNumber: string; clientName: string; serviceCategory: string; priority: string; fromTeam: string; toTeam: string; note: string; createdAt: number }>;
  unsignedDocuments: Array<{ id: string; caseId: string; caseNumber: string; clientName: string; serviceCategory: string; priority: string; title: string; documentType: string; requiredRole: string | null; updatedAt: number }>;
};

const teams: Array<{ id: Team; label: string }> = [
  { id: "intake_specialist", label: "Intake specialist" },
  { id: "medical_specialist", label: "Medi-Cal / medical" },
  { id: "peer_support_specialist", label: "Peer support" },
  { id: "sud_specialist", label: "SUD services" },
  { id: "behavioral_health_specialist", label: "Behavioral health" },
  { id: "residential_care_specialist", label: "Residential care" },
  { id: "care_coordinator", label: "Care coordinator" },
];

const teamLabel = (value: string) => teams.find((team) => team.id === value)?.label || value.replaceAll("_", " ");
const formatDate = (value: number) => new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = await response.text();
  let parsed: any = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { throw new Error("The service returned an unexpected response."); }
  if (!response.ok) throw new Error(parsed?.error || "Unable to load the specialist dashboard.");
  return parsed as T;
}

export default function SpecialistDashboard({ onBack, onOpenPortal }: { onBack: () => void; onOpenPortal: () => void }) {
  const [team, setTeam] = useState<Team>("care_coordinator");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestJson<DashboardData>(`/api/care-portal/dashboard?team=${team}`);
      setData(result);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the specialist dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [team]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 60000); return () => window.clearInterval(timer); }, [team]);

  const dashboard = data || { summary: { activeCases: 0, pendingHandoffs: 0, unsignedDocuments: 0 }, pendingHandoffs: [], unsignedDocuments: [], team };
  return (
    <main className="min-h-screen bg-[#f6f9fb] px-4 py-5 text-[#142846] md:px-8" aria-labelledby="specialist-dashboard-title">
      <header className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label="Back to portal" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:border-[#159d92]"><ArrowLeft size={18} /></button>
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#148d84]">SPECIALIST DASHBOARD</p><h1 id="specialist-dashboard-title" className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Caseload & reminders</h1><p className="mt-1 text-sm text-slate-500">A focused view of active episodes, pending handoffs, and documents awaiting acknowledgement.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800"><ShieldCheck size={15} /> Protected specialist workspace</span><button type="button" onClick={onOpenPortal} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-[#159d92]">Open care workspace</button></div>
      </header>

      <section className="mx-auto mt-6 max-w-[1480px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><UsersRound size={18} className="text-[#159d92]" /><div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Viewing queue</p><p className="font-black">{teamLabel(team)}</p></div></div><div className="flex items-center gap-2"><select value={team} onChange={(event) => setTeam(event.target.value as Team)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold" aria-label="Select specialist dashboard queue">{teams.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-[#159d92]"><RefreshCw size={15} />Refresh</button></div></div>{lastUpdated && <p className="mt-2 text-xs text-slate-400">Last checked {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · Automatically refreshes every minute</p>}</section>

      {error && <div className="mx-auto mt-5 max-w-[1480px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700" role="alert">{error}</div>}
      <section className="mx-auto mt-6 grid max-w-[1480px] gap-3 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Active caseload</p><UsersRound size={20} className="text-[#159d92]" /></div><p className="mt-3 text-4xl font-black">{loading ? "—" : dashboard.summary.activeCases}</p><p className="mt-1 text-xs text-slate-500">Open episodes visible to this team</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-amber-800">Pending handoffs</p><Handshake size={20} className="text-amber-700" /></div><p className="mt-3 text-4xl font-black text-amber-900">{loading ? "—" : dashboard.summary.pendingHandoffs}</p><p className="mt-1 text-xs text-amber-800">Warm handoffs waiting for action</p></div><div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-rose-800">Unsigned documents</p><FileWarning size={20} className="text-rose-700" /></div><p className="mt-3 text-4xl font-black text-rose-900">{loading ? "—" : dashboard.summary.unsignedDocuments}</p><p className="mt-1 text-xs text-rose-800">Forms needing typed acknowledgement</p></div></section>

      <section className="mx-auto mt-6 grid max-w-[1480px] gap-6 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-amber-700">Action queue</p><h2 className="mt-1 text-xl font-black">Pending warm handoffs</h2><p className="mt-1 text-sm text-slate-500">Respond before a handoff stalls the client’s next step.</p></div><BellRing className="text-amber-700" size={21} /></div><div className="mt-4 space-y-3">{loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading reminders…</p> : dashboard.pendingHandoffs.length ? dashboard.pendingHandoffs.map((handoff) => <article key={handoff.id} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs font-black text-amber-800">{handoff.caseNumber}</p><h3 className="mt-1 font-black">{handoff.clientName}</h3><p className="mt-1 text-xs text-slate-600">{handoff.serviceCategory} · {handoff.priority} priority</p></div><span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-amber-800">{teamLabel(handoff.fromTeam)} → you</span></div><p className="mt-3 text-sm text-slate-700">{handoff.note || "No additional note provided."}</p><p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />Received {formatDate(handoff.createdAt)}</p></article>) : <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500"><CheckCircle2 className="mb-2 text-emerald-600" size={20} /><p className="font-bold">No pending handoffs.</p><p className="mt-1">New team-to-team requests will appear here automatically.</p></div>}</div></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-rose-700">Reminder queue</p><h2 className="mt-1 text-xl font-black">Unsigned documents</h2><p className="mt-1 text-sm text-slate-500">Complete required acknowledgements so episodes can move forward.</p></div><ClipboardSignature className="text-rose-700" size={21} /></div><div className="mt-4 space-y-3">{loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading reminders…</p> : dashboard.unsignedDocuments.length ? dashboard.unsignedDocuments.map((document) => <article key={document.id} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-mono text-xs font-black text-rose-800">{document.caseNumber}</p><h3 className="mt-1 font-black">{document.title}</h3><p className="mt-1 text-xs text-slate-600">{document.clientName} · {document.serviceCategory}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-black ${document.priority === "urgent" ? "bg-rose-200 text-rose-900" : "bg-white text-rose-800"}`}>{document.priority}</span></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Clock3 size={13} />Awaiting since {formatDate(document.updatedAt)}</p></article>) : <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500"><CheckCircle2 className="mb-2 text-emerald-600" size={20} /><p className="font-bold">No unsigned documents.</p><p className="mt-1">Documents requiring your team’s acknowledgement will appear here.</p></div>}</div></div></section>

      <section className="mx-auto mt-6 max-w-[1480px] rounded-2xl border border-teal-200 bg-teal-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-teal-800">Need to take action?</p><h2 className="mt-1 text-lg font-black text-teal-950">Open the full forms and handoff workspace</h2><p className="mt-1 text-sm text-teal-900/75">Review the case record, sign documents, or accept and decline warm handoffs.</p></div><button type="button" onClick={onOpenPortal} className="inline-flex items-center gap-2 rounded-xl bg-[#142846] px-4 py-3 text-sm font-black text-white hover:bg-[#0c1d35]"><ClipboardSignature size={17} />Open care workspace</button></div></section>
    </main>
  );
}
