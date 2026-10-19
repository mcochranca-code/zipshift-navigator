import { useEffect, useState } from "react";
import { ClipboardCheck, ShieldAlert } from "lucide-react";

type Consent = { id: string; studyId: string; purpose: string; version: string; language: "en" | "es"; title: string; body: string; decision: "granted" | "declined" | "withdrawn" | null; decidedAt: number | null; withdrawnAt: number | null };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new Error("The service returned an unexpected response."); }
  if (!response.ok) throw new Error(body?.error || "Request failed.");
  return body as T;
}

export default function ResearchConsentPanel() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    try { const result = await requestJson<{ consents: Consent[] }>("/api/profile/consents"); setConsents(result.consents); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load research consent."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const decide = async (documentId: string, decision: "granted" | "declined" | "withdrawn") => {
    setError(""); setMessage("");
    try { await requestJson("/api/profile/consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, decision }) }); setMessage(decision === "granted" ? "Your research consent was recorded." : decision === "withdrawn" ? "Your research consent was withdrawn." : "Your decision was recorded."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save your consent decision."); }
  };
  if (loading) return <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading research consent options…</section>;
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-lg bg-teal-50 p-2 text-[#148d84]"><ClipboardCheck size={18} /></div><div><h2 className="text-xl font-black">Research consent</h2><p className="mt-1 text-sm leading-6 text-slate-500">Review active study consent language. Service access does not require research participation.</p></div></div>{message && <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800" role="status">{message}</div>}{error && <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert"><ShieldAlert size={16} className="mt-0.5 shrink-0" />{error}</div>}{consents.length ? <div className="mt-5 space-y-4">{consents.map((consent) => <article key={consent.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#148d84]">{consent.purpose.replaceAll("_", " ")} · v{consent.version} · {consent.language.toUpperCase()}</p><h3 className="mt-1 font-black">{consent.title}</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${consent.decision === "granted" ? "bg-emerald-100 text-emerald-700" : consent.decision === "withdrawn" ? "bg-amber-100 text-amber-700" : consent.decision === "declined" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>{consent.decision || "Not decided"}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{consent.body}</p><div className="mt-4 flex flex-wrap gap-2">{consent.decision !== "granted" && <button type="button" onClick={() => void decide(consent.id, "granted")} className="rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white">I agree to participate</button>}{consent.decision !== "declined" && consent.decision !== "withdrawn" && <button type="button" onClick={() => void decide(consent.id, "declined")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Decline</button>}{consent.decision === "granted" && <button type="button" onClick={() => void decide(consent.id, "withdrawn")} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700">Withdraw consent</button>}</div></article>)}</div> : <p className="mt-5 rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">No active research consent documents are available for your account.</p>}</section>;
}
