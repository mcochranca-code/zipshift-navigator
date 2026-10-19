import React, { useEffect, useState } from "react";
import { FilePenLine, KeyRound, ShieldCheck, UserCog, UserRoundCheck, UserRoundX } from "lucide-react";
import StudyConsentManager from "./StudyConsentManager";

type AdminUser = { id: string; email: string; displayName: string; role: "client" | "admin" | "researcher"; specialistRole?: string | null; isActive: boolean; createdAt: number };
const specialistRoleOptions = [["", "No specialist assignment"], ["intake_specialist", "Intake specialist"], ["medical_specialist", "Medi-Cal / medical"], ["peer_support_specialist", "Peer support"], ["sud_specialist", "SUD services"], ["behavioral_health_specialist", "Behavioral health"], ["residential_care_specialist", "Residential care"], ["care_coordinator", "Care coordinator"]];
type AdminPage = { id: string; slug: string; title: string; content: Record<string, unknown>; isPublished: boolean; updatedAt: number };
type AuditEntry = { id: string; action: string; targetType: string; targetId: string | null; actorName: string; createdAt: number };
type GlobalEditorSettings = { brandColor: string; accentColor: string; surfaceColor: string; textScale: number; radiusScale: number; sidebarDefaultCollapsed: boolean };
type GlobalRevision = { id: string; settingKey: keyof GlobalEditorSettings; previousValue: unknown; nextValue: unknown; changedBy: string; createdAt: number };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok) throw new Error(parsed?.error || "Request failed.");
  return parsed as T;
}

