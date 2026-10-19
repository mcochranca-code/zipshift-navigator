import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, ClipboardCheck, ClipboardList, Download, FileJson, FlaskConical, FolderKanban, ImageDown, LayoutDashboard, MessageSquare, Send, Settings2, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import YellowBookEncounter from "./YellowBookEncounter";
import AdminControlCenter from "./AdminControlCenter";

type StaffRole = "admin" | "researcher";
type StaffSection = "overview" | "navigator" | "directory" | "cases" | "research" | "yellowbook" | "reports" | "team";

const sectionIcons: Record<StaffSection, LucideIcon> = { overview: LayoutDashboard, navigator: UsersRound, directory: FolderKanban, cases: ClipboardList, research: FlaskConical, yellowbook: BookOpen, reports: BarChart3, team: Settings2 };

interface WorkspaceUser {
  id: string;
  email: string;
  displayName: string;
  role: StaffRole | "client";
}

interface CaseRecord {
  id: string;
  caseNumber: string;
  clientName: string;
  clientEmail: string | null;
  providerId: string | null;
  serviceCategory: string;
  status: "new" | "in_progress" | "pending" | "completed" | "denied" | "closed";
  priority: "low" | "standard" | "high" | "urgent";
  assignedTo: string | null;
  studyId?: string | null;
  resolutionNotes: string;
  createdAt: number;
  updatedAt: number;
}

interface DirectoryResource {
  id: string;
  sourceId: string;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  verified: boolean;
  hsaiScore: number;
  requiredDocs: string[];
}

interface ReportSummary {
  summary: {
    totalCases: number;
    openCases: number;
    completedCases: number;
    completionRate: number;
    totalDirectoryResources: number;
    verifiedDirectoryResources: number;
    averageHsai: number;
  };
  byStatus: Record<string, number>;
  events: Array<{ eventType: string; count: number }>;
}

interface ZipDemandReport {
  periodDays: number;
  minimumCohort: number;
  methodology: string;
  demand: Array<{ zipCode: string; searchCount: number | null; suppressed: boolean }>;
}

interface FieldTestReport {
  periodDays: number;
  privacy: string;
  events: Array<{ eventType: string; count: number; participants: number }>;
  history: Array<{ date: string; guidedStart: number; guidedCompletion: number; guidedDropoff: number; completionRate: number; dropoffRate: number }>;
}

interface StudyRecord { id: string; studyKey: string; title: string; description: string | null; status: string; protocolVersion: string; }
interface ResearchParticipant { id: string; pseudonym: string; enrollmentStatus: "enrolled" | "withdrawn"; caseNumber: string; consentedAt: number; withdrawnAt: number | null; retentionUntil: number | null; assessmentCount: number; lastAssessmentAt: number | null; createdAt: number; updatedAt: number; }
interface ResearchConfig { dictionaries: Array<{ id: string; version: string; title: string; status: string; variableCount?: number }>; instruments: Array<{ id: string; instrumentKey: string; version: string; title: string; status: string; itemCount?: number }>; protocols: Array<{ id: string; version: string; title: string; status: string }>; consentDocuments: Array<{ id: string; purpose: string; version: string; language: string; title: string; status: string }>; readOnly: boolean; }
interface ResearchAssessment { id: string; instrumentKey: string; instrumentVersion: string; responses: Record<string, unknown>; score: number | null; status: string; createdAt: number; }

interface StaffWorkspaceProps {
  role: StaffRole;
  onBack: () => void;
  onSessionChange?: (user: WorkspaceUser | null) => void;
}

const STATUS_OPTIONS = ["new", "in_progress", "pending", "completed", "denied", "closed"] as const;
const PRIORITY_OPTIONS = ["low", "standard", "high", "urgent"] as const;
const ZIPSHIFT_LOGO = "/manus-storage/zipshift_logo_cleaned_354ed835.png";

const sectionLabels: Record<StaffSection, string> = {
  overview: "Analytics",
  navigator: "Navigator",
  directory: "Directory",
  cases: "Cases",
  research: "Research",
  reports: "Reports",
  team: "Admin Control",
  yellowbook: "YellowBook",
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function statusClass(status: string) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "denied") return "bg-rose-100 text-rose-700";
  if (status === "in_progress") return "bg-sky-100 text-sky-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "closed") return "bg-slate-200 text-slate-700";
  return "bg-teal-100 text-teal-700";
}

function downloadHighResolutionPng(svg: string, filename: string, width: number, height: number) {
  const image = new Image();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  image.onload = () => {
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) { URL.revokeObjectURL(objectUrl); return; }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((output) => {
      if (!output) { URL.revokeObjectURL(objectUrl); return; }
      const downloadUrl = URL.createObjectURL(output);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => { URL.revokeObjectURL(downloadUrl); URL.revokeObjectURL(objectUrl); }, 1000);
    }, "image/png");
  };
  image.onerror = () => URL.revokeObjectURL(objectUrl);
  image.src = objectUrl;
}

function escapeXml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] || character);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.text();
  let parsed: any = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    throw new Error("The server returned an unexpected response.");
  }
  if (!response.ok) throw new Error(parsed?.error || "Request failed.");
  return parsed as T;
}

function LoginPanel({ role, onAuthenticated, onBack }: { role: StaffRole; onAuthenticated: () => void; onBack: () => void }) {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (role !== "admin") {
      setLoading(false);
      return;
    }
    requestJson<{ needsAdminSetup: boolean }>("/api/setup/status")
      .then((data) => setNeedsSetup(data.needsAdminSetup))
      .catch(() => setError("Unable to check administrator setup."))
      .finally(() => setLoading(false));
  }, [role]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestJson(needsSetup ? "/api/setup/admin" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsSetup ? { displayName: name, email, password } : { email, password }),
      });
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-5 py-10 flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-7">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#159d92] p-2"><img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" className="h-full w-full object-contain brightness-0 invert" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#159d92]">ZipShift {role === "admin" ? "Admin Portal" : "Research Portal"}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#142846]">{needsSetup ? "Set up the first administrator" : `Sign in to ${role === "admin" ? "Admin" : "Researcher"} workspace`}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{needsSetup ? "Create the first administrator account. New staff accounts are then created inside the protected Admin workspace." : "Use your database-backed staff account. Sessions are securely persisted after sign-in."}</p>
        </div>
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
        {loading ? <div className="py-8 text-center text-sm text-slate-500">Checking workspace access…</div> : <>
          {needsSetup && <label className="mb-4 block text-sm font-semibold text-slate-700">Display name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="Operations lead" /></label>}
          <label className="mb-4 block text-sm font-semibold text-slate-700">Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="name@organization.org" /></label>
          <label className="mb-6 block text-sm font-semibold text-slate-700">Password<input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="At least 12 characters" /></label>
          <button disabled={submitting} className="w-full rounded-lg bg-[#159d92] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0d8077] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Working…" : needsSetup ? "Create administrator" : "Sign in"}</button>
          <button type="button" onClick={onBack} className="mt-3 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Back to Navigator</button>
        </>}
      </form>
    </div>
  );
}

