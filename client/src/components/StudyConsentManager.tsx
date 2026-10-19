import React, { useEffect, useState } from "react";
import { ClipboardCheck, FileText, FlaskConical, Plus, UsersRound } from "lucide-react";
import ResearchDataManager from "./ResearchDataManager";

type Study = { id: string; studyKey: string; title: string; description: string; status: "draft" | "active" | "paused" | "archived"; protocolVersion: string; ownerName: string | null; memberCount?: number; protocolCount?: number; consentDocumentCount?: number; startDate: string | null; endDate: string | null };
type StaffUser = { id: string; displayName: string; email: string; role: "admin" | "researcher" | "client"; isActive: boolean };
type Protocol = { id: string; version: string; title: string; status: "draft" | "active" | "retired"; summary: Record<string, unknown> };
type ConsentDocument = { id: string; purpose: string; version: string; language: "en" | "es"; title: string; body: string; status: "draft" | "active" | "retired" };
type StudyDetail = { study: Study; protocols: Protocol[]; consentDocuments: ConsentDocument[]; members: Array<{ id: string; userId: string; displayName: string; email: string; role: string; membershipRole: string; isActive: boolean }> };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new Error("The service returned an unexpected response."); }
  if (!response.ok) throw new Error(body?.error || "Request failed.");
  return body as T;
}

const emptyProtocol = { version: "1.0", title: "", summary: "{\n  \"population\": \"\",\n  \"primaryQuestion\": \"\"\n}", status: "draft" };
const emptyConsent = { purpose: "research_participation", version: "1.0", language: "en", title: "", body: "", status: "draft" };

