import React from "react";
import { Clock3, History } from "lucide-react";
import { formatPatientUpdatedByRole } from "./PatientSummaryCard";

export type PatientActivityEvent = {
  eventType: string;
  note?: string | null;
  createdAt: number;
  actorRole?: string | null;
};

type PatientActivityTimelineProps = {
  events: PatientActivityEvent[];
  privacyMode: boolean;
  loading?: boolean;
  error?: string | null;
};

const eventLabels: Record<string, string> = {
  YELLOWBOOK_ENCOUNTER_CREATED: "Encounter opened",
  YELLOWBOOK_ENCOUNTER_SAVED: "Encounter saved",
};

function formatEventType(eventType: string) {
  return eventLabels[eventType] || eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPatientActivityDate(createdAt: number) {
  return new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PatientActivityTimeline({ events, privacyMode, loading = false, error = null }: PatientActivityTimelineProps) {
  return (
    <section aria-labelledby="patient-activity-heading" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2"><History size={17} className="text-[#148d84]" /><div><p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Audit history</p><h3 id="patient-activity-heading" className="mt-1 text-sm font-black text-[#142846]">Recent encounter activity</h3></div></div>
      {loading && <p className="mt-4 text-xs font-semibold text-slate-500">Loading recent activity…</p>}
      {!loading && error && <p className="mt-4 text-xs font-semibold text-slate-500">Recent activity is temporarily unavailable.</p>}
      {!loading && !error && !events.length && <p className="mt-4 text-xs font-semibold text-slate-500">No recent encounter events.</p>}
      {!loading && !error && events.length > 0 && <ol className="mt-4 space-y-3">{events.map((event, index) => <li key={`${event.eventType}-${event.createdAt}-${index}`} className="relative flex gap-3"><div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-teal-100 bg-white text-[#148d84]"><Clock3 size={14} /></div><div className="min-w-0 flex-1 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-xs font-black text-[#142846]">{formatEventType(event.eventType)}</p><time dateTime={new Date(event.createdAt).toISOString()} className="text-[11px] font-semibold text-slate-400">{formatPatientActivityDate(event.createdAt)}</time></div><p className="mt-1 text-[11px] font-semibold text-slate-500">Updated by {formatPatientUpdatedByRole(event.actorRole, privacyMode)}</p>{event.note && !privacyMode && <p className="mt-1 text-xs leading-5 text-slate-600">{event.note}</p>}</div></li>)}</ol>}
    </section>
  );
}
