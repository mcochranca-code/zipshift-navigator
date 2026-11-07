import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  ACCESS_BARRIER_LABELS,
  HOUSING_STATUS_LABELS,
  isHousingStatus,
  type AccessOutcomeReport,
  type HousingGroupReport,
  type SuppressedCount,
} from "../../../shared/accessOutcomes";

type ReportResponse = { periodDays: number; report: AccessOutcomeReport; methodology: string };
const PERIODS = [90, 180, 365, 730] as const;

function groupLabel(key: HousingGroupReport["housingStatus"]) {
  return isHousingStatus(key) ? HOUSING_STATUS_LABELS[key].en : "Not recorded / no SDOH consent";
}

function Count({ cell, min }: { cell: SuppressedCount; min: number }) {
  if (cell.suppressed) return <span title={`Suppressed: fewer than ${min}`}><span aria-hidden="true">&lt;{min}</span><span className="zs-sr-only">fewer than {min}, suppressed</span></span>;
  return <>{cell.value ?? 0}</>;
}

function Rate({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-slate-400"><span aria-hidden="true">—</span><span className="zs-sr-only">suppressed or not enough data</span></span>;
  return <>{value}{suffix}</>;
}

/**
 * De-identified access outcomes by housing status, for researchers and
 * administrators. Shows aggregates only; there is no row-level view or export.
 */
export default function AccessOutcomesPanel({ fetcher = fetch }: { fetcher?: typeof fetch }) {
  const [periodDays, setPeriodDays] = useState<number>(365);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    fetcher(`/api/research/access-outcomes?periodDays=${periodDays}`, { credentials: "include" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((body as { error?: string }).error || "Unable to load access outcomes.");
        return body as ReportResponse;
      })
      .then((body) => { if (active) setData(body); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load access outcomes."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [periodDays, fetcher]);

  const report = data?.report;
  const min = report?.minimumCellSize ?? 11;
  const groups = (report?.groups || []).filter((group) => group.referrals.suppressed || (group.referrals.value ?? 0) > 0);
  const topBarriers = (group: HousingGroupReport) => group.barriers.filter((item) => item.count.suppressed || (item.count.value ?? 0) > 0).sort((a, b) => (b.count.value ?? 0) - (a.count.value ?? 0));

  return <div className="space-y-6">
    <section aria-labelledby="access-outcomes-title" className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="access-outcomes-title" className="text-lg font-black">Do people reach the services they are referred to?</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Referral outcomes and barriers by housing status. De-identified totals only; counts from 1 to {min - 1} are hidden so no one can be singled out.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">Period
            <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2">
              {PERIODS.map((days) => <option key={days} value={days}>Last {days === 730 ? "2 years" : `${days} days`}</option>)}
            </select>
          </label>
          <a href={`/api/research/access-outcomes.csv?periodDays=${periodDays}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700" download><Download size={15} aria-hidden="true" /> Aggregate CSV</a>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {loading && !report ? <p role="status" className="mt-6 text-sm text-slate-500">Loading access outcomes…</p> : report && <>
        <div className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
          {([["Experiencing homelessness", report.homelessVsHoused.experiencingHomelessness, "Unsheltered, shelter, transitional, doubled-up"], ["Housed or at risk", report.homelessVsHoused.housedOrAtRisk, "Stable housing or at risk of losing it"]] as const).map(([label, summary, detail]) => <div key={label} className="rounded-xl bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">Referrals</dt><dd className="text-2xl font-black"><Count cell={summary.referrals} min={min} /></dd></div>
              <div><dt className="text-xs text-slate-500">Connected</dt><dd className="text-2xl font-black"><Rate value={summary.connectionRate} /></dd></div>
              <div><dt className="text-xs text-slate-500">Median days to connect</dt><dd className="text-2xl font-black"><Rate value={summary.medianDaysToConnection} suffix="" /></dd></div>
            </dl>
          </div>)}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="mb-2 text-left text-sm font-black text-[#142846]">Outcomes by housing status (latest outcome per referral)</caption>
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="py-2 pr-3">Housing status</th><th scope="col" className="py-2 pr-3">Referrals</th><th scope="col" className="py-2 pr-3">Connected</th><th scope="col" className="py-2 pr-3">Not connected</th><th scope="col" className="py-2 pr-3">Lost contact</th><th scope="col" className="py-2 pr-3">No outcome yet</th><th scope="col" className="py-2 pr-3">Connection rate</th><th scope="col" className="py-2">Median days</th></tr></thead>
            <tbody>
              {groups.length === 0 ? <tr><td colSpan={8} className="py-6 text-center text-slate-500">No referrals in this period yet.</td></tr> : groups.map((group) => <tr key={group.housingStatus} className="border-b border-slate-100">
                <th scope="row" className="py-2 pr-3 font-semibold">{groupLabel(group.housingStatus)}</th>
                <td className="py-2 pr-3"><Count cell={group.referrals} min={min} /></td>
                <td className="py-2 pr-3"><Count cell={group.connected} min={min} /></td>
                <td className="py-2 pr-3"><Count cell={group.notConnected} min={min} /></td>
                <td className="py-2 pr-3"><Count cell={group.lostContact} min={min} /></td>
                <td className="py-2 pr-3"><Count cell={group.noOutcomeYet} min={min} /></td>
                <td className="py-2 pr-3"><Rate value={group.connectionRate} /></td>
                <td className="py-2"><Rate value={group.medianDaysToConnection} suffix="" /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </>}
    </section>
    {report && groups.length > 0 && <section aria-labelledby="barrier-frequency-title" className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 id="barrier-frequency-title" className="text-lg font-black">What blocks access</h2>
      <p className="mt-1 text-sm text-slate-600">Barriers recorded at follow-up, by housing status. One referral can have several barriers.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.map((group) => { const rows = topBarriers(group); return <div key={group.housingStatus} className="rounded-lg bg-slate-50 p-4">
          <h3 className="text-sm font-black text-[#142846]">{groupLabel(group.housingStatus)}</h3>
          {rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">No barriers recorded.</p> : <ul className="mt-2 space-y-1 text-sm">{rows.map((item) => <li key={item.barrier} className="flex justify-between gap-3"><span>{ACCESS_BARRIER_LABELS[item.barrier].en}</span><strong><Count cell={item.count} min={min} /></strong></li>)}</ul>}
        </div>; })}
      </div>
    </section>}
    {data?.methodology && <p className="text-xs text-slate-500">{data.methodology}</p>}
  </div>;
}
