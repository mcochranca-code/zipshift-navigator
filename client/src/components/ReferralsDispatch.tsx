import React from "react";
import { ArrowDownAZ, ArrowLeft, Bell, ChevronDown, Download, FileDown, Filter, Plus, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type DispatchCase = { id: string; caseNumber: string; clientName?: string | null; serviceCategory: string; status: string; priority: string; createdAt: number; updatedAt: number; assignedName?: string | null };
type Summary = { totalCases: number; openCases: number; completedCases: number; completionRate: number };
type ReferralsDispatchProps = { onBack: () => void; onNewReferral: () => void; onNotifications: () => void };
const statuses = ["all", "new", "in_progress", "pending", "completed", "closed", "denied"];
const priorities = ["all", "urgent", "high", "standard", "low"];
const sortOptions = ["updated-desc", "updated-asc", "created-desc", "priority-desc", "client-asc"];
const priorityRank: Record<string, number> = { urgent: 4, high: 3, standard: 2, low: 1 };
const formatStatus = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
}

function exportPdf(cases: DispatchCase[], summary: Summary | null) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 42;
  let y = 48;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("ZipShift Referral Dispatch Report", margin, y);
  y += 22;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 105, 125);
  pdf.text(`Generated ${new Date().toLocaleString()} · ${cases.length} visible referrals`, margin, y);
  y += 22;
  if (summary) {
    pdf.setTextColor(20, 40, 70);
    pdf.text(`Open: ${summary.openCases}   Total: ${summary.totalCases}   Completed: ${summary.completedCases}   Completion: ${summary.completionRate}%`, margin, y);
    y += 24;
  }
  pdf.setDrawColor(220, 230, 238);
  pdf.line(margin, y, 570, y);
  y += 18;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text("REFERRAL", margin, y);
  pdf.text("CLIENT", 125, y);
  pdf.text("SERVICE", 245, y);
  pdf.text("PRIORITY", 390, y);
  pdf.text("STATUS", 465, y);
  y += 14;
  pdf.setFont("helvetica", "normal");
  cases.forEach((item) => {
    if (y > 745) { pdf.addPage(); y = 48; }
    pdf.setTextColor(20, 40, 70);
    pdf.text(item.caseNumber.slice(0, 18), margin, y);
    pdf.text((item.clientName || "Protected record").slice(0, 18), 125, y);
    pdf.text(item.serviceCategory.slice(0, 22), 245, y);
    pdf.text(formatStatus(item.priority), 390, y);
    pdf.text(formatStatus(item.status), 465, y);
    y += 16;
  });
  pdf.save("zipshift-referral-dispatch-report.pdf");
}

