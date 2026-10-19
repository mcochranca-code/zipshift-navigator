import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, FileText, Phone, Share2, XCircle } from "lucide-react";

interface CaseRecord {
  id: string;
  caseNumber: string;
  clientName: string;
  serviceCategory: string;
  status: "new" | "in_progress" | "pending" | "completed" | "denied" | "closed";
  priority: "low" | "standard" | "high" | "urgent";
  createdAt: number;
  updatedAt: number;
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
        {loading ? <section style={{ padding: 48, textAlign: "center", background: "#ffffff", border: "1px solid #dbe3ec", borderRadius: 12, color: "#64748b" }}>Loading your live referral history…</section> : cases.length === 0 ? <section style={{ padding: "44px 22px", textAlign: "center", background: "#ffffff", border: "1px solid #dbe3ec", borderRadius: 12 }}><div style={{ width: 56, height: 56, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}><ClipboardList size={29} strokeWidth={1.8} aria-hidden="true" /></div><h2 style={{ margin: 0, fontSize: 18 }}>No referrals yet</h2><p style={{ margin: "8px auto 0", maxWidth: 400, color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>When you submit an intake or confirm a referral destination, your live case record will appear here.</p></section> : <div style={{ display: "grid", gap: 12 }}>{cases.map((record) => <article key={record.id} style={{ background: "#ffffff", border: "1px solid #dbe3ec", borderLeft: `4px solid ${statusColor(record.status)}`, borderRadius: 12, padding: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><div><div style={{ fontSize: 12, fontWeight: 900, color: "#0f766e", letterSpacing: 0.7 }}>{record.caseNumber}</div><h2 style={{ margin: "5px 0 0", fontSize: 16 }}>{record.serviceCategory}</h2><div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Submitted {new Date(record.createdAt).toLocaleDateString()}</div></div><span style={{ padding: "6px 9px", borderRadius: 999, background: `${statusColor(record.status)}18`, color: statusColor(record.status), fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>{statusLabel(record.status)}</span></div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}><button onClick={() => void loadTimeline(record.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 11px", border: "1px solid #dbe3ec", borderRadius: 8, background: "#f8fafc", color: "#142846", fontSize: 12, fontWeight: 800 }}><FileText size={15} aria-hidden="true" />{expanded === record.id ? "Hide timeline" : "View timeline"}</button><button onClick={() => void shareReferral(record)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 11px", border: "1px solid #b8e5e0", borderRadius: 8, background: "#e3f5f3", color: "#0f766e", fontSize: 12, fontWeight: 800 }}><Share2 size={15} aria-hidden="true" />Share summary</button></div>{expanded === record.id && <div style={{ marginTop: 14, padding: 13, borderRadius: 9, background: "#f8fafc" }}>{timeline[record.id]?.length ? <div style={{ display: "grid", gap: 11 }}>{timeline[record.id].map((event, index) => <div key={`${event.eventType}-${event.createdAt}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 9, alignItems: "start" }}><div style={{ width: 12, height: 12, marginTop: 3, borderRadius: "50%", background: index === timeline[record.id].length - 1 ? "#159d92" : "#94a3b8" }} /><div><div style={{ fontSize: 13, fontWeight: 800, color: "#142846" }}>{eventLabel(event.eventType)}</div><div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>{new Date(event.createdAt).toLocaleString()}</div>{event.note && <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>{event.note}</div>}</div></div>)}</div> : <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontSize: 12 }}><CalendarDays size={15} />Loading event details…</div>}</div>}<div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #eef2f7" }}><button onClick={() => setError("Provider contact is available from the live Resource Detail screen.")} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", color: "#0f766e", fontSize: 12, fontWeight: 800 }}><Phone size={14} aria-hidden="true" />Call provider</button><span style={{ color: "#cbd5e1" }}>|</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 12 }}><CheckCircle2 size={14} aria-hidden="true" />Client-safe view</span></div></article>)}</div>}
      </main>
    </div>
  );
}