export default function StaffWorkspace({ role, onBack, onSessionChange }: StaffWorkspaceProps) {
  const [user, setUser] = useState<WorkspaceUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeSection, setActiveSection] = useState<StaffSection>(role === "admin" ? "cases" : "overview");
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [fhirCase, setFhirCase] = useState<CaseRecord | null>(null);
  const [yellowBookCase, setYellowBookCase] = useState<CaseRecord | null>(null);
  const [caseStatus, setCaseStatus] = useState("all");
  const [directory, setDirectory] = useState<DirectoryResource[]>([]);
  const [directorySearch, setDirectorySearch] = useState("");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [zipDemand, setZipDemand] = useState<ZipDemandReport | null>(null);
  const [fieldTest, setFieldTest] = useState<FieldTestReport | null>(null);
  const [studies, setStudies] = useState<StudyRecord[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const [researchParticipants, setResearchParticipants] = useState<ResearchParticipant[]>([]);
  const [researchConfig, setResearchConfig] = useState<ResearchConfig | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedAssessments, setSelectedAssessments] = useState<ResearchAssessment[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState({ displayName: "", email: "", password: "", role: "researcher" });
  const [teamMessage, setTeamMessage] = useState<string | null>(null);

  const navigation = useMemo<StaffSection[]>(() => role === "admin" ? ["overview", "navigator", "directory", "cases", "research", "yellowbook", "reports", "team"] : ["overview", "navigator", "cases", "research", "yellowbook", "reports"], [role]);

  const loadSession = async () => {
    setCheckingSession(true);
    try {
      const data = await requestJson<{ user: WorkspaceUser }>("/api/auth/me");
      setUser(data.user);
      onSessionChange?.(data.user);
      if (data.user.role !== role) setError(`This account is not authorized for the ${role} workspace.`);
      else setActiveSection(role === "admin" ? "team" : "overview");
    } catch {
      setUser(null);
      onSessionChange?.(null);
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => { void loadSession(); }, []);

  const loadCases = async () => {
    setLoadingData(true);
    try {
      const query = activeSection === "navigator" || activeSection === "research" || caseStatus === "all" ? "" : `?status=${caseStatus}`;
      const data = await requestJson<{ cases: CaseRecord[] }>(`/api/staff/cases${query}`);
      setCases(data.cases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load cases.");
    } finally { setLoadingData(false); }
  };

  const loadDirectory = async () => {
    setLoadingData(true);
    try {
      const search = directorySearch ? `?search=${encodeURIComponent(directorySearch)}` : "";
      const data = await requestJson<{ resources: DirectoryResource[] }>(`/api/directory${search}`);
      setDirectory(data.resources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the directory.");
    } finally { setLoadingData(false); }
  };

  const loadReport = async () => {
    setLoadingData(true);
    try {
      const [data, zipData, fieldTestData] = await Promise.all([
        requestJson<ReportSummary>("/api/staff/reports/summary"),
        requestJson<ZipDemandReport>("/api/staff/reports/zip-demand"),
        requestJson<FieldTestReport>("/api/staff/reports/field-test"),
      ]);
      setReport(data);
      setZipDemand(zipData);
      setFieldTest(fieldTestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports.");
    } finally { setLoadingData(false); }
  };

  const loadResearch = async () => {
    setLoadingData(true);
    try {
      const studyData = await requestJson<{ studies: StudyRecord[] }>("/api/research/studies");
      setStudies(studyData.studies);
      const studyId = studyData.studies.find((study) => study.id === selectedStudyId)?.id || studyData.studies[0]?.id || "";
      setSelectedStudyId(studyId);
      if (studyId) {
        const [participantData, configData] = await Promise.all([
          requestJson<{ participants: ResearchParticipant[] }>(`/api/research/studies/${studyId}/participant-controls`),
          requestJson<ResearchConfig>(`/api/research/studies/${studyId}/research-config`),
        ]);
        setResearchParticipants(participantData.participants);
        setResearchConfig(configData);
      } else {
        setResearchParticipants([]); setResearchConfig(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load research workspace.");
    } finally { setLoadingData(false); }
  };

  const loadParticipantAssessments = async (participantId: string) => {
    if (!participantId) { setSelectedAssessments([]); return; }
    try {
      const data = await requestJson<{ assessments: ResearchAssessment[] }>(`/api/research/participant-controls/${participantId}/assessments`);
      setSelectedAssessments(data.assessments);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load assessment history."); }
  };

  useEffect(() => {
    if (!user || user.role !== role) return;
    if (activeSection === "cases" || activeSection === "yellowbook" || activeSection === "navigator" || activeSection === "research") void loadCases();
    if (activeSection === "directory") void loadDirectory();
    if (activeSection === "overview" || activeSection === "reports") void loadReport();
    if (activeSection === "research") void loadResearch();
  }, [user, role, activeSection, caseStatus]);

  useEffect(() => { if (activeSection === "research" && selectedStudyId) void loadResearch(); }, [selectedStudyId]);
  useEffect(() => { void loadParticipantAssessments(selectedParticipantId); }, [selectedParticipantId]);

  const updateCase = async () => {
    if (!selectedCase) return;
    try {
      await requestJson(`/api/staff/cases/${selectedCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedCase.status, priority: selectedCase.priority, resolutionNotes: selectedCase.resolutionNotes }),
      });
      setSelectedCase(null);
      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update case.");
    }
  };

  const advanceNavigatorCase = async (record: CaseRecord) => {
    const nextStatus: Record<string, CaseRecord["status"]> = { new: "in_progress", in_progress: "pending", pending: "completed" };
    const status = nextStatus[record.status];
    if (!status) return;
    try {
      await requestJson(`/api/staff/cases/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, resolutionNotes: `Navigator stage advanced to ${status.replaceAll("_", " ")}.` }) });
      await loadCases();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to advance the referral stage."); }
  };

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setTeamMessage(null);
    try {
      await requestJson("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm),
      });
      setTeamMessage("Staff account created. The new user can now sign in through their workspace.");
      setTeamForm({ displayName: "", email: "", password: "", role: "researcher" });
    } catch (err) { setTeamMessage(err instanceof Error ? err.message : "Unable to create the staff account."); }
  };

  const logout = async () => {
    await requestJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  };

  if (checkingSession) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-500">Loading secure workspace…</div>;
  if (!user || user.role !== role) return <LoginPanel role={role} onAuthenticated={() => { setActiveSection(role === "admin" ? "team" : "overview"); void loadSession(); }} onBack={onBack} />;

  const title = activeSection === "overview" ? "Researcher Analytics" : activeSection === "navigator" ? "Navigator Caseload" : activeSection === "directory" ? "Service Directory" : activeSection === "cases" ? (role === "admin" ? "Referrals & Cases" : "Research Cases") : activeSection === "research" ? "Research & Data" : activeSection === "yellowbook" ? "YellowBook Encounter" : activeSection === "reports" ? "Reports & Exports" : "Role-based Staff Access";
  const subtitle = activeSection === "overview" ? "Analyze live case activity, provider coverage, and HSAI-ready event signals." : activeSection === "navigator" ? "Coordinate pseudonymized caseloads, referral stages, secure chat, and FHIR previews." : activeSection === "directory" ? "Browse the imported Stanislaus and Turlock resource directory, with provenance retained." : activeSection === "cases" ? "Track secure service requests, assign outcomes, and close the loop on access." : activeSection === "research" ? "Enroll consented participants, collect versioned measures, and preserve retention controls." : activeSection === "yellowbook" ? "Open a Ceramic-style, case-linked encounter record with adaptive HSAI prompts." : activeSection === "reports" ? "Generate audit-ready summaries and export real case activity." : "Create restricted Administrator and Researcher accounts.";

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#142846] lg:flex">
      <aside className="flex shrink-0 flex-col bg-[#182d4d] px-5 py-7 text-white lg:sticky lg:top-0 lg:h-screen lg:w-[280px]">
        <div className="mb-12 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#159d92] p-2"><img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" className="h-full w-full object-contain brightness-0 invert" /></div><div><div className="text-lg font-black tracking-tight">ZipShift</div><div className="text-[10px] font-bold tracking-[0.16em] text-teal-300">{role === "admin" ? "ADMIN PORTAL" : "RESEARCH PORTAL"}</div></div></div>
        <nav className="flex gap-2 overflow-x-auto pb-5 lg:flex-col lg:overflow-visible">
          {navigation.map((item) => { const Icon = sectionIcons[item]; return <button key={item} onClick={() => setActiveSection(item)} className={`flex min-w-max items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-bold transition ${activeSection === item ? "bg-[#159d92] text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon size={17} aria-hidden="true" />{sectionLabels[item]}</button>; })}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 pt-5 lg:block"><p className="text-sm font-bold">{user.displayName}</p><p className="mt-1 text-xs text-slate-400">{user.role === "admin" ? "Principal Administrator" : "Lead Researcher"}</p><button onClick={() => void logout()} className="mt-4 text-xs font-bold text-teal-300 hover:text-white">Sign out</button></div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
        <header className="mb-6 border-b border-slate-200 pb-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-[#148d84]">{user.displayName}</span><button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Exit workspace</button></div></div></header>
        {error && <div className="mb-5 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button onClick={() => setError(null)} className="font-bold">×</button></div>}

        {activeSection === "overview" && <AnalyticsPanel report={report} fieldTest={fieldTest} loading={loadingData} onOpenReports={() => setActiveSection("reports")} onOpenCases={() => setActiveSection("cases")} />}
        {activeSection === "navigator" && <NavigatorPanel cases={cases} loading={loadingData} onAdvance={(record) => void advanceNavigatorCase(record)} onSelect={(record) => setSelectedCase({ ...record })} onOpenFhir={(record) => { setFhirCase(record); void requestJson("/api/staff/navigator-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: record.id, eventType: "NAVIGATOR_FHIR_PREVIEWED", details: { caseNumber: record.caseNumber } }) }).catch((err) => setError(err instanceof Error ? err.message : "Unable to log the FHIR preview.")); }} />}
        {activeSection === "directory" && <DirectoryPanel loading={loadingData} resources={directory} search={directorySearch} onSearch={setDirectorySearch} onSubmit={() => void loadDirectory()} />}
        {activeSection === "cases" && <CasesPanel cases={cases} loading={loadingData} filter={caseStatus} onFilter={setCaseStatus} onSelect={setSelectedCase} onOpenYellowBook={(record) => { setYellowBookCase(record); setActiveSection("yellowbook"); }} />}
        {activeSection === "research" && <ResearchConsole studies={studies} selectedStudyId={selectedStudyId} onStudyChange={(value) => { setSelectedStudyId(value); setSelectedParticipantId(""); }} config={researchConfig} participants={researchParticipants} cases={cases.filter((record) => record.studyId === selectedStudyId)} loading={loadingData} selectedParticipantId={selectedParticipantId} onParticipantChange={setSelectedParticipantId} assessments={selectedAssessments} onRefresh={() => { void loadResearch(); if (selectedParticipantId) void loadParticipantAssessments(selectedParticipantId); }} onError={setError} />}
        {activeSection === "yellowbook" && (yellowBookCase ? <YellowBookEncounter caseId={yellowBookCase.id} caseNumber={yellowBookCase.caseNumber} clientName={yellowBookCase.clientName} serviceCategory={yellowBookCase.serviceCategory} onBack={() => setActiveSection("cases")} /> : <YellowBookLauncher cases={cases} loading={loadingData} onOpen={(record) => setYellowBookCase(record)} />)}
        {activeSection === "reports" && <ReportsPanel report={report} zipDemand={zipDemand} loading={loadingData} onExport={() => window.open("/api/staff/reports/export", "_blank", "noopener,noreferrer")} />}
        {activeSection === "team" && <div className="space-y-6"><TeamPanel form={teamForm} message={teamMessage} onChange={setTeamForm} onSubmit={createStaff} /><AdminControlCenter /></div>}
      </main>

      {selectedCase && <CaseDetailModal caseRecord={selectedCase} onChange={setSelectedCase} onClose={() => setSelectedCase(null)} onSave={() => void updateCase()} />}
      {fhirCase && <FhirPreviewModal record={fhirCase} onClose={() => setFhirCase(null)} />}
    </div>
  );
}

function MetricCard({ label, value, detail, tone = "teal" }: { label: string; value: string | number; detail: string; tone?: "teal" | "amber" | "sky" | "rose" }) {
  const tones = { teal: "bg-teal-50 text-[#148d84]", amber: "bg-amber-50 text-amber-700", sky: "bg-sky-50 text-sky-700", rose: "bg-rose-50 text-rose-700" };
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={`rounded-md px-2 py-1 text-xs font-black ${tones[tone]}`}>●</span></div><p className="mt-4 text-3xl font-black tracking-tight">{value}</p><p className="mt-2 text-sm text-slate-500">{detail}</p></div>;
}

function AnalyticsPanel({ report, fieldTest, loading, onOpenReports, onOpenCases }: { report: ReportSummary | null; fieldTest: FieldTestReport | null; loading: boolean; onOpenReports: () => void; onOpenCases: () => void }) {
  if (loading && !report) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading analytics…</div>;
  const summary = report?.summary || { totalCases: 0, openCases: 0, completedCases: 0, completionRate: 0, totalDirectoryResources: 0, verifiedDirectoryResources: 0, averageHsai: 0 };
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total Cases" value={summary.totalCases} detail="All recorded service requests" /><MetricCard label="Open Cases" value={summary.openCases} detail="New, active, or pending review" tone="amber" /><MetricCard label="Completion Rate" value={`${summary.completionRate}%`} detail="Closed as completed" tone="sky" /><MetricCard label="Directory Coverage" value={summary.totalDirectoryResources} detail={`${summary.verifiedDirectoryResources} verified imported resources`} tone="teal" /></div>
    <FieldTestCharts report={fieldTest} />
    <FieldTestTrendCharts history={fieldTest?.history || []} />
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Case status distribution</h2><p className="mt-1 text-sm text-slate-500">Live counts calculated from your secure referral records.</p></div><button onClick={onOpenCases} className="text-sm font-bold text-[#148d84]">Open cases →</button></div><div className="mt-7 space-y-4">{Object.entries(report?.byStatus || {}).length ? Object.entries(report?.byStatus || {}).map(([status, count]) => <div key={status} className="flex items-center gap-4"><div className="w-28 text-sm capitalize text-slate-600">{status.replace("_", " ")}</div><div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#159d92]" style={{ width: `${Math.max(8, summary.totalCases ? (count / summary.totalCases) * 100 : 0)}%` }} /></div><div className="w-8 text-right text-sm font-black">{count}</div></div>) : <p className="py-8 text-sm text-slate-500">No cases have been submitted yet. New client intake requests will appear here.</p>}</div></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black">Event quality signals</h2><p className="mt-1 text-sm text-slate-500">Event taxonomy captured across cases.</p><div className="mt-6 space-y-3">{report?.events.length ? report.events.map((event) => <div key={event.eventType} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3"><span className="text-xs font-bold text-slate-600">{event.eventType}</span><span className="text-sm font-black text-[#148d84]">{event.count}</span></div>) : <p className="py-8 text-sm text-slate-500">Events will appear as clients and staff interact with cases.</p>}</div><button onClick={onOpenReports} className="mt-6 w-full rounded-lg border border-[#159d92] px-4 py-2.5 text-sm font-bold text-[#148d84] hover:bg-teal-50">Open reports</button></section></div>
  </div>;
}

function FieldTestCharts({ report }: { report: FieldTestReport | null }) {
  const counts = Object.fromEntries((report?.events || []).map((event) => [event.eventType, event.count]));
  const starts = counts.guided_start || 0;
  const completions = counts.guided_completion || 0;
  const dropoffs = counts.guided_dropoff || 0;
  const completionRate = starts ? Math.min(100, Math.round((completions / starts) * 100)) : 0;
  const dropoffRate = starts ? Math.min(100, Math.round((dropoffs / starts) * 100)) : 0;
  const max = Math.max(starts, completions, dropoffs, 1);
  const bars = [{ label: "Started", value: starts, color: "#159d92" }, { label: "Completed", value: completions, color: "#2563eb" }, { label: "Dropped off", value: dropoffs, color: "#f59e0b" }];
  return <section aria-labelledby="field-test-chart-title" className="rounded-xl border border-slate-200 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="field-test-chart-title" className="text-lg font-black">Guided Access completion funnel</h2><p className="mt-1 text-sm text-slate-500">Anonymous field-test events aggregated over the last {report?.periodDays || 30} days.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Counts only · privacy-safe</span></div>
    <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div role="img" aria-label={`Guided Access funnel: ${starts} started, ${completions} completed, ${dropoffs} dropped off`} className="space-y-4">
        {bars.map((bar) => <div key={bar.label} className="grid grid-cols-[92px_1fr_52px] items-center gap-3"><span className="text-sm font-semibold text-slate-600">{bar.label}</span><div className="h-8 overflow-hidden rounded-md bg-slate-100"><div className="flex h-full items-center rounded-md px-3 text-xs font-black text-white transition-all" style={{ width: `${Math.max(bar.value ? 12 : 0, (bar.value / max) * 100)}%`, background: bar.color }}>{bar.value ? `${bar.value}` : ""}</div></div><span className="text-right text-sm font-black text-[#142846]">{bar.value}</span></div>)}
        <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-lg bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Completion rate</p><p className="mt-2 text-2xl font-black text-blue-900">{completionRate}%</p><p className="mt-1 text-xs text-blue-700">Completed ÷ started</p></div><div className="rounded-lg bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Drop-off rate</p><p className="mt-2 text-2xl font-black text-amber-900">{dropoffRate}%</p><p className="mt-1 text-xs text-amber-700">Dropped off ÷ started</p></div></div>
      </div>
      <div className="rounded-xl bg-slate-50 p-5"><h3 className="text-sm font-black text-[#142846]">Funnel interpretation</h3><svg viewBox="0 0 220 150" role="img" aria-label="Completion and drop-off rate comparison" className="mx-auto mt-3 h-40 w-full max-w-[260px]"><circle cx="110" cy="70" r="48" fill="none" stroke="#e2e8f0" strokeWidth="16" /><circle cx="110" cy="70" r="48" fill="none" stroke="#2563eb" strokeWidth="16" strokeDasharray={`${completionRate * 3.02} 302`} strokeLinecap="round" transform="rotate(-90 110 70)" /><circle cx="110" cy="70" r="32" fill="none" stroke="#f59e0b" strokeWidth="16" strokeDasharray={`${dropoffRate * 2.01} 201`} strokeLinecap="round" transform="rotate(-90 110 70)" /><text x="110" y="66" textAnchor="middle" className="fill-[#142846] text-[22px] font-black">{completionRate}%</text><text x="110" y="84" textAnchor="middle" className="fill-slate-500 text-[10px] font-bold">completed</text></svg><div className="space-y-2 text-xs text-slate-600"><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-600" />Outer ring: completion rate</p><p><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />Inner ring: drop-off rate</p><p className="pt-2 leading-5 text-slate-500">Use these rates to identify where guided entry needs clearer prompts or better resource handoffs. Rates are suppressed to zero when no starts are recorded.</p></div></div>
    </div>
  </section>;
}

function FieldTestTrendCharts({ history }: { history: FieldTestReport["history"] }) {
  const width = 760;
  const height = 250;
  const pad = { left: 42, right: 18, top: 22, bottom: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (history.length > 1 ? (index / (history.length - 1)) * innerWidth : innerWidth / 2);
  const rateY = (value: number) => pad.top + ((100 - Math.max(0, Math.min(100, value))) / 100) * innerHeight;
  const maxCount = Math.max(...history.map((point) => Math.max(point.guidedStart, point.guidedCompletion, point.guidedDropoff)), 1);
  const countY = (value: number) => pad.top + ((maxCount - value) / maxCount) * innerHeight;
  const line = (values: number[], yScale: (value: number) => number) => values.map((value, index) => `${x(index).toFixed(1)},${yScale(value).toFixed(1)}`).join(" ");
  const label = (date: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00Z`));
  const rateGrid = [0, 25, 50, 75, 100];
  const countGrid = [0, Math.ceil(maxCount / 2), maxCount];
  return <section aria-labelledby="field-test-trend-title" className="rounded-xl border border-slate-200 bg-white p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="field-test-trend-title" className="text-lg font-black">Trend history</h2><p className="mt-1 text-sm text-slate-500">Daily Guided Access changes across the last 30 days. Empty days remain visible so gaps are not hidden.</p></div><div className="flex flex-wrap gap-3 text-xs font-bold text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Completion rate</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Drop-off rate</span></div></div>
    {!history.length ? <p className="mt-8 rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">Trend history will appear after the first field-test events are recorded.</p> : <div className="mt-6 grid gap-8 xl:grid-cols-2">
      <div><h3 className="mb-3 text-sm font-black text-[#142846]">Rate trend (%)</h3><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily completion and drop-off rate trend" className="h-auto w-full overflow-visible">{rateGrid.map((value) => <g key={value}><line x1={pad.left} x2={width - pad.right} y1={rateY(value)} y2={rateY(value)} stroke="#e2e8f0" strokeDasharray="3 5" /><text x={pad.left - 10} y={rateY(value) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{value}%</text></g>)}<polyline points={line(history.map((point) => point.completionRate), rateY)} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> <polyline points={line(history.map((point) => point.dropoffRate), rateY)} fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{history.map((point, index) => <g key={point.date}><circle cx={x(index)} cy={rateY(point.completionRate)} r="4" fill="#2563eb"><title>{`${label(point.date)} completion: ${point.completionRate}%`}</title></circle><circle cx={x(index)} cy={rateY(point.dropoffRate)} r="4" fill="#f59e0b"><title>{`${label(point.date)} drop-off: ${point.dropoffRate}%`}</title></circle></g>)}<text x={pad.left} y={height - 8} className="fill-slate-400 text-[11px]">{label(history[0].date)}</text><text x={width - pad.right} y={height - 8} textAnchor="end" className="fill-slate-400 text-[11px]">{label(history[history.length - 1].date)}</text></svg></div>
      <div><h3 className="mb-3 text-sm font-black text-[#142846]">Event volume</h3><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily Guided Access event volume trend" className="h-auto w-full overflow-visible">{countGrid.map((value) => <g key={value}><line x1={pad.left} x2={width - pad.right} y1={countY(value)} y2={countY(value)} stroke="#e2e8f0" strokeDasharray="3 5" /><text x={pad.left - 10} y={countY(value) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{value}</text></g>)}<polyline points={line(history.map((point) => point.guidedStart), countY)} fill="none" stroke="#159d92" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><polyline points={line(history.map((point) => point.guidedCompletion), countY)} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><polyline points={line(history.map((point) => point.guidedDropoff), countY)} fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{history.map((point, index) => <g key={point.date}><circle cx={x(index)} cy={countY(point.guidedStart)} r="3" fill="#159d92"><title>{`${label(point.date)} started: ${point.guidedStart}`}</title></circle><circle cx={x(index)} cy={countY(point.guidedCompletion)} r="3" fill="#2563eb"><title>{`${label(point.date)} completed: ${point.guidedCompletion}`}</title></circle><circle cx={x(index)} cy={countY(point.guidedDropoff)} r="3" fill="#f59e0b"><title>{`${label(point.date)} dropped off: ${point.guidedDropoff}`}</title></circle></g>)}<text x={pad.left} y={height - 8} className="fill-slate-400 text-[11px]">{label(history[0].date)}</text><text x={width - pad.right} y={height - 8} textAnchor="end" className="fill-slate-400 text-[11px]">{label(history[history.length - 1].date)}</text></svg><div className="mt-2 flex flex-wrap gap-3 text-xs font-bold text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#159d92]" />Started</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />Completed</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Dropped off</span></div></div>
    </div>}
  </section>;
}

function FhirPreviewModal({ record, onClose }: { record: CaseRecord; onClose: () => void }) {
  const bundle = { resourceType: "Bundle", type: "collection", meta: { profile: ["https://zipshift.example/fhir/temporary-navigation-preview"] }, entry: [{ resource: { resourceType: "ServiceRequest", id: `zipshift-${record.caseNumber.toLowerCase()}`, status: record.status === "completed" || record.status === "closed" ? "completed" : "active", intent: "order", priority: record.priority === "urgent" ? "urgent" : record.priority === "high" ? "asap" : "routine", code: { text: record.serviceCategory }, subject: { reference: "Patient/pseudonymized" }, identifier: [{ system: "https://zipshift.example/case", value: record.caseNumber }] } }] };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142846]/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fhir-preview-title"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wide text-[#148d84]">Navigator interoperability</p><h2 id="fhir-preview-title" className="mt-1 text-xl font-black">FHIR-style preview · #{record.caseNumber}</h2><p className="mt-1 text-sm text-slate-500">Preview only. No direct identifiers are included and nothing is transmitted.</p></div><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600" aria-label="Close FHIR preview">Close</button></div><pre className="mt-5 overflow-x-auto rounded-xl bg-[#10233f] p-4 text-xs leading-6 text-teal-100">{JSON.stringify(bundle, null, 2)}</pre><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="text-[#159d92]" />Access is logged to the case event ledger.</div></section></div>;
}

function NavigatorPanel({ cases, loading, onAdvance, onSelect, onOpenFhir }: { cases: CaseRecord[]; loading: boolean; onAdvance: (record: CaseRecord) => void; onSelect: (record: CaseRecord) => void; onOpenFhir: (record: CaseRecord) => void }) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [quietHours, setQuietHours] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<string[]>([]);
  const activeCase = cases.find((record) => record.id === selectedCaseId) || cases[0] || null;
  const stageLabels: Record<string, string> = { new: "Dispatched", in_progress: "Contact Attempted", pending: "Service Received", completed: "Closed", denied: "Closed", closed: "Closed" };
  const canned = ["Checking in—did you get to the place we discussed?", "Your appointment is tomorrow. Do you need a ride?", "We could not reach you. Please reply when you can."];
  const sendMessage = async (text: string) => {
    if (!activeCase || !text.trim()) return;
    try {
      await requestJson("/api/staff/navigator-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: activeCase.id, eventType: "NAVIGATOR_MESSAGE_SENT", details: { channel: "secure_chat", queued: quietHours }, note: text.trim() }) });
      setChat((current) => [...current, text.trim()]); setMessage("");
    } catch { setChat((current) => [...current, "Message could not be logged."]); }
  };
  const toggleQuiet = async () => {
    const next = !quietHours;
    setQuietHours(next);
    if (activeCase) await requestJson("/api/staff/navigator-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: activeCase.id, eventType: "NAVIGATOR_QUIET_HOURS_UPDATED", details: { enabled: next, window: "21:00-08:00" }, note: `Quiet hours ${next ? "enabled" : "disabled"}.` }) }).catch(() => undefined);
  };
  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3"><MetricCard label="Active caseload" value={cases.filter((record) => !["completed", "closed", "denied"].includes(record.status)).length} detail="Open referrals in this workspace" /><MetricCard label="Service received" value={cases.filter((record) => record.status === "pending").length} detail="Ready for outcome confirmation" tone="sky" /><MetricCard label="Closed" value={cases.filter((record) => ["completed", "closed"].includes(record.status)).length} detail="Referral loop completed" /></div>
    <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><UsersRound size={18} className="text-[#159d92]" /><h2 className="text-lg font-black">Navigator caseload</h2></div><p className="mt-1 text-sm text-slate-500">Pseudonymized study and case identifiers only. No prescribing or clinical charting.</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-[#148d84]">Scope: navigation + SDOH</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Case ID</th><th className="px-3 py-3">Need</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">Loading caseload…</td></tr> : cases.length ? cases.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-4"><button type="button" onClick={() => setSelectedCaseId(record.id)} className="font-black text-[#148d84] hover:underline">#{record.caseNumber}</button><p className="mt-1 text-xs text-slate-500">Study ID view</p></td><td className="px-3 py-4 text-sm text-slate-700">{record.serviceCategory}</td><td className="px-3 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${record.priority === "urgent" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{record.priority}</span></td><td className="px-3 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${statusClass(record.status)}`}>{stageLabels[record.status]}</span></td><td className="px-3 py-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => onSelect(record)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600">Open case</button>{!["completed", "closed", "denied"].includes(record.status) && <button type="button" onClick={() => onAdvance(record)} className="rounded-lg bg-[#159d92] px-2.5 py-1.5 text-xs font-bold text-white">Advance stage</button>}<button type="button" onClick={() => onOpenFhir(record)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-xs font-bold text-blue-700"><FileJson size={13} />FHIR preview</button></div></td></tr>) : <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">No referrals are available in the current caseload.</td></tr>}</tbody></table></div></section>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><MessageSquare size={18} className="text-[#159d92]" /><h2 className="text-lg font-black">Secure navigator chat</h2></div><p className="mt-1 text-sm text-slate-500">{activeCase ? `Thread for #${activeCase.caseNumber}` : "Select a case to start a thread."}</p><div className="mt-4 min-h-28 space-y-2 rounded-lg bg-slate-50 p-3" aria-live="polite">{chat.length ? chat.map((item, index) => <p key={`${item}-${index}`} className="rounded-lg bg-white p-2 text-sm text-slate-700">{item}</p>) : <p className="text-sm text-slate-500">No messages in this session.</p>}</div><div className="mt-3 flex flex-wrap gap-2">{canned.map((item) => <button key={item} type="button" onClick={() => void sendMessage(item)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">{item}</button>)}</div><div className="mt-3 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendMessage(message); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Write a secure check-in" aria-label="Secure navigator message" /><button type="button" onClick={() => void sendMessage(message)} className="inline-flex items-center gap-1 rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white"><Send size={14} />Send</button></div></section><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-[#159d92]" /><h2 className="text-lg font-black">Communication controls</h2></div><label className="mt-5 flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={quietHours} onChange={() => void toggleQuiet()} className="mt-0.5 accent-[#159d92]" /> <span><strong>Quiet hours</strong><br /><span className="text-xs text-slate-500">Queue messages and SMS from 9 PM to 8 AM.</span></span></label><p className="mt-4 text-xs leading-5 text-slate-500">All stage advances, chat sends, quiet-hours changes, and FHIR previews append to the case event ledger.</p></section></div>
  </div>;
}

function ResearchConsole({ studies, selectedStudyId, onStudyChange, config, participants, cases, loading, selectedParticipantId, onParticipantChange, assessments, onRefresh, onError }: { studies: StudyRecord[]; selectedStudyId: string; onStudyChange: (value: string) => void; config: ResearchConfig | null; participants: ResearchParticipant[]; cases: CaseRecord[]; loading: boolean; selectedParticipantId: string; onParticipantChange: (value: string) => void; assessments: ResearchAssessment[]; onRefresh: () => void; onError: (message: string | null) => void }) {
  const [saving, setSaving] = useState(false);
  const [instrument, setInstrument] = useState<"phq9" | "prapare">("phq9");
  const [phq, setPhq] = useState<number[]>(Array(9).fill(0));
  const [prapare, setPrapare] = useState("{\n  \"housing\": \"\",\n  \"food\": \"\",\n  \"transportation\": \"\"\n}");
  const enrolledCaseIds = new Set(participants.map((participant) => participant.caseNumber));
  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) || null;
  const enroll = async (caseId: string) => { setSaving(true); onError(null); try { await requestJson(`/api/research/studies/${selectedStudyId}/participant-controls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) }); onRefresh(); } catch (err) { onError(err instanceof Error ? err.message : "Unable to enroll participant."); } finally { setSaving(false); } };
  const withdraw = async (participantId: string) => { if (!window.confirm("Withdraw this participant from active research views? Existing assessment records will be marked withdrawn.")) return; setSaving(true); try { await requestJson(`/api/research/participant-controls/${participantId}/withdraw`, { method: "POST" }); onRefresh(); } catch (err) { onError(err instanceof Error ? err.message : "Unable to withdraw participant."); } finally { setSaving(false); } };
  const retention = async (participantId: string, retentionUntil: number | null) => { setSaving(true); try { await requestJson(`/api/research/participant-controls/${participantId}/retention`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retentionUntil }) }); onRefresh(); } catch (err) { onError(err instanceof Error ? err.message : "Unable to update retention control."); } finally { setSaving(false); } };
  const saveAssessment = async (event: React.FormEvent) => { event.preventDefault(); if (!selectedParticipant) return; setSaving(true); onError(null); try { const responses = instrument === "phq9" ? Object.fromEntries(phq.map((value, index) => [`q${index + 1}`, value])) : JSON.parse(prapare); await requestJson(`/api/research/participant-controls/${selectedParticipant.id}/assessments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrumentKey: instrument, responses }) }); onRefresh(); onParticipantChange(selectedParticipant.id); } catch (err) { onError(err instanceof Error ? err.message : "Unable to record the assessment. Check the PRAPARE JSON."); } finally { setSaving(false); } };
  if (!selectedStudyId && !loading) return <section className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center"><FlaskConical className="mx-auto text-[#159d92]" /><h2 className="mt-3 text-lg font-black">No study is available</h2><p className="mt-1 text-sm text-slate-500">An administrator must create a study and assign this researcher before participant enrollment can begin.</p></section>;
  return <div className="space-y-6"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2"><FlaskConical size={18} className="text-[#159d92]" /><h2 className="text-lg font-black">Study enrollment & measures</h2></div><p className="mt-1 text-sm text-slate-500">Versioned, consent-gated research tools using pseudonymized study IDs.</p></div><div className="flex flex-wrap gap-2"><select value={selectedStudyId} onChange={(event) => onStudyChange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold" aria-label="Select research study">{studies.map((study) => <option key={study.id} value={study.id}>{study.title} · {study.status}</option>)}</select><a href={selectedStudyId ? `/api/research/studies/${selectedStudyId}/export.csv` : "#"} onClick={(event) => { if (!selectedStudyId) event.preventDefault(); }} className="inline-flex items-center gap-2 rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white"><Download size={15} />Export de-identified CSV</a></div></div><div className="mt-5 grid gap-3 md:grid-cols-4"><MetricCard label="Enrolled" value={participants.filter((participant) => participant.enrollmentStatus === "enrolled").length} detail="Active participant controls" /><MetricCard label="Withdrawn" value={participants.filter((participant) => participant.enrollmentStatus === "withdrawn").length} detail="Excluded from active views" tone="amber" /><MetricCard label="Assessments" value={participants.reduce((sum, participant) => sum + participant.assessmentCount, 0)} detail="Completed measure records" tone="sky" /><MetricCard label="Active measures" value={config?.instruments.filter((item) => item.status === "active").length || 0} detail="Versioned instrument definitions" /></div></section><div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-[#159d92]" /><h3 className="text-lg font-black">Participant controls</h3></div><p className="mt-1 text-xs leading-5 text-slate-500">Enrollment requires an active granted consent. Direct names and emails are not shown.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-3">Study ID</th><th className="px-2 py-3">Case</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Retention</th><th className="px-2 py-3">Actions</th></tr></thead><tbody>{participants.length ? participants.map((participant) => <tr key={participant.id} className="border-b border-slate-100 last:border-0"><td className="px-2 py-3"><button type="button" onClick={() => onParticipantChange(participant.id)} className="font-mono text-sm font-black text-[#148d84] hover:underline">{participant.pseudonym}</button><p className="text-xs text-slate-400">{participant.assessmentCount} measures</p></td><td className="px-2 py-3 text-sm text-slate-600">#{participant.caseNumber}</td><td className="px-2 py-3"><span className={`rounded px-2 py-1 text-xs font-bold ${participant.enrollmentStatus === "enrolled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{participant.enrollmentStatus}</span></td><td className="px-2 py-3 text-xs text-slate-500">{participant.retentionUntil ? formatDate(participant.retentionUntil) : "Not set"}</td><td className="px-2 py-3"><div className="flex flex-wrap gap-2">{participant.enrollmentStatus === "enrolled" && <><button type="button" disabled={saving} onClick={() => void retention(participant.id, Date.now() + 730 * 24 * 60 * 60 * 1000)} className="rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600">Retain 24 mo</button><button type="button" disabled={saving} onClick={() => void withdraw(participant.id)} className="rounded border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700">Withdraw</button></>}</div></td></tr>) : <tr><td colSpan={5} className="px-2 py-8 text-center text-sm text-slate-500">No participants enrolled yet.</td></tr>}</tbody></table></div><div className="mt-5 border-t border-slate-100 pt-4"><h4 className="font-black">Enroll a study-linked case</h4><div className="mt-3 flex flex-wrap gap-2"><select disabled={saving} defaultValue="" id="research-case-enroll" className="min-w-[230px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Select consented case</option>{cases.filter((record) => !enrolledCaseIds.has(record.caseNumber)).map((record) => <option key={record.id} value={record.id}>#{record.caseNumber} · {record.serviceCategory}</option>)}</select><button type="button" disabled={saving || !cases.length} onClick={() => { const select = document.getElementById("research-case-enroll") as HTMLSelectElement | null; if (select?.value) void enroll(select.value); }} className="rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Enroll</button></div></div></section><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><ClipboardList size={18} className="text-[#159d92]" /><h3 className="text-lg font-black">Assessment collection</h3></div>{selectedParticipant ? <><p className="mt-1 text-sm text-slate-500">Recording for <strong className="font-mono text-[#148d84]">{selectedParticipant.pseudonym}</strong>. This is research data collection, not diagnosis or clinical charting.</p><form onSubmit={saveAssessment} className="mt-4 space-y-3"><select value={instrument} onChange={(event) => setInstrument(event.target.value as "phq9" | "prapare")} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><option value="phq9">PHQ-9 · version 2.0</option><option value="prapare">PRAPARE-aligned SDOH profile · version 1.0</option></select>{instrument === "phq9" ? <div className="grid gap-2 sm:grid-cols-2">{phq.map((value, index) => <label key={index} className="text-xs font-bold text-slate-600">Item {index + 1}<select value={value} onChange={(event) => setPhq((current) => current.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"><option value={0}>0 · Not at all</option><option value={1}>1 · Several days</option><option value={2}>2 · More than half</option><option value={3}>3 · Nearly every day</option></select></label>)}</div> : <textarea value={prapare} onChange={(event) => setPrapare(event.target.value)} rows={7} className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" aria-label="PRAPARE response JSON" />}{instrument === "phq9" && phq[8] > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900" role="alert">Item 9 is positive. Follow the existing safety and 988 workflow; this research form does not assess or diagnose.</div>}<button disabled={saving} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Record measure"}</button></form><div className="mt-5 border-t border-slate-100 pt-4"><h4 className="font-black">Measure history</h4>{assessments.length ? <div className="mt-2 space-y-2">{assessments.map((assessment) => <div key={assessment.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-bold uppercase text-slate-600">{assessment.instrumentKey} · v{assessment.instrumentVersion}</span><span className="text-slate-500">Score {assessment.score ?? "—"} · {formatDate(assessment.createdAt)}</span></div>)}</div> : <p className="mt-2 text-sm text-slate-500">No measures recorded for this participant.</p>}</div></> : <div className="mt-6 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Select a Study ID to collect or review measures.</div>}</section></div>{selectedParticipant && <ResearchTimelineCharts participant={selectedParticipant} assessments={assessments} />}<section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><FileJson size={18} className="text-[#159d92]" /><h3 className="text-lg font-black">Active study governance</h3></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Protocol</p><p className="mt-1 text-sm font-black">{config?.protocols[0] ? `${config.protocols[0].title} · v${config.protocols[0].version}` : "No active protocol"}</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Consent versions</p><p className="mt-1 text-sm font-black">{config?.consentDocuments.length || 0} active language/version records</p></div><div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Data dictionary</p><p className="mt-1 text-sm font-black">{config?.dictionaries.filter((item) => item.status === "active").length || 0} active version(s)</p></div></div><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="text-[#159d92]" />Study access and every enrollment, assessment, withdrawal, retention, and export action are role-gated and appended to the audit timeline.</p></section></div>;
}

function ResearchTimelineCharts({ participant, assessments }: { participant: ResearchParticipant; assessments: ResearchAssessment[] }) {
  const points = assessments.slice().sort((a, b) => a.createdAt - b.createdAt);
  const maxScore = Math.max(1, ...points.map((item) => item.score || 0));
  const retention = participant.retentionUntil ? Math.max(0, participant.retentionUntil - Date.now()) : 0;
  const retentionDays = Math.round(retention / (24 * 60 * 60 * 1000));
  const [exporting, setExporting] = useState(false);
  const exportCharts = async () => {
    setExporting(true);
    const safePseudonym = escapeXml(participant.pseudonym);
    const scoreNodes = points.map((point, index) => {
      const x = points.length === 1 ? 330 : 44 + (index * 560) / (points.length - 1);
      const y = 140 - ((point.score || 0) / maxScore) * 108;
      return `<circle cx="${x}" cy="${y}" r="7" fill="#159d92"/><text x="${x}" y="158" text-anchor="middle" font-size="10" fill="#64748b">${escapeXml(formatDate(point.createdAt).slice(0, 6))}</text>`;
    }).join("");
    const scoreLine = points.map((point, index) => {
      const x = points.length === 1 ? 330 : 44 + (index * 560) / (points.length - 1);
      const y = 140 - ((point.score || 0) / maxScore) * 108;
      return `${x},${y}`;
    }).join(" ");
    const scoreSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="260" viewBox="0 0 760 260"><rect width="760" height="260" fill="#ffffff"/><text x="40" y="34" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#142846">ZipShift participant assessment timeline</text><text x="40" y="57" font-family="Arial,sans-serif" font-size="13" fill="#64748b">Pseudonym: ${safePseudonym} · ${points.length} completed measures</text><line x1="56" y1="210" x2="720" y2="210" stroke="#cbd5e1"/><line x1="56" y1="88" x2="56" y2="210" stroke="#cbd5e1"/>${points.length ? `<polyline fill="none" stroke="#159d92" stroke-width="4" points="${scoreLine}" transform="translate(12,70)"/>` : ""}<g transform="translate(12,70)">${scoreNodes}</g><text x="56" y="238" font-family="Arial,sans-serif" font-size="11" fill="#64748b">Exported ${escapeXml(new Date().toLocaleDateString())} · direct identifiers excluded</text></svg>`;
    const retentionLabel = participant.retentionUntil ? `Until ${escapeXml(formatDate(participant.retentionUntil))}` : "No retention deadline set";
    const retentionWidth = participant.retentionUntil ? Math.min(610, Math.max(24, retentionDays / 7.3 * 610)) : 24;
    const retentionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="260" viewBox="0 0 760 260"><rect width="760" height="260" fill="#ffffff"/><text x="40" y="34" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#142846">ZipShift participant retention horizon</text><text x="40" y="57" font-family="Arial,sans-serif" font-size="13" fill="#64748b">Pseudonym: ${safePseudonym}</text><text x="40" y="122" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#142846">${participant.retentionUntil ? `${retentionDays}d` : "—"}</text><text x="40" y="150" font-family="Arial,sans-serif" font-size="15" fill="#64748b">${retentionLabel}</text><rect x="40" y="180" width="650" height="18" rx="9" fill="#e2e8f0"/><rect x="40" y="180" width="${retentionWidth}" height="18" rx="9" fill="#159d92"/><text x="40" y="232" font-family="Arial,sans-serif" font-size="11" fill="#64748b">Reminder windows begin 30 days before retention deadlines · direct identifiers excluded</text></svg>`;
    downloadHighResolutionPng(scoreSvg, `zipshift-${participant.pseudonym}-assessment-timeline.png`, 760, 260);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    downloadHighResolutionPng(retentionSvg, `zipshift-${participant.pseudonym}-retention-horizon.png`, 760, 260);
    window.setTimeout(() => setExporting(false), 500);
  };
  return <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#159d92]" /><h3 className="text-lg font-black">Participant timeline</h3></div><p className="mt-1 text-sm text-slate-500">Completion history and retention horizon for <span className="font-mono font-bold text-[#148d84]">{participant.pseudonym}</span>. Direct identifiers are excluded.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-[#148d84]">{points.length} completed measure{points.length === 1 ? "" : "s"}</span><button type="button" onClick={() => void exportCharts()} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-black text-[#148d84] hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60" title="Download both charts as 3x PNG images"><ImageDown size={15} />{exporting ? "Preparing images…" : "Export high-res PNGs"}</button></div></div><div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Assessment scores over time</p><span className="text-[11px] text-slate-400">relative scale</span></div>{points.length ? <svg viewBox="0 0 640 170" className="mt-3 h-44 w-full" role="img" aria-label="Participant assessment completion and score timeline"><line x1="36" y1="140" x2="620" y2="140" stroke="#cbd5e1" /><line x1="36" y1="20" x2="36" y2="140" stroke="#cbd5e1" />{points.map((point, index) => { const x = points.length === 1 ? 330 : 44 + (index * 560) / (points.length - 1); const y = 140 - ((point.score || 0) / maxScore) * 108; return <g key={point.id}><circle cx={x} cy={y} r="6" fill="#159d92" /><text x={x} y="158" textAnchor="middle" fontSize="10" fill="#64748b">{formatDate(point.createdAt).slice(0, 6)}</text></g>; })}<polyline fill="none" stroke="#159d92" strokeWidth="3" points={points.map((point, index) => { const x = points.length === 1 ? 330 : 44 + (index * 560) / (points.length - 1); const y = 140 - ((point.score || 0) / maxScore) * 108; return `${x},${y}`; }).join(" ")} /></svg> : <p className="py-12 text-center text-sm text-slate-500">Record an assessment to begin the timeline.</p>}</div><div className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Retention control</p><p className="mt-4 text-3xl font-black text-[#142846]">{participant.retentionUntil ? `${retentionDays}d` : "—"}</p><p className="mt-1 text-sm text-slate-500">{participant.retentionUntil ? `Until ${formatDate(participant.retentionUntil)}` : "No retention deadline set"}</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${retentionDays > 30 ? "bg-[#159d92]" : "bg-amber-500"}`} style={{ width: `${Math.min(100, Math.max(4, retentionDays / 7.3))}%` }} /></div><p className="mt-4 text-xs leading-5 text-slate-500">Reminder windows are generated 30 days before retention deadlines. Withdrawn participants remain excluded from active research exports.</p></div></div></section>;
}
function CasesPanel({ cases, loading, filter, onFilter, onSelect, onOpenYellowBook }: { cases: CaseRecord[]; loading: boolean; filter: string; onFilter: (value: string) => void; onSelect: (record: CaseRecord) => void; onOpenYellowBook: (record: CaseRecord) => void }) {
  return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-4"><MetricCard label="Open Cases" value={cases.filter((item) => ["new", "in_progress", "pending"].includes(item.status)).length} detail="In this filtered view" tone="amber" /><MetricCard label="In Progress" value={cases.filter((item) => item.status === "in_progress").length} detail="Active service coordination" tone="sky" /><MetricCard label="Completed" value={cases.filter((item) => item.status === "completed").length} detail="Verified outcomes" /><MetricCard label="Urgent" value={cases.filter((item) => item.priority === "urgent").length} detail="Needs immediate attention" tone="rose" /></div><section className="rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-lg font-black">Case registry</h2><p className="mt-1 text-sm text-slate-500">Select a case to update its status and resolution notes.</p></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-600">Status<select value={filter} onChange={(event) => onFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-[#159d92]"><option value="all">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></label></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Case ID</th><th className="px-5 py-4">Client</th><th className="px-5 py-4">Service type</th><th className="px-5 py-4">Priority</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Created</th><th className="px-5 py-4">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">Loading cases…</td></tr> : cases.length ? cases.map((record) => <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-5 py-4 text-sm font-black text-[#148d84]">{record.caseNumber}</td><td className="px-5 py-4"><div className="text-sm font-bold">{record.clientName}</div><div className="mt-1 text-xs text-slate-500">{record.clientEmail || "Anonymous service request"}</div></td><td className="px-5 py-4 text-sm text-slate-600">{record.serviceCategory}</td><td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${record.priority === "urgent" ? "bg-rose-100 text-rose-700" : record.priority === "high" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{record.priority}</span></td><td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${statusClass(record.status)}`}>{record.status.replace("_", " ")}</span></td><td className="px-5 py-4 text-sm text-slate-500">{formatDate(record.createdAt)}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><button onClick={() => onSelect({ ...record })} className="text-sm font-black text-[#148d84] hover:underline">View</button><button onClick={() => onOpenYellowBook(record)} className="text-sm font-black text-[#142846] hover:underline">YellowBook</button></div></td></tr>) : <tr><td colSpan={7} className="px-5 py-12 text-center"><p className="font-bold text-slate-700">No cases match this view.</p><p className="mt-1 text-sm text-slate-500">Client intake submissions will create secure case records automatically.</p></td></tr>}</tbody></table></div></section></div>;
}

function YellowBookLauncher({ cases, loading, onOpen }: { cases: CaseRecord[]; loading: boolean; onOpen: (record: CaseRecord) => void }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#148d84]">Case-linked encounter</p><h2 className="mt-2 text-xl font-black">Open a YellowBook record</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Select a live case to start a protected Ceramic-style encounter. The workspace saves to the case event ledger and supports pause-safe continuation.</p></div><div className="rounded-xl bg-teal-50 px-4 py-3 text-center"><div className="text-2xl font-black text-[#148d84]">{cases.length}</div><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">available cases</div></div></div><div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">{loading ? <div className="p-6 text-center text-sm text-slate-500">Loading cases…</div> : cases.length ? cases.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="text-sm font-black text-[#148d84]">{record.caseNumber}</p><p className="mt-1 text-sm font-bold text-slate-800">{record.clientName}</p><p className="mt-1 text-xs text-slate-500">{record.serviceCategory} · {record.status.replace("_", " ")} · {record.priority} priority</p></div><button onClick={() => onOpen(record)} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-black text-white hover:bg-[#0d8077]">Open YellowBook</button></div>) : <div className="p-8 text-center"><p className="font-bold text-slate-700">No cases are available.</p><p className="mt-1 text-sm text-slate-500">Submit a client intake or open the Cases tab to confirm the case registry.</p></div>}</div></section>;
}

function DirectoryPanel({ resources, loading, search, onSearch, onSubmit }: { resources: DirectoryResource[]; loading: boolean; search: string; onSearch: (value: string) => void; onSubmit: () => void }) {
  return <section className="rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-lg font-black">Imported service directory</h2><p className="mt-1 text-sm text-slate-500">30 records supplied in the attached directory are preserved with source identifiers.</p></div><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="flex gap-2"><input value={search} onChange={(event) => onSearch(event.target.value)} className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#159d92]" placeholder="Search service or city" /><button className="rounded-lg bg-[#159d92] px-4 py-2 text-sm font-bold text-white">Search</button></form></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">City</th><th className="px-5 py-4">HSAI</th><th className="px-5 py-4">Verification</th><th className="px-5 py-4">Contact</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">Loading directory…</td></tr> : resources.map((resource) => <tr key={resource.id} className="border-b border-slate-100 last:border-0"><td className="px-5 py-4"><div className="text-sm font-bold">{resource.name}</div><div className="mt-1 text-xs text-slate-500">{resource.address}</div></td><td className="px-5 py-4 text-sm text-slate-600">{resource.category}</td><td className="px-5 py-4 text-sm text-slate-600">{resource.city}</td><td className="px-5 py-4 text-sm font-black text-[#148d84]">{resource.hsaiScore || "—"}</td><td className="px-5 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${resource.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{resource.verified ? "Verified" : "Needs review"}</span></td><td className="px-5 py-4 text-sm text-slate-600">{resource.phone || "—"}</td></tr>)}</tbody></table></div></section>;
}

function ReportsPanel({ report, zipDemand, loading, onExport }: { report: ReportSummary | null; zipDemand: ZipDemandReport | null; loading: boolean; onExport: () => void }) {
  const summary = report?.summary || { totalCases: 0, openCases: 0, completedCases: 0, completionRate: 0, totalDirectoryResources: 0, verifiedDirectoryResources: 0, averageHsai: 0 };
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black">Outcome & Compliance Reports</h2><p className="mt-1 text-sm text-slate-500">Exports contain live records only; no synthetic report rows are generated.</p></div><button onClick={onExport} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0d8077]">⇩ Export case CSV</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Tracked Cases" value={summary.totalCases} detail="Total secure case records" /><MetricCard label="Successful Access" value={`${summary.completionRate}%`} detail="Completed case share" tone="teal" /><MetricCard label="Open Reviews" value={summary.openCases} detail="New, pending, or active" tone="amber" /><MetricCard label="Average HSAI" value={summary.averageHsai ? summary.averageHsai.toFixed(1) : "—"} detail="Attached directory records" tone="sky" /></div><div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-black">Report scope</h3><div className="mt-5 space-y-3 text-sm text-slate-600"><label className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3"><input type="checkbox" defaultChecked className="accent-[#159d92]" />Case outcomes and status changes</label><label className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3"><input type="checkbox" defaultChecked className="accent-[#159d92]" />Navigation and contact events</label><label className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3"><input type="checkbox" defaultChecked className="accent-[#159d92]" />Directory coverage and verification</label></div><p className="mt-5 text-xs leading-5 text-slate-500">Exports are logged to the reports ledger and respect the active staff role.</p></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h3 className="text-lg font-black">Recent event signals</h3><div className="mt-5 divide-y divide-slate-100">{loading ? <p className="py-6 text-sm text-slate-500">Loading report signals…</p> : report?.events.length ? report.events.map((event) => <div key={event.eventType} className="flex items-center justify-between py-3"><span className="text-sm font-semibold text-slate-600">{event.eventType}</span><span className="rounded bg-teal-50 px-2 py-1 text-xs font-black text-[#148d84]">{event.count}</span></div>) : <p className="py-6 text-sm text-slate-500">No captured events yet.</p>}</div></section></div><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-lg font-black">Covered-ZIP demand trends</h3><p className="mt-1 text-sm text-slate-500">Aggregated service-search demand for prevention planning over the past {zipDemand?.periodDays || 90} days.</p></div><span className="rounded bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Minimum cohort: {zipDemand?.minimumCohort || 3}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{zipDemand?.demand.length ? zipDemand.demand.map((item) => <div key={item.zipCode} className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-sm font-black text-[#142846]">{item.zipCode}</p><p className="mt-1 text-sm font-bold text-[#148d84]">{item.suppressed ? "Suppressed" : `${item.searchCount} searches`}</p></div>) : <p className="text-sm text-slate-500">No reportable ZIP demand cohorts yet.</p>}</div><p className="mt-5 text-xs leading-5 text-slate-500">{zipDemand?.methodology || "ZIP demand uses aggregate selections only."}</p></section></div>;
}

function TeamPanel({ form, message, onChange, onSubmit }: { form: { displayName: string; email: string; password: string; role: string }; message: string | null; onChange: (next: { displayName: string; email: string; password: string; role: string }) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black">Create staff account</h2><p className="mt-1 text-sm text-slate-500">Create a proper database-backed account for an Administrator or Researcher. Client accounts are created through the Navigator profile flow.</p>{message && <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-[#148d84]">{message}</div>}<form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Display name<input required value={form.displayName} onChange={(event) => onChange({ ...form, displayName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" /></label><label className="text-sm font-bold text-slate-700">Email<input required type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" /></label><label className="text-sm font-bold text-slate-700">Role<select value={form.role} onChange={(event) => onChange({ ...form, role: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#159d92]"><option value="researcher">Researcher</option><option value="admin">Administrator</option></select></label><label className="text-sm font-bold text-slate-700">Temporary password<input required minLength={12} type="password" value={form.password} onChange={(event) => onChange({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="At least 12 characters" /></label><div className="md:col-span-2"><button className="rounded-lg bg-[#159d92] px-5 py-3 text-sm font-bold text-white hover:bg-[#0d8077]">Create staff account</button></div></form></div>;
}

function CaseDetailModal({ caseRecord, onChange, onClose, onSave }: { caseRecord: CaseRecord; onChange: (record: CaseRecord) => void; onClose: () => void; onSave: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 sm:items-center"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#148d84]">{caseRecord.caseNumber}</p><h2 className="mt-1 text-2xl font-black">{caseRecord.clientName}</h2><p className="mt-1 text-sm text-slate-500">{caseRecord.serviceCategory} · created {formatDate(caseRecord.createdAt)}</p></div><button onClick={onClose} className="rounded-lg p-2 text-xl text-slate-400 hover:bg-slate-100">×</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Status<select value={caseRecord.status} onChange={(event) => onChange({ ...caseRecord, status: event.target.value as CaseRecord["status"] })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#159d92]">{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Priority<select value={caseRecord.priority} onChange={(event) => onChange({ ...caseRecord, priority: event.target.value as CaseRecord["priority"] })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#159d92]">{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label></div><label className="mt-4 block text-sm font-bold text-slate-700">Resolution notes<textarea value={caseRecord.resolutionNotes} onChange={(event) => onChange({ ...caseRecord, resolutionNotes: event.target.value })} className="mt-1.5 min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="Record coordination steps, confirmation, or follow-up." /></label><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={onSave} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white">Save case</button></div></div></div>;
}
