import { useEffect, useId, useState } from "react";
import {
  ACCESS_BARRIERS,
  ACCESS_BARRIER_LABELS,
  ACCESS_OUTCOMES,
  ACCESS_OUTCOME_LABELS,
  CONTACT_PREFERENCE_LABELS,
  HOUSING_STATUSES,
  HOUSING_STATUS_LABELS,
  isContactPreference,
  isHousingStatus,
  type AccessBarrier,
  type AccessOutcome,
} from "../../../shared/accessOutcomes";
import { announce } from "../lib/a11y";

type OutcomeEntry = { id: string; outcome: AccessOutcome; barriers: AccessBarrier[]; connectedAt: number | null; source: "staff" | "client"; recordedByRole: string | null; createdAt: number };

export type OutcomeCase = {
  id: string;
  createdAt: number;
  housingStatus?: string | null;
  sdohConsent?: boolean;
  contactPreference?: string | null;
  accessOutcome?: string | null;
};

type Props = {
  caseRecord: OutcomeCase;
  canRecord: boolean;
  onRecorded?: (update: { accessOutcome?: AccessOutcome; housingStatus?: string | null; sdohConsent?: boolean }) => void;
  fetcher?: typeof fetch;
};

function toLocalDateInput(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(start: number, end: number) {
  return Math.max(0, Math.round(((end - start) / (24 * 60 * 60 * 1000)) * 10) / 10);
}

/**
 * Closed-loop follow-up for one referral: did the person get the service, and
 * if not, what got in the way. Also edits the consent-gated housing status.
 */
export default function AccessOutcomeRecorder({ caseRecord, canRecord, onRecorded, fetcher = fetch }: Props) {
  const formId = useId();
  const [history, setHistory] = useState<OutcomeEntry[]>([]);
  const [outcome, setOutcome] = useState<AccessOutcome | "">("");
  const [barriers, setBarriers] = useState<AccessBarrier[]>([]);
  const [connectedOn, setConnectedOn] = useState(toLocalDateInput(Date.now()));
  const [housingStatus, setHousingStatus] = useState(isHousingStatus(caseRecord.housingStatus) ? caseRecord.housingStatus : "");
  const [sdohConsent, setSdohConsent] = useState(Boolean(caseRecord.sdohConsent));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!canRecord) return;
    let active = true;
    fetcher(`/api/staff/cases/${caseRecord.id}/outcomes`, { credentials: "include" })
      .then(async (response) => (response.ok ? ((await response.json()) as { outcomes?: OutcomeEntry[] }) : { outcomes: [] }))
      .then((body) => { if (active) setHistory(body.outcomes || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [caseRecord.id, canRecord, fetcher]);

  if (!canRecord) {
    return <section aria-labelledby={`${formId}-title`} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <h3 id={`${formId}-title`} className="text-sm font-black text-[#142846]">Referral follow-up</h3>
      <p className="mt-1">Outcomes are recorded by administrators and care-team staff. Researchers see de-identified totals in Access outcomes.</p>
    </section>;
  }

  const toggleBarrier = (barrier: AccessBarrier) => setBarriers((current) => current.includes(barrier) ? current.filter((item) => item !== barrier) : [...current, barrier]);

  const saveOutcome = async () => {
    if (!outcome) { setMessage({ tone: "error", text: "Choose whether the person was connected." }); return; }
    if (outcome === "not_connected" && barriers.length === 0) { setMessage({ tone: "error", text: "Select at least one barrier when the person was not connected." }); return; }
    setSaving(true); setMessage(null);
    try {
      const [year, month, day] = connectedOn.split("-").map(Number);
      const connectedAt = outcome === "connected" ? Math.min(Date.now(), new Date(year, month - 1, day, 12).getTime()) : null;
      const response = await fetcher(`/api/staff/cases/${caseRecord.id}/outcomes`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, barriers, connectedAt }) });
      const body = await response.json().catch(() => ({})) as { error?: string; id?: string; createdAt?: number; connectedAt?: number | null };
      if (!response.ok) throw new Error(body.error || "Unable to record the outcome.");
      setHistory((current) => [{ id: body.id || String(Date.now()), outcome, barriers, connectedAt: body.connectedAt ?? connectedAt, source: "staff", recordedByRole: null, createdAt: body.createdAt || Date.now() }, ...current]);
      setMessage({ tone: "ok", text: "Outcome recorded." });
      announce("Referral outcome recorded");
      onRecorded?.({ accessOutcome: outcome });
      setOutcome(""); setBarriers([]);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to record the outcome." });
    } finally { setSaving(false); }
  };

  const saveHousing = async () => {
    setSaving(true); setMessage(null);
    try {
      const response = await fetcher(`/api/staff/cases/${caseRecord.id}/housing-status`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ housingStatus: sdohConsent ? housingStatus || null : null, sdohConsent }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update housing status.");
      if (!sdohConsent) setHousingStatus("");
      setMessage({ tone: "ok", text: sdohConsent ? "Housing status saved." : "Housing status cleared — no SDOH consent." });
      announce("Housing status updated");
      onRecorded?.({ housingStatus: sdohConsent ? housingStatus || null : null, sdohConsent });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Unable to update housing status." });
    } finally { setSaving(false); }
  };

  const contact = isContactPreference(caseRecord.contactPreference) ? CONTACT_PREFERENCE_LABELS[caseRecord.contactPreference].en : "Not recorded";
  const latest = history[0];

  return <div className="mt-5 space-y-4">
    <section aria-labelledby={`${formId}-title`} className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${formId}-title`} className="text-sm font-black text-[#142846]">Did the person get the service?</h3>
        <span className="text-xs font-semibold text-slate-600">Contact: {contact}</span>
      </div>
      {latest && <p className="mt-1 text-xs text-slate-600">Last recorded: <strong>{ACCESS_OUTCOME_LABELS[latest.outcome] || latest.outcome}</strong>{latest.connectedAt ? ` · ${daysBetween(caseRecord.createdAt, latest.connectedAt)} days after referral` : ""} · {latest.source === "client" ? "reported by the client" : "recorded by staff"} · {new Date(latest.createdAt).toLocaleDateString()}</p>}
      <fieldset className="mt-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-600">Outcome</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ACCESS_OUTCOMES.map((value) => <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold ${outcome === value ? "border-brand ring-2 ring-teal-200" : "border-slate-200"}`}>
            <input type="radio" name={`${formId}-outcome`} value={value} checked={outcome === value} onChange={() => setOutcome(value)} className="mt-1" />
            <span>{ACCESS_OUTCOME_LABELS[value]}</span>
          </label>)}
        </div>
      </fieldset>
      {outcome === "connected" && <label className="mt-3 block text-sm font-bold text-slate-700">Date connected
        <input type="date" value={connectedOn} min={toLocalDateInput(caseRecord.createdAt)} max={toLocalDateInput(Date.now())} onChange={(event) => setConnectedOn(event.target.value)} className="mt-1.5 block rounded-lg border border-slate-200 bg-white px-3 py-2" />
      </label>}
      {outcome && <fieldset className="mt-3">
        <legend className="text-xs font-bold uppercase tracking-wide text-slate-600">{outcome === "not_connected" ? "What got in the way? (required)" : "Barriers faced (optional)"}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCESS_BARRIERS.map((barrier) => <label key={barrier} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${barriers.includes(barrier) ? "border-brand bg-teal-100 text-[#0f5f59]" : "border-slate-200 bg-white text-slate-700"}`}>
            <input type="checkbox" checked={barriers.includes(barrier)} onChange={() => toggleBarrier(barrier)} />
            {ACCESS_BARRIER_LABELS[barrier].en}
          </label>)}
        </div>
      </fieldset>}
      <button type="button" onClick={() => void saveOutcome()} disabled={saving} className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving…" : "Record outcome"}</button>
    </section>

    <section aria-labelledby={`${formId}-housing`} className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 id={`${formId}-housing`} className="text-sm font-black text-[#142846]">Housing status (SDOH)</h3>
      <p className="mt-1 text-xs text-slate-600">Optional. Only saved when the person agrees it can be used to improve services. Researchers only ever see de-identified totals.</p>
      <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={sdohConsent} onChange={(event) => setSdohConsent(event.target.checked)} className="mt-1" />
        <span>The person agreed to share housing status for service improvement</span>
      </label>
      <label className="mt-3 block text-sm font-bold text-slate-700">Housing status
        <select value={housingStatus} disabled={!sdohConsent} onChange={(event) => setHousingStatus(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 disabled:bg-slate-100">
          <option value="">Not recorded</option>
          {HOUSING_STATUSES.map((status) => <option key={status} value={status}>{HOUSING_STATUS_LABELS[status].en}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void saveHousing()} disabled={saving} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">Save housing status</button>
    </section>
    {message && <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm font-semibold ${message.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>{message.text}</p>}
  </div>;
}