export default function AdminControlCenter() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pages, setPages] = useState<AdminPage[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selectedPage, setSelectedPage] = useState<AdminPage | null>(null);
  const [pageForm, setPageForm] = useState({ slug: "", title: "", content: '{\n  "headline": "",\n  "body": ""\n}', isPublished: true });
  const [passwordFor, setPasswordFor] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<GlobalEditorSettings>({ brandColor: "#159d92", accentColor: "#0d8077", surfaceColor: "#f7f9fc", textScale: 1, radiusScale: 1, sidebarDefaultCollapsed: false });
  const [appliedGlobalSettings, setAppliedGlobalSettings] = useState<GlobalEditorSettings>({ brandColor: "#159d92", accentColor: "#0d8077", surfaceColor: "#f7f9fc", textScale: 1, radiusScale: 1, sidebarDefaultCollapsed: false });
  const [globalRevisions, setGlobalRevisions] = useState<GlobalRevision[]>([]);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [userData, pageData, auditData, globalData] = await Promise.all([
        requestJson<{ users: AdminUser[] }>("/api/admin/users"),
        requestJson<{ pages: AdminPage[] }>("/api/admin/pages"),
        requestJson<{ entries: AuditEntry[] }>("/api/admin/audit"),
        requestJson<{ settings: GlobalEditorSettings; revisions: GlobalRevision[] }>("/api/admin/global-settings"),
      ]);
      setUsers(userData.users); setPages(pageData.pages); setAudit(auditData.entries);
      setGlobalSettings(globalData.settings); setAppliedGlobalSettings(globalData.settings); setGlobalRevisions(globalData.revisions);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load administrator controls."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const updateUser = async (user: AdminUser, patch: Partial<AdminUser>) => {
    try { await requestJson(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); setMessage(`${user.email} updated.`); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update account."); }
  };
  const resetPassword = async () => {
    if (!passwordFor || !newPassword) return;
    try { await requestJson(`/api/admin/users/${passwordFor}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword }) }); setMessage("Password updated and prior sessions revoked."); setPasswordFor(""); setNewPassword(""); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reset password."); }
  };
  const savePage = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const content = JSON.parse(pageForm.content) as Record<string, unknown>;
      if (selectedPage) await requestJson(`/api/admin/pages/${selectedPage.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: pageForm.title, content, isPublished: pageForm.isPublished }) });
      else await requestJson("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: pageForm.slug, title: pageForm.title, content, isPublished: pageForm.isPublished }) });
      setMessage("Website page saved."); setSelectedPage(null); setPageForm({ slug: "", title: "", content: '{\n  "headline": "",\n  "body": ""\n}', isPublished: true }); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Page content must be valid JSON."); }
  };
  const selectPage = (page: AdminPage) => { setSelectedPage(page); setPageForm({ slug: page.slug, title: page.title, content: JSON.stringify(page.content, null, 2), isPublished: page.isPublished }); };
  const refreshGlobalRevisions = async () => {
    const data = await requestJson<{ revisions: GlobalRevision[] }>("/api/admin/global-settings");
    setGlobalRevisions(data.revisions);
  };
  const saveGlobalSettings = async () => {
    setGlobalSaving(true);
    try {
      const result = await requestJson<{ settings: GlobalEditorSettings }>("/api/admin/global-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: globalSettings }) });
      setGlobalSettings(result.settings);
      setAppliedGlobalSettings(result.settings);
      setPreviewMode(false);
      setMessage("Global appearance saved. The active Navigator updated immediately.");
      window.dispatchEvent(new CustomEvent("zipshift-global-settings-updated", { detail: result.settings }));
      await refreshGlobalRevisions();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save global appearance."); }
    finally { setGlobalSaving(false); }
  };
  const undoGlobalSetting = async (settingKey: keyof GlobalEditorSettings) => {
    setGlobalSaving(true);
    try {
      const result = await requestJson<{ settings: GlobalEditorSettings }>("/api/admin/global-settings/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settingKey }) });
      setGlobalSettings(result.settings);
      setAppliedGlobalSettings(result.settings);
      setMessage(`${settingKey} reverted to the previous saved value.`);
      window.dispatchEvent(new CustomEvent("zipshift-global-settings-updated", { detail: result.settings }));
      await refreshGlobalRevisions();
    } catch (error) { setMessage(error instanceof Error ? error.message : "There is no saved revision to undo."); }
    finally { setGlobalSaving(false); }
  };
  const previewGlobalSettings = () => {
    setPreviewMode(true);
    window.dispatchEvent(new CustomEvent("zipshift-global-settings-updated", { detail: globalSettings }));
    setMessage("Draft preview is active for this session. Save global changes to publish it.");
  };
  const exitPreview = () => {
    setPreviewMode(false);
    setGlobalSettings(appliedGlobalSettings);
    window.dispatchEvent(new CustomEvent("zipshift-global-settings-updated", { detail: appliedGlobalSettings }));
    setMessage("Draft preview closed; the last applied settings are restored.");
  };

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading secure administration controls…</div>;
  return <div className="space-y-6">
    {message && <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800" role="status">{message}</div>}
    <StudyConsentManager />
    <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#148d84]">Identity & security</p><h2 className="mt-1 text-xl font-black">Account access control</h2><p className="mt-1 text-sm text-slate-500">Edit roles, specialist assignments, activate or suspend accounts, and revoke sessions without exposing passwords.</p></div><ShieldCheck className="text-[#159d92]" /></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3">Account</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Specialist portal</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Tools</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-slate-100"><td className="px-3 py-3"><div className="font-bold">{user.displayName}</div><div className="text-xs text-slate-500">{user.email}</div></td><td className="px-3 py-3"><select value={user.role} onChange={(event) => void updateUser(user, { role: event.target.value as AdminUser["role"] })} className="rounded border border-slate-200 px-2 py-1.5"><option value="admin">Super admin</option><option value="researcher">Researcher</option><option value="client">Client</option></select></td><td className="px-3 py-3"><select value={user.specialistRole || ""} onChange={(event) => void updateUser(user, { specialistRole: event.target.value || null })} className="rounded border border-slate-200 px-2 py-1.5">{specialistRoleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{user.isActive ? "Active" : "Suspended"}</span></td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void updateUser(user, { isActive: !user.isActive })} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-bold hover:bg-slate-50">{user.isActive ? <UserRoundX size={13} /> : <UserRoundCheck size={13} />}{user.isActive ? "Suspend" : "Activate"}</button><button type="button" onClick={() => setPasswordFor(user.id)} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-bold hover:bg-slate-50"><KeyRound size={13} />Reset password</button></div></td></tr>)}</tbody></table></div>{passwordFor && <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4"><label className="text-xs font-bold text-slate-600">New password<input type="password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block rounded border border-slate-200 px-3 py-2 text-sm" /></label><button type="button" onClick={() => void resetPassword()} className="rounded bg-[#159d92] px-3 py-2 text-xs font-bold text-white">Update & revoke sessions</button><button type="button" onClick={() => setPasswordFor("")} className="rounded border border-slate-200 px-3 py-2 text-xs font-bold">Cancel</button></div>}</section>
    <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><form onSubmit={savePage} className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#148d84]">Website editor</p><h2 className="mt-1 text-xl font-black">Edit webpages</h2><p className="mt-1 text-sm text-slate-500">Manage lightweight page content as structured JSON, with publish control and audit history.</p></div><FilePenLine className="text-[#159d92]" /></div><div className="mt-5 grid gap-3"><input required disabled={Boolean(selectedPage)} value={pageForm.slug} onChange={(event) => setPageForm({ ...pageForm, slug: event.target.value })} placeholder="page-slug" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><input required value={pageForm.title} onChange={(event) => setPageForm({ ...pageForm, title: event.target.value })} placeholder="Page title" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" /><textarea required rows={9} value={pageForm.content} onChange={(event) => setPageForm({ ...pageForm, content: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-xs" /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={pageForm.isPublished} onChange={(event) => setPageForm({ ...pageForm, isPublished: event.target.checked })} /> Published on public page endpoint</label><div className="flex gap-2"><button className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white">{selectedPage ? "Save page" : "Create page"}</button>{selectedPage && <button type="button" onClick={() => { setSelectedPage(null); setPageForm({ slug: "", title: "", content: '{\n  "headline": "",\n  "body": ""\n}', isPublished: true }); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold">New page</button>}</div></div></form><div className="space-y-6"><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black">Managed pages</h2><div className="mt-4 space-y-2">{pages.length ? pages.map((page) => <button key={page.id} type="button" onClick={() => selectPage(page)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50"><span><span className="block text-sm font-bold">{page.title}</span><span className="text-xs text-slate-500">/{page.slug} · {page.isPublished ? "Published" : "Draft"}</span></span><UserCog size={15} className="text-slate-400" /></button>) : <p className="text-sm text-slate-500">No managed pages yet.</p>}</div></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-black">Security audit</h2><div className="mt-4 space-y-3">{audit.slice(0, 6).map((entry) => <div key={entry.id} className="flex items-start gap-3 text-xs"><KeyRound size={14} className="mt-0.5 text-[#159d92]" /><div><strong>{entry.action.replace(/_/g, " ")}</strong><div className="text-slate-500">{entry.actorName} · {new Date(entry.createdAt).toLocaleString()}</div></div></div>)}{!audit.length && <p className="text-sm text-slate-500">Admin actions will appear here.</p>}</div></section></div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#148d84]">Editors suite</p><h2 className="mt-1 text-xl font-black">Global appearance controls</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Apply carefully bounded, site-wide visual changes. Every saved field creates a revision that can be undone independently.</p></div><FilePenLine className="text-[#159d92]" /></div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-bold text-slate-700">Brand color<input type="color" value={globalSettings.brandColor} onChange={(event) => setGlobalSettings({ ...globalSettings, brandColor: event.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded border border-slate-200 bg-white p-1" /><span className="mt-1 block font-mono text-xs font-normal text-slate-500">{globalSettings.brandColor}</span></label>
        <label className="text-sm font-bold text-slate-700">Accent color<input type="color" value={globalSettings.accentColor} onChange={(event) => setGlobalSettings({ ...globalSettings, accentColor: event.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded border border-slate-200 bg-white p-1" /><span className="mt-1 block font-mono text-xs font-normal text-slate-500">{globalSettings.accentColor}</span></label>
        <label className="text-sm font-bold text-slate-700">Workspace surface<input type="color" value={globalSettings.surfaceColor} onChange={(event) => setGlobalSettings({ ...globalSettings, surfaceColor: event.target.value })} className="mt-2 h-11 w-full cursor-pointer rounded border border-slate-200 bg-white p-1" /><span className="mt-1 block font-mono text-xs font-normal text-slate-500">{globalSettings.surfaceColor}</span></label>
        <label className="text-sm font-bold text-slate-700">Text scale <span className="font-normal text-slate-500">{Math.round(globalSettings.textScale * 100)}%</span><input type="range" min="0.9" max="1.2" step="0.05" value={globalSettings.textScale} onChange={(event) => setGlobalSettings({ ...globalSettings, textScale: Number(event.target.value) })} className="mt-3 w-full accent-[#159d92]" /></label>
        <label className="text-sm font-bold text-slate-700">Corner scale <span className="font-normal text-slate-500">{Math.round(globalSettings.radiusScale * 100)}%</span><input type="range" min="0.75" max="1.25" step="0.05" value={globalSettings.radiusScale} onChange={(event) => setGlobalSettings({ ...globalSettings, radiusScale: Number(event.target.value) })} className="mt-3 w-full accent-[#159d92]" /></label>
        <label className="flex items-center gap-2 self-end pb-1 text-sm font-bold text-slate-700"><input type="checkbox" checked={globalSettings.sidebarDefaultCollapsed} onChange={(event) => setGlobalSettings({ ...globalSettings, sidebarDefaultCollapsed: event.target.checked })} className="h-4 w-4 accent-[#159d92]" /> Default sidebar collapsed</label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={globalSaving} onClick={previewGlobalSettings} className="rounded-lg border border-[#159d92] bg-white px-4 py-2.5 text-sm font-bold text-[#148d84]">{previewMode ? "Preview active" : "Preview draft"}</button>{previewMode && <button type="button" disabled={globalSaving} onClick={exitPreview} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold">Exit preview</button>}<button type="button" disabled={globalSaving} onClick={() => void saveGlobalSettings()} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{globalSaving ? "Saving…" : "Save global changes"}</button><span className="text-xs text-slate-500">{previewMode ? "Draft styles are visible across this session; they are not saved yet." : "Edit, preview, then save when ready."}</span></div>
      <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-black">Undo history</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(globalSettings) as Array<keyof GlobalEditorSettings>).map((key) => { const revision = globalRevisions.find((item) => item.settingKey === key); return <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><div><div className="text-xs font-bold text-slate-700">{key.replace(/([A-Z])/g, " $1")}</div><div className="text-[11px] text-slate-500">{revision ? `Changed ${new Date(revision.createdAt).toLocaleString()}` : "No saved revision"}</div></div><button type="button" disabled={!revision || globalSaving} onClick={() => void undoGlobalSetting(key)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-[#148d84] disabled:cursor-not-allowed disabled:opacity-40">Undo</button></div>; })}</div><h3 className="mt-6 text-sm font-black">Detailed settings history</h3><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{globalRevisions.length ? globalRevisions.slice(0, 12).map((revision) => <div key={revision.id} className="rounded-lg border border-slate-100 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong>{revision.settingKey.replace(/([A-Z])/g, " $1")}</strong><span className="text-slate-500">{new Date(revision.createdAt).toLocaleString()} · {revision.changedBy}</span></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span className="font-semibold text-slate-500">Before</span><pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[10px]">{JSON.stringify(revision.previousValue, null, 2)}</pre></div><div><span className="font-semibold text-slate-500">After</span><pre className="mt-1 overflow-x-auto rounded bg-teal-50 p-2 text-[10px]">{JSON.stringify(revision.nextValue, null, 2)}</pre></div></div></div>) : <p className="text-sm text-slate-500">Saved appearance revisions will appear here with before-and-after values.</p>}</div></div>
    </section>
  </div>;
}
