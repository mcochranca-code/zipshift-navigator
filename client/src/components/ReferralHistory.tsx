import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, FileText, Phone, Share2, XCircle } from "lucide-react";
import { SkeletonList } from "./motion/Loaders";
import { ACCESS_BARRIERS, ACCESS_BARRIER_LABELS, type AccessBarrier } from "../../../shared/accessOutcomes";
import { announce } from "../lib/a11y";

interface CaseRecord {
  id: string;
  caseNumber: string;
  clientName: string;
  serviceCategory: string;
  status: "new" | "in_progress" | "pending" | "completed" | "denied" | "closed";
  priority: "low" | "standard" | "high" | "urgent";
  createdAt: number;
  updatedAt: number;
  accessOutcome?: string | null;
}

interface TimelineEvent {
  eventType: string;
  note: string | null;
  createdAt: number;
}

interface ReferralHistoryProps {
  onBack: () => void;
}

function statusColor(status: CaseRecord["status"]) {
  if (status === "completed") return "#15803d";
  if (status === "denied") return "#b91c1c";
  if (status === "in_progress") return "#0369a1";
  if (status === "pending") return "#b45309";
  if (status === "closed") return "#475569";
  return "#0f766e";
}

function statusLabel(status: CaseRecord["status"]) {
  return status.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventLabel(eventType: string) {
  return eventType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * "Did you get the help?" — lets a client close the loop themselves. This
 * matters most for people without a phone, whom staff often cannot reach.
 */
export function OutcomeSelfReport({ caseId, onDone, fetcher = fetch }: { caseId: string; onDone: () => void; fetcher?: typeof fetch }) {
  const [answer, setAnswer] = useState<"connected" | "not_connected" | null>(null);
  const [barriers, setBarriers] = useState<AccessBarrier[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (outcome: "connected" | "not_connected", chosen: AccessBarrier[]) => {
    if (outcome === "not_connected" && chosen.length === 0) { setError("Pick what got in the way, or choose Other."); return; }
    setSending(true); setError("");
    try {
      const response = await fetcher(`/api/cases/${caseId}/outcome`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome, barriers: chosen }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save your answer.");
      announce("Thank you. Your answer was saved.");
      onDone();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save your answer."); }
    finally { setSending(false); }
  };
  const groupId = `self-report-${caseId}`;
  return <section aria-labelledby={groupId} style={{ marginTop: 14, padding: 13, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa" }}>
    <h3 id={groupId} style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#142846" }}>Did you get the help?</h3>
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <button type="button" disabled={sending} onClick={() => { setAnswer("connected"); void submit("connected", []); }} style={{ minHeight: 44, padding: "10px 16px", borderRadius: 9, border: "none", background: "#15803d", color: "#fff", fontWeight: 800, fontSize: 15 }}>Yes, I got help</button>
      <button type="button" aria-pressed={answer === "not_connected"} disabled={sending} onClick={() => setAnswer("not_connected")} style={{ minHeight: 44, padding: "10px 16px", borderRadius: 9, border: "2px solid #b45309", background: answer === "not_connected" ? "#ffedd5" : "#fff", color: "#92400e", fontWeight: 800, fontSize: 15 }}>No, not yet</button>
    </div>
    {answer === "not_connected" && <fieldset style={{ border: 0, padding: 0, margin: "12px 0 0" }}>
      <legend style={{ fontSize: 13, fontWeight: 700, color: "#142846" }}>What got in the way? Pick any.</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {ACCESS_BARRIERS.map((barrier) => <label key={barrier} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "6px 10px", borderRadius: 999, border: `1px solid ${barriers.includes(barrier) ? "#0f766e" : "#dbe3ec"}`, background: barriers.includes(barrier) ? "#e3f5f3" : "#fff", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={barriers.includes(barrier)} onChange={() => setBarriers((current) => current.includes(barrier) ? current.filter((item) => item !== barrier) : [...current, barrier])} />
          {ACCESS_BARRIER_LABELS[barrier].en}
        </label>)}
      </div>
      <button type="button" disabled={sending} onClick={() => void submit("not_connected", barriers)} style={{ marginTop: 10, minHeight: 44, padding: "10px 16px", borderRadius: 9, border: "none", background: "var(--zs-color-brand)", color: "#fff", fontWeight: 800 }}>{sending ? "Sending…" : "Send"}</button>
    </fieldset>}
    {error && <p role="alert" style={{ margin: "8px 0 0", color: "#b91c1c", fontSize: 13 }}>{error}</p>}
  </section>;
}

export default function ReferralHistory({ onBack }: ReferralHistoryProps) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [timeline, setTimeline] = useState<Record<string, TimelineEvent[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/cases/mine", { credentials: "include" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "Unable to load referral history.");
        return body as { cases: CaseRecord[] };
      })
      .then((data) => { if (active) setCases(data.cases || []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load referral history."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadTimeline = async (caseId: string) => {
    if (expanded === caseId) { setExpanded(null); return; }
    setExpanded(caseId);
    if (timeline[caseId]) return;
    try {
      const response = await fetch(`/api/cases/${caseId}/events`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to load the referral timeline.");
      setTimeline((current) => ({ ...current, [caseId]: body.events || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the referral timeline.");
    }
  };

  const shareReferral = async (record: CaseRecord) => {
    const text = `ZipShift referral ${record.caseNumber}: ${record.serviceCategory}. Current status: ${statusLabel(record.status)}.`;
    try {
      if (navigator.share) await navigator.share({ title: `ZipShift referral ${record.caseNumber}`, text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // The user may cancel the native share sheet; no error state is needed.
    }
  };

  const completedCount = cases.filter((record) => record.status === "completed").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f9fc", color: "#142846", paddingBottom: 80 }}>
      <header style={{ background: "#182d4d", color: "#ffffff", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ display: "grid", placeItems: "center", width: 36, height: 36, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 9, color: "#ffffff", cursor: "pointer" }} aria-label="Back"><span aria-hidden="true">‹</span></button>
        <div><p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: "uppercase", color: "#8de3da" }}>ZipShift client records</p><h1 style={{ fontSize: 20, fontWeight: 800, margin: "3px 0 0" }}>Referral History</h1></div>
      </header>
      <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
        {error && <div style={{ marginBottom: 14, padding: 12, border: "1px solid #fecaca", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>{error}</div>}
        <section style={{ marginBottom: 16, padding: 16, background: "#e3f5f3", border: "1px solid #b8e5e0", borderRadius: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0f766e", fontWeight: 800, fontSize: 14 }}><BarChart3 size={17} aria-hidden="true" /> Your referral summary</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}><div><div style={{ fontSize: 12, color: "#64748b" }}>Total referrals</div><div style={{ marginTop: 2, fontSize: 25, fontWeight: 900, color: "#142846" }}>{cases.length}</div></div><div><div style={{ fontSize: 12, color: "#64748b" }}>Completed</div><div style={{ marginTop: 2, fontSize: 25, fontWeight: 900, color: "#15803d" }}>{completedCount}</div></div></div></section>
        {loading ? <section style={{ padding: "12px 24px", background: "#ffffff", border: "1px solid #dbe3ec", borderRadius: 12 }}><SkeletonList rows={4} label="Loading your live referral history…" /></section> : cases.length === 0 ? <section style={{ padding: "44px 22px", textAlign: "center", background: "#ffffff", border: "1px solid #dbe3ec", borderRadius: 12 }}><div style={{ width: 56, height: 56, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}><ClipboardList size={29} strokeWidth={1.8} aria-hidden="true" /></div><h2 style={{ margin: 0, fontSize: 18 }}>No referrals yet</h2><p style={{ margin: "8px auto 0", maxWidth: 400, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>When you submit an intake or confirm a referral destination, your live case record will appear here.</p></section> : <div style={{ display: "grid", gap: 12 }}>{cases.map((record) => <article key={record.id} style={{ background: "#ffffff", border: "1px solid #dbe3ec", borderLeft: `4px solid ${statusColor(record.status)}`, borderRadius: 12, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><div><div style={{ fontSize: 12, fontWeight: 900, color: "#0f766e", letterSpacing: 0.7 }}>{record.caseNumber}</div><h2 style={{ margin: "5px 0 0", fontSize: 16 }}>{record.serviceCategory}</h2><div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Submitted {new Date(record.createdAt).toLocaleDateString()}</div></div><span style={{ padding: "6px 9px", borderRadius: 999, background: `${statusColor(record.status)}18`, color: statusColor(record.status), fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{statusLabel(record.status)}</span></div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}><button onClick={() => void loadTimeline(record.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 11px", border: "1px solid #dbe3ec", borderRadius: 8, background: "#f8fafc", color: "#142846", fontSize: 12, fontWeight: 800 }}><FileText size={15} aria-hidden="true" />{expanded === record.id ? "Hide timeline" : "View timeline"}</button><button onClick={() => void shareReferral(record)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 11px", border: "1px solid #b8e5e0", borderRadius: 8, background: "#e3f5f3", color: "#0f766e", fontSize: 12, fontWeight: 800 }}><Share2 size={15} aria-hidden="true" />Share summary</button></div>{!record.accessOutcome && record.status !== "denied" && Date.now() - record.createdAt > 24 * 60 * 60 * 1000 && <OutcomeSelfReport caseId={record.id} onDone={() => setCases((current) => current.map((item) => item.id === record.id ? { ...item, accessOutcome: "reported" } : item))} />}{record.accessOutcome === "reported" && <p role="status" style={{ marginTop: 12, fontSize: 13, color: "#0f766e", fontWeight: 700 }}>Thanks — your answer helps us fix what gets in the way.</p>}{expanded === record.id && <div style={{ marginTop: 14, padding: 13, borderRadius: 9, background: "#f8fafc" }}>{timeline[record.id]?.length ? <div style={{ display: "grid", gap: 11 }}>{timeline[record.id].map((event, index) => <div key={`${event.eventType}-${event.createdAt}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 9, alignItems: "start" }}><div style={{ width: 12, height: 12, marginTop: 3, borderRadius: "50%", background: index === timeline[record.id].length - 1 ? "var(--zs-color-brand)" : "#94a3b8" }} /><div><div style={{ fontSize: 13, fontWeight: 800, color: "#142846" }}>{eventLabel(event.eventType)}</div><div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{new Date(event.createdAt).toLocaleString()}</div>{event.note && <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>{event.note}</div>}</div></div>)}</div> : <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12 }}><CalendarDays size={15} aria-hidden="true" /><span role="status">Loading event details…</span></div>}</div>}<div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #eef2f7" }}><button onClick={() => setError("Provider contact is available from the live Resource Detail screen.")} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", color: "#0f766e", fontSize: 12, fontWeight: 800 }}><Phone size={14} aria-hidden="true" />Call provider</button><span style={{ color: "#cbd5e1" }}>|</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12 }}><CheckCircle2 size={14} aria-hidden="true" />Client-safe view</span></div></article>)}</div>}
      </main>
    </div>
  );
}
