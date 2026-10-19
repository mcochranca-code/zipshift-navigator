import React, { useEffect, useState } from "react";
import { Activity, Database, RefreshCw, TriangleAlert } from "lucide-react";

type Parity = {
  mode: string;
  configured: { cockroach: boolean; legacy: boolean };
  windowStartedAt: string;
  totals: { shadowQueries: number; matches: number; mismatches: number; errors: number };
  lastMismatch?: { fingerprint: string; operation: string; observedAt: string };
  lastError?: { target: string; operation: string; observedAt: string };
};
type Health = Record<string, { configured: boolean; ok: boolean; latencyMs?: number; error?: string }>;

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || "Unable to load database monitoring.");
  return body as T;
}

function Status({ ok, configured }: { ok: boolean; configured: boolean }) {
  if (!configured) return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Not configured</span>;
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{ok ? "Healthy" : "Unavailable"}</span>;
}

export default function DatabaseParityDashboard() {
  const [parity, setParity] = useState<Parity | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("");
  const load = async () => {
    try {
      const [parityData, healthData] = await Promise.all([
        json<{ parity: Parity }>("/api/admin/database-parity"),
        json<{ health: Health }>("/api/admin/database-health"),
      ]);
      setParity(parityData.parity); setHealth(healthData.health); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load monitoring data."); }
  };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, []);
  const totals = parity?.totals;
  const matchRate = totals && totals.shadowQueries ? Math.round((totals.matches / totals.shadowQueries) * 100) : null;
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#148d84]">Reliability operations</p><h2 className="mt-1 text-xl font-black">Database parity monitor</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Aggregate shadow-read metrics only. Row contents, query parameters, credentials, and protected document metadata are intentionally excluded.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"><RefreshCw size={14} />Refresh</button></div>
    {message && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{message}</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-bold uppercase">Mode</span><Database size={16} /></div><strong className="mt-2 block text-lg">{parity?.mode || "Loading…"}</strong></div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-bold uppercase">Shadow matches</span><Activity size={16} /></div><strong className="mt-2 block text-lg">{matchRate === null ? "—" : `${matchRate}%`}</strong><span className="text-xs text-slate-500">{totals?.shadowQueries || 0} sampled queries</span></div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-bold uppercase">Mismatches</span><TriangleAlert size={16} /></div><strong className="mt-2 block text-lg">{totals?.mismatches ?? "—"}</strong><span className="text-xs text-slate-500">Errors: {totals?.errors ?? "—"}</span></div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4"><span className="text-xs font-bold uppercase text-slate-500">Window started</span><strong className="mt-2 block text-sm">{parity?.windowStartedAt ? new Date(parity.windowStartedAt).toLocaleString() : "—"}</strong></div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-slate-100 p-4"><div className="flex items-center justify-between"><strong className="text-sm">CockroachDB</strong><Status ok={health?.cockroach?.ok || false} configured={parity?.configured.cockroach || false} /></div><p className="mt-2 text-xs text-slate-500">Latency: {health?.cockroach?.latencyMs === undefined ? "—" : `${health.cockroach.latencyMs} ms`}</p></div><div className="rounded-lg border border-slate-100 p-4"><div className="flex items-center justify-between"><strong className="text-sm">Legacy MySQL backup</strong><Status ok={health?.legacy?.ok || false} configured={parity?.configured.legacy || false} /></div><p className="mt-2 text-xs text-slate-500">Latency: {health?.legacy?.latencyMs === undefined ? "—" : `${health.legacy.latencyMs} ms`}</p></div></div>
    {parity?.lastMismatch && <p className="mt-4 text-xs text-amber-700">Last mismatch fingerprint: <code>{parity.lastMismatch.fingerprint}</code> · {parity.lastMismatch.operation}</p>}
  </section>;
}