export default function StudyConsentManager() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [detail, setDetail] = useState<StudyDetail | null>(null);
  const [studyForm, setStudyForm] = useState({ studyKey: "", title: "", description: "", protocolVersion: "1.0", status: "draft", ownerUserId: "", startDate: "", endDate: "" });
  const [protocolForm, setProtocolForm] = useState(emptyProtocol);
  const [consentForm, setConsentForm] = useState(emptyConsent);
  const [memberForm, setMemberForm] = useState({ userId: "", membershipRole: "researcher" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStudies = async () => {
    setLoading(true);
    try {
      const [studyData, userData] = await Promise.all([
        requestJson<{ studies: Study[] }>("/api/admin/studies"),
        requestJson<{ users: StaffUser[] }>("/api/admin/users"),
      ]);
      setStudies(studyData.studies);
      setUsers(userData.users.filter((user) => user.isActive && user.role !== "client"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load study controls."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadStudies(); }, []);

  const openStudy = async (studyId: string) => {
    try { setDetail(await requestJson<StudyDetail>(`/api/admin/studies/${studyId}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to open study."); }
  };
  const createStudy = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const result = await requestJson<{ study: { id: string } }>("/api/admin/studies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...studyForm, ownerUserId: studyForm.ownerUserId || undefined }) });
      setMessage("Study created. Add the protocol and consent versions before activating it.");
      setStudyForm({ studyKey: "", title: "", description: "", protocolVersion: "1.0", status: "draft", ownerUserId: "", startDate: "", endDate: "" });
      await loadStudies(); await openStudy(result.study.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create study."); }
    finally { setSaving(false); }
  };
  const patchStudy = async (patch: Partial<Study>) => {
    if (!detail) return;
    setSaving(true);
    try { await requestJson(`/api/admin/studies/${detail.study.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); setMessage("Study settings saved."); await loadStudies(); await openStudy(detail.study.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update study."); }
    finally { setSaving(false); }
  };
  const patchProtocol = async (protocolId: string, status: Protocol["status"]) => {
    if (!detail) return;
    setSaving(true);
    try { await requestJson(`/api/admin/protocols/${protocolId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setMessage("Protocol status updated."); await openStudy(detail.study.id); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update protocol."); }
    finally { setSaving(false); }
  };
  const createProtocol = async (event: React.FormEvent) => {
    event.preventDefault(); if (!detail) return; setSaving(true);
    try { const summary = JSON.parse(protocolForm.summary) as Record<string, unknown>; await requestJson(`/api/admin/studies/${detail.study.id}/protocols`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...protocolForm, summary }) }); setMessage("Protocol version created."); setProtocolForm(emptyProtocol); await openStudy(detail.study.id); await loadStudies(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Protocol summary must be valid JSON."); }
    finally { setSaving(false); }
  };
  const createConsent = async (event: React.FormEvent) => {
    event.preventDefault(); if (!detail) return; setSaving(true);
    try { await requestJson(`/api/admin/studies/${detail.study.id}/consent-documents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(consentForm) }); setMessage("Consent document version created."); setConsentForm(emptyConsent); await openStudy(detail.study.id); await loadStudies(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create consent document."); }
    finally { setSaving(false); }
  };
  const addMember = async (event: React.FormEvent) => {
    event.preventDefault(); if (!detail) return; setSaving(true);
    try { await requestJson(`/api/admin/studies/${detail.study.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(memberForm) }); setMessage("Study member added."); setMemberForm({ userId: "", membershipRole: "researcher" }); await openStudy(detail.study.id); await loadStudies(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add study member."); }
    finally { setSaving(false); }
  };

  if (loading) return <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading study and consent controls…</section>;
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#148d84]">Research foundation</p><h2 className="mt-1 text-xl font-black">Studies, protocols & consent versions</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Define the study boundary before collecting research-linked intake. Draft versions remain inactive until explicitly promoted.</p></div><FlaskConical className="text-[#159d92]" /></div>
    {message && <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800" role="status">{message}</div>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <div className="space-y-4"><form onSubmit={createStudy} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><h3 className="font-black">Create study</h3><div className="mt-3 grid gap-3"><input required pattern="[a-z0-9][a-z0-9_-]{2,79}" value={studyForm.studyKey} onChange={(event) => setStudyForm({ ...studyForm, studyKey: event.target.value })} placeholder="study-key" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><input required minLength={3} value={studyForm.title} onChange={(event) => setStudyForm({ ...studyForm, title: event.target.value })} placeholder="Study title" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><textarea value={studyForm.description} onChange={(event) => setStudyForm({ ...studyForm, description: event.target.value })} placeholder="Purpose and population" rows={3} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><input required value={studyForm.protocolVersion} onChange={(event) => setStudyForm({ ...studyForm, protocolVersion: event.target.value })} placeholder="Protocol v1.0" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><select value={studyForm.status} onChange={(event) => setStudyForm({ ...studyForm, status: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></div><select value={studyForm.ownerUserId} onChange={(event) => setStudyForm({ ...studyForm, ownerUserId: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Owner: current administrator</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.role}</option>)}</select><div className="grid grid-cols-2 gap-2"><input type="date" value={studyForm.startDate} onChange={(event) => setStudyForm({ ...studyForm, startDate: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /><input type="date" value={studyForm.endDate} onChange={(event) => setStudyForm({ ...studyForm, endDate: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></div><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><Plus size={15} />Create study</button></div></form><div className="space-y-2">{studies.length ? studies.map((study) => <button key={study.id} type="button" onClick={() => void openStudy(study.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-[#159d92] ${detail?.study.id === study.id ? "border-[#159d92] bg-teal-50" : "border-slate-100 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#148d84]">{study.studyKey}</p><h3 className="mt-1 font-black">{study.title}</h3><p className="mt-1 text-xs text-slate-500">Protocol {study.protocolVersion} · {study.ownerName || "No owner"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold capitalize text-slate-600">{study.status}</span></div><div className="mt-3 flex gap-3 text-[11px] font-semibold text-slate-500"><span>{study.protocolCount || 0} protocols</span><span>{study.consentDocumentCount || 0} consent versions</span><span>{study.memberCount || 0} members</span></div></button>) : <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">No studies created yet.</p>}</div></div>
      <div>{detail ? <div className="space-y-5"><div className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-[#148d84]">{detail.study.studyKey}</p><h3 className="mt-1 text-xl font-black">{detail.study.title}</h3><p className="mt-1 text-sm text-slate-500">{detail.study.description || "No study description yet."}</p></div><select disabled={saving} value={detail.study.status} onChange={(event) => void patchStudy({ status: event.target.value as Study["status"] })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></div></div><ResearchDataManager studyId={detail.study.id} />{detail.protocols.length > 0 && <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-2"><FileText size={17} className="text-[#159d92]" /><h3 className="font-black">Protocol versions</h3></div><div className="mt-3 space-y-2">{detail.protocols.map((protocol) => <div key={protocol.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"><div><p className="text-sm font-bold">{protocol.title}</p><p className="text-xs text-slate-500">v{protocol.version}</p></div><select disabled={saving} value={protocol.status} onChange={(event) => void patchProtocol(protocol.id, event.target.value as Protocol["status"])} className="rounded border border-slate-200 px-2 py-1 text-xs font-bold"><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option></select></div>)}</div></div>}<form onSubmit={createProtocol} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center gap-2"><FileText size={17} className="text-[#159d92]" /><h3 className="font-black">Add protocol version</h3></div><div className="mt-3 grid gap-3"><div className="grid grid-cols-2 gap-2"><input required value={protocolForm.version} onChange={(event) => setProtocolForm({ ...protocolForm, version: event.target.value })} placeholder="Version" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><select value={protocolForm.status} onChange={(event) => setProtocolForm({ ...protocolForm, status: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option></select></div><input required value={protocolForm.title} onChange={(event) => setProtocolForm({ ...protocolForm, title: event.target.value })} placeholder="Protocol title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><textarea required rows={4} value={protocolForm.summary} onChange={(event) => setProtocolForm({ ...protocolForm, summary: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" /><button disabled={saving} className="w-fit rounded-lg bg-[#159d92] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save protocol version</button></div></form><div className="rounded-xl border border-slate-100 p-4"><div className="flex items-center gap-2"><ClipboardCheck size={17} className="text-[#159d92]" /><h3 className="font-black">Consent documents</h3></div><div className="mt-3 space-y-2">{detail.consentDocuments.length ? detail.consentDocuments.map((document) => <div key={document.id} className="rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-sm font-bold">{document.title}</p><p className="text-xs text-slate-500">{document.purpose.replaceAll("_", " ")} · v{document.version} · {document.language.toUpperCase()}</p></div><select disabled={saving} value={document.status} onChange={(event) => void requestJson(`/api/admin/consent-documents/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: event.target.value }) }).then(() => openStudy(detail.study.id)).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to update consent."))} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold"><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option></select></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{document.body}</p></div>) : <p className="text-sm text-slate-500">No consent versions yet.</p>}</div><form onSubmit={createConsent} className="mt-4 grid gap-2 border-t border-slate-100 pt-4"><div className="grid grid-cols-3 gap-2"><select value={consentForm.purpose} onChange={(event) => setConsentForm({ ...consentForm, purpose: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="research_participation">Research participation</option><option value="data_use">Data use</option><option value="contact">Contact</option><option value="future_use">Future use</option></select><input required value={consentForm.version} onChange={(event) => setConsentForm({ ...consentForm, version: event.target.value })} placeholder="Version" className="rounded-lg border border-slate-200 px-2 py-2 text-xs" /><select value={consentForm.language} onChange={(event) => setConsentForm({ ...consentForm, language: event.target.value as "en" | "es" })} className="rounded-lg border border-slate-200 px-2 py-2 text-xs"><option value="en">English</option><option value="es">Español</option></select></div><input required value={consentForm.title} onChange={(event) => setConsentForm({ ...consentForm, title: event.target.value })} placeholder="Consent title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><textarea required minLength={20} rows={4} value={consentForm.body} onChange={(event) => setConsentForm({ ...consentForm, body: event.target.value })} placeholder="Full consent language (minimum 20 characters)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button disabled={saving} className="w-fit rounded-lg bg-[#159d92] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save consent version</button></form></div><form onSubmit={addMember} className="rounded-xl border border-slate-100 p-4"><div className="flex items-center gap-2"><UsersRound size={17} className="text-[#159d92]" /><h3 className="font-black">Study team</h3></div><div className="mt-3 flex flex-wrap gap-2"><select required value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Add active staff member</option>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.role}</option>)}</select><select value={memberForm.membershipRole} onChange={(event) => setMemberForm({ ...memberForm, membershipRole: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="researcher">Researcher</option><option value="data_steward">Data steward</option><option value="reviewer">Reviewer</option><option value="owner">Owner</option></select><button disabled={saving} className="rounded-lg bg-[#159d92] px-3 py-2 text-sm font-bold text-white disabled:opacity-60">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{detail.members.map((member) => <span key={member.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{member.displayName} · {member.membershipRole}</span>)}</div></form></div> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Select a study to manage its protocol, consent versions, and team scope.</div>}</div>
    </div>
  </section>;
}
