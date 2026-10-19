import { useEffect, useMemo, useState } from "react";
import AdminControlCenter from "./AdminControlCenter";
import ResearchConsentPanel from "./ResearchConsentPanel";

interface ClientUser {
  id: string;
  email: string;
  displayName: string;
  role: "client" | "admin" | "researcher";
}

interface ProfileData {
  phone: string | null;
  city: string | null;
  language: "en" | "es";
  accessibility: string[];
}

interface ProviderSummary {
  record_id: string;
  org_name: string;
  service_category: string;
  city: string;
  phone: string;
  hours: string;
}

interface ClientCase {
  id: string;
  caseNumber: string;
  serviceCategory: string;
  status: string;
  priority: string;
  createdAt: number;
  updatedAt: number;
}

interface ClientProfileProps {
  providers: ProviderSummary[];
  onBack: () => void;
  onSessionChange: (user: ClientUser | null, saved: string[]) => void;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new Error("The service returned an unexpected response."); }
  if (!response.ok) throw new Error(body?.error || "Request failed.");
  return body as T;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

export default function ClientProfile({ providers, onBack, onSessionChange }: ClientProfileProps) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [profile, setProfile] = useState<ProfileData>({ phone: "", city: "", language: "en", accessibility: [] });
  const [saved, setSaved] = useState<string[]>([]);
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "create" | "forgot">("signin");
  const [form, setForm] = useState({ displayName: "", email: "", password: "", dateOfBirth: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedProviders = useMemo(() => providers.filter((provider) => saved.includes(provider.record_id)), [providers, saved]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const auth = await requestJson<{ user: ClientUser }>("/api/auth/me");
      if (auth.user.role !== "client") {
        setUser(auth.user);
        setProfile({ phone: "", city: "", language: "en", accessibility: [] });
        setSaved([]);
        setCases([]);
        onSessionChange(auth.user, []);
        return;
      }
      const [profileResult, savedResult, caseResult] = await Promise.all([
        requestJson<{ user: ClientUser; profile: ProfileData | null }>("/api/profile"),
        requestJson<{ saved: Array<{ providerId: string }> }>("/api/saved-resources"),
        requestJson<{ cases: ClientCase[] }>("/api/cases/mine"),
      ]);
      setUser(profileResult.user);
      setProfile(profileResult.profile || { phone: "", city: "", language: "en", accessibility: [] });
      const savedIds = savedResult.saved.map((item) => item.providerId);
      setSaved(savedIds);
      setCases(caseResult.cases);
      onSessionChange(profileResult.user, savedIds);
    } catch {
      setUser(null);
      setSaved([]);
      onSessionChange(null, []);
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadProfile(); }, []);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await requestJson(mode === "create" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? form : { email: form.email, password: form.password }),
      });
      await loadProfile();
      setNotice(mode === "create" ? "Your client profile is ready." : "Welcome back.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue."); }
  };

  const requestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await requestJson<{ message: string; resetToken?: string }>("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) });
      setNotice(result.resetToken ? `${result.message} Development reset token: ${result.resetToken}` : result.message);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start password recovery."); }
  };

  const saveProfile = async () => {
    setError(null);
    try {
      await requestJson("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: user?.displayName, ...profile }),
      });
      setNotice("Profile saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save your profile."); }
  };

  const removeSaved = async (providerId: string) => {
    try {
      await requestJson(`/api/saved-resources/${providerId}`, { method: "DELETE" });
      const next = saved.filter((id) => id !== providerId);
      setSaved(next);
      onSessionChange(user, next);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove the saved resource."); }
  };

  const logout = async () => {
    await requestJson("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setSaved([]);
    onSessionChange(null, []);
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm font-semibold text-slate-500">Loading your secure profile…</div>;

  return <div className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-[#142846] md:px-8 lg:px-12"><div className="mx-auto max-w-6xl"><header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#159d92]">ZipShift</p><h1 className="mt-1 text-3xl font-black tracking-tight">{user ? "Your Profile" : "Your ZipShift Profile"}</h1><p className="mt-1 text-sm text-slate-500">{user ? "Manage your saved resources, accessibility preferences, and referral history." : "Create a secure client account to save resources and follow your referral requests."}</p></div><button onClick={onBack} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Back to ZipShift</button></header>{error && <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}{notice && <div className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-[#148d84]">{notice}</div>}
    {!user ? <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1"><button onClick={() => setMode("signin")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "signin" ? "bg-white text-[#142846] shadow-sm" : "text-slate-500"}`}>Sign in</button><button onClick={() => setMode("create")} className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "create" ? "bg-white text-[#142846] shadow-sm" : "text-slate-500"}`}>Create account</button></div>{mode === "forgot" ? <form onSubmit={requestPasswordReset} className="space-y-4"><p className="text-sm leading-6 text-slate-500">Enter your email and we’ll prepare a time-limited reset link. For safety, the response does not reveal whether an account exists.</p><label className="block text-sm font-bold text-slate-700">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="you@example.com" /></label><button className="w-full rounded-lg bg-[#159d92] px-4 py-3 text-sm font-bold text-white hover:bg-[#0d8077]">Prepare reset</button><button type="button" onClick={() => setMode("signin")} className="w-full text-sm font-bold text-[#148d84]">Back to sign in</button></form> : <form onSubmit={submitAuth} className="space-y-4">{mode === "create" && <><label className="block text-sm font-bold text-slate-700">Name<input required minLength={2} maxLength={100} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="Your name" /></label><label className="block text-sm font-bold text-slate-700">Date of birth<input required type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" /><span className="mt-1 block text-xs font-normal text-slate-500">Used only for logical age validation (0–120).</span></label></>}<label className="block text-sm font-bold text-slate-700">Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="you@example.com" /></label><label className="block text-sm font-bold text-slate-700">Password<input required minLength={12} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" placeholder="At least 12 characters, with a number" /></label><button className="w-full rounded-lg bg-[#159d92] px-4 py-3 text-sm font-bold text-white hover:bg-[#0d8077]">{mode === "create" ? "Create secure profile" : "Sign in"}</button>{mode === "signin" && <button type="button" onClick={() => setMode("forgot")} className="w-full text-sm font-bold text-[#148d84]">Forgot password?</button>}</form>}</section> : user.role !== "client" ? <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#159d92]">Account profile</p><h2 className="mt-1 text-2xl font-black">{user.displayName}</h2><p className="mt-1 text-sm text-slate-500">{user.email} · {user.role === "admin" ? "Super administrator" : "Researcher"}</p><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Your account profile includes workspace access, security controls, and role-specific tools. Changes are protected by your authenticated session.</p></div>
          <button onClick={() => void logout()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-[#148d84] hover:bg-slate-50">Sign out</button>
        </div>
      </section>
      {user.role === "admin" && <AdminControlCenter />}
    </div> : <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">{user.displayName}</h2><p className="mt-1 text-sm text-slate-500">{user.email}</p></div><button onClick={() => void logout()} className="text-sm font-bold text-[#148d84]">Sign out</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-bold text-slate-700">Phone<input value={profile.phone || ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-[#159d92]" /></label><label className="block text-sm font-bold text-slate-700">Home city<select value={profile.city || ""} onChange={(event) => setProfile({ ...profile, city: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#159d92]"><option value="">Select city</option><option>Modesto</option><option>Turlock</option><option>Ceres</option></select></label><label className="block text-sm font-bold text-slate-700">Language<select value={profile.language} onChange={(event) => setProfile({ ...profile, language: event.target.value as "en" | "es" })} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-[#159d92]"><option value="en">English</option><option value="es">Español</option></select></label><fieldset><legend className="text-sm font-bold text-slate-700">Accessibility preferences</legend><div className="mt-2 space-y-2">{["Large print", "Screen reader support", "Sign language interpreter"].map((need) => <label key={need} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={profile.accessibility.includes(need)} onChange={() => setProfile({ ...profile, accessibility: profile.accessibility.includes(need) ? profile.accessibility.filter((item) => item !== need) : [...profile.accessibility, need] })} className="accent-[#159d92]" />{need}</label>)}</div></fieldset><button onClick={() => void saveProfile()} className="w-full rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white">Save profile</button></div></section><div className="space-y-6"><section className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="text-xl font-black">Saved resources</h2><p className="mt-1 text-sm text-slate-500">Resources you have flagged for follow-up.</p></div>{savedProviders.length ? <div className="divide-y divide-slate-100">{savedProviders.map((provider) => <div key={provider.record_id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-black">{provider.org_name}</p><p className="mt-1 text-sm text-slate-500">{provider.service_category} · {provider.city}</p><p className="mt-1 text-xs text-slate-500">{provider.hours}</p></div><button onClick={() => void removeSaved(provider.record_id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">Remove</button></div>)}</div> : <p className="p-8 text-sm text-slate-500">No saved resources yet. Use the heart button while browsing the directory to add resources here.</p>}</section><ResearchConsentPanel /><section className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-5"><h2 className="text-xl font-black">Referral history</h2><p className="mt-1 text-sm text-slate-500">Track your requests without exposing case notes.</p></div>{cases.length ? <div className="divide-y divide-slate-100">{cases.map((caseRecord) => <div key={caseRecord.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-black text-[#148d84]">{caseRecord.caseNumber}</p><p className="mt-1 text-sm text-slate-600">{caseRecord.serviceCategory}</p><p className="mt-1 text-xs text-slate-500">Submitted {formatDate(caseRecord.createdAt)}</p></div><span className="rounded bg-teal-50 px-2.5 py-1 text-xs font-bold capitalize text-[#148d84]">{caseRecord.status.replace("_", " ")}</span></div>)}</div> : <p className="p-8 text-sm text-slate-500">Your referral requests will appear here after you submit intake forms while signed in.</p>}</section></div></div>}</div></div>;
}