export default function ReferralsDispatch({ onBack, onNewReferral, onNotifications }: ReferralsDispatchProps) {
  const [cases, setCases] = useState<DispatchCase[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [sortBy, setSortBy] = useState("updated-desc");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const load = async () => { setLoading(true); setError(""); try { const [caseResponse, summaryResponse] = await Promise.all([fetch(`/api/staff/cases${status === "all" ? "" : `?status=${encodeURIComponent(status)}`}`, { credentials: "include" }), fetch("/api/staff/reports/summary", { credentials: "include" })]); if (!caseResponse.ok || !summaryResponse.ok) throw new Error("Staff authorization is required to view referral dispatch."); const casePayload = await caseResponse.json() as { cases?: DispatchCase[] }; const summaryPayload = await summaryResponse.json() as { summary?: Summary }; setCases(casePayload.cases || []); setSummary(summaryPayload.summary || null); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load referral dispatch."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [status]);
  const visibleCases = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return cases.filter((item) => (priority === "all" || item.priority === priority) && `${item.caseNumber} ${item.clientName || ""} ${item.serviceCategory} ${item.assignedName || ""}`.toLowerCase().includes(normalized)).sort((a, b) => {
      if (sortBy === "updated-asc") return (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt);
      if (sortBy === "created-desc") return b.createdAt - a.createdAt;
      if (sortBy === "priority-desc") return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      if (sortBy === "client-asc") return (a.clientName || "Protected record").localeCompare(b.clientName || "Protected record");
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });
  }, [cases, priority, query, sortBy]);
  const exportCsv = async () => { setExporting("csv"); try { const response = await fetch("/api/staff/reports/export", { credentials: "include" }); if (!response.ok) throw new Error("Unable to export the CSV report."); downloadBlob(await response.blob(), "zipshift-referral-dispatch-report.csv"); } catch (exportError) { setError(exportError instanceof Error ? exportError.message : "Unable to export the CSV report."); } finally { setExporting(null); } };
  return <main className="zipshift-dispatch" aria-labelledby="dispatch-title">
    <header className="zipshift-dispatch-header"><button type="button" className="zipshift-icon-button" onClick={onBack} aria-label="Back to portal"><ArrowLeft size={19} /></button><div className="zipshift-dispatch-heading"><span className="zipshift-kicker">STAFF WORKSPACE</span><h1 id="dispatch-title">Referrals Dispatch</h1><p>Direct verified citizens to optimized partner pipelines and track resolution logs.</p></div><div className="zipshift-dispatch-actions"><button type="button" className="zipshift-icon-button" onClick={onNotifications} aria-label="Open notifications"><Bell size={18} /></button><button type="button" className="zipshift-primary-button" onClick={onNewReferral}><Plus size={16} /> New referral</button></div></header>
    <nav className="zipshift-staff-tabs" aria-label="Staff workspace tabs"><button type="button" className="active">Referrals</button><button type="button" onClick={onNewReferral}>Intake</button><button type="button" onClick={onNotifications}>Notifications</button><button type="button" onClick={onBack}>Portal</button></nav>
    {summary && <section className="zipshift-kpi-grid" aria-label="Referral summary"><div><small>OPEN REFERRALS</small><strong>{summary.openCases}</strong><span>Current active queue</span></div><div><small>ALL CASES</small><strong>{summary.totalCases}</strong><span>Live case ledger</span></div><div><small>COMPLETED</small><strong>{summary.completedCases}</strong><span>{summary.completionRate}% completion rate</span></div><div><small>DIRECTORY</small><strong>Verified</strong><span>Provider hours remain source-controlled</span></div></section>}
    <section className="zipshift-dispatch-toolbar"><div className="zipshift-search-control"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search case, client, service, or assignee" aria-label="Search referrals" /></div><label className="zipshift-select-control"><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter referrals by status">{statuses.map((option) => <option key={option} value={option}>{option === "all" ? "All statuses" : formatStatus(option)}</option>)}</select><ChevronDown size={14} /></label><label className="zipshift-select-control"><SlidersHorizontal size={15} /><select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter referrals by priority">{priorities.map((option) => <option key={option} value={option}>{option === "all" ? "All priorities" : formatStatus(option)}</option>)}</select><ChevronDown size={14} /></label><label className="zipshift-select-control"><ArrowDownAZ size={15} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort referrals">{sortOptions.map((option) => <option key={option} value={option}>{option === "updated-desc" ? "Recently updated" : option === "updated-asc" ? "Oldest updated" : option === "created-desc" ? "Newest created" : option === "priority-desc" ? "Highest priority" : "Client A–Z"}</option>)}</select><ChevronDown size={14} /></label><button type="button" className="zipshift-secondary-button" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button><button type="button" className="zipshift-icon-button" aria-label="Advanced filters" onClick={() => { setPriority("all"); setSortBy("updated-desc"); }}><SlidersHorizontal size={17} /></button></section>
    <section className="zipshift-dispatch-export-bar" aria-label="Export referral reports"><span>{visibleCases.length} visible interaction{visibleCases.length === 1 ? "" : "s"}</span><div><button type="button" className="zipshift-secondary-button" onClick={() => void exportCsv()} disabled={Boolean(exporting)}><Download size={15} /> {exporting === "csv" ? "Preparing CSV…" : "Download CSV"}</button><button type="button" className="zipshift-secondary-button" onClick={() => { setExporting("pdf"); exportPdf(visibleCases, summary); setExporting(null); }} disabled={Boolean(exporting)}><FileDown size={15} /> {exporting === "pdf" ? "Preparing PDF…" : "Download PDF"}</button></div></section>
    {error && <div className="zipshift-inline-alert" role="alert">{error}</div>}
    <section className="zipshift-dispatch-table-wrap" aria-live="polite">{loading ? <div className="zipshift-dispatch-skeleton" aria-label="Loading referrals"><span /><span /><span /><span /><span /></div> : visibleCases.length === 0 ? <div className="zipshift-empty-state">No referrals match the selected filters.</div> : <table className="zipshift-dispatch-table"><thead><tr><th>Referral ID</th><th>Client</th><th>Referred to</th><th>Priority</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{visibleCases.map((item) => <tr key={item.id}><td><strong>{item.caseNumber}</strong></td><td>{item.clientName || "Client record protected"}</td><td>{item.serviceCategory}</td><td><span className={`zipshift-priority priority-${item.priority}`}>{formatStatus(item.priority)}</span></td><td><span className={`zipshift-case-status status-${item.status}`}>{formatStatus(item.status)}</span></td><td>{new Date(item.updatedAt || item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>}</section>
  </main>;
}
