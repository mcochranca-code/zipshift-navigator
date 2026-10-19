import React from "react";
import { Bell, BriefcaseBusiness, ChevronRight, ClipboardList, Compass, FileBarChart2, HeartHandshake, LayoutDashboard, ShieldCheck, UsersRound } from "lucide-react";
import { useState } from "react";

type PortalDestination = "home" | "admin-dashboard" | "researcher-analytics" | "staff-intake" | "referrals-dispatch" | "care-coordination" | "specialist-dashboard" | "notifications";
type PortalUser = { displayName: string; email: string; role: "client" | "admin" | "researcher" } | null;

type RolePortalProps = {
  onNavigate: (destination: PortalDestination) => void;
  user?: PortalUser;
};

const roles = [
  { key: "client" as const, label: "Client", description: "Access essential resources, track requested services, and review community assistance centers.", features: ["Direct Help", "Route Finder", "Verified Directory"], icon: Compass, action: "home" as PortalDestination, accent: "#0f766e" },
  { key: "researcher" as const, label: "Researcher", description: "Analyze geographic service distribution, export intake data, and generate outcome reports.", features: ["Data Exporter", "Coverage Heatmaps", "Policy Metrics"], icon: FileBarChart2, action: "researcher-analytics" as PortalDestination, accent: "#2563eb" },
  { key: "admin" as const, label: "Admin Partner", description: "Manage verified provider listings, approve referrals, and configure automated navigation pipelines.", features: ["Listing Approvals", "Access Control", "System Logs"], icon: ShieldCheck, action: "admin-dashboard" as PortalDestination, accent: "#b45309" },
  { key: "care-team" as const, label: "Care Coordination", description: "View specialist caseloads first, then complete intake, Medi-Cal, peer-support, SUD, behavioral-health, and residential-care forms.", features: ["Caseload Dashboard", "Consent Forms", "Warm Handoffs"], icon: HeartHandshake, action: "specialist-dashboard" as PortalDestination, accent: "#0e7490" },
];

export default function RolePortal({ onNavigate, user = null }: RolePortalProps) {
  const [mode, setMode] = useState<"workspace" | "website">("workspace");
  return (
    <main className="zipshift-portal" aria-labelledby="portal-title">
      <header className="zipshift-portal-header">
        <div className="zipshift-portal-eyebrow">AUTHORIZED PORTALS</div>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 id="portal-title">ZipShift Navigator</h1><p>Choose whether you are viewing the public website or entering a role-based workspace. Your verified identity will persist across sessions.</p></div>{user && <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-right text-sm text-[#0f766e]"><div className="font-black">Signed in as {user.displayName}</div><div className="text-xs font-semibold capitalize">{user.role} access · {user.email}</div></div>}</div>
      </header>
      <div className="zipshift-mode-switcher" role="tablist" aria-label="View or website mode"><button type="button" role="tab" aria-selected={mode === "workspace"} className={mode === "workspace" ? "active" : ""} onClick={() => setMode("workspace")}>Workspace mode</button><button type="button" role="tab" aria-selected={mode === "website"} className={mode === "website" ? "active" : ""} onClick={() => setMode("website")}>Website view</button></div>
      {mode === "website" && <section className="zipshift-portal-website-card"><div><span className="zipshift-portal-eyebrow">PUBLIC NAVIGATOR</span><h2>Find verified help near you</h2><p>Browse the public ZipShift resource directory, plan a route, and start a secure client profile when you are ready.</p></div><button type="button" className="zipshift-portal-access" onClick={() => onNavigate("home")}>Open website <ChevronRight size={16} /></button></section>}
      <nav className="zipshift-portal-tabs" aria-label="Portal workflow shortcuts">
        <button type="button" onClick={() => onNavigate("home")}><Compass size={16} /> Client</button>
        <button type="button" onClick={() => onNavigate("staff-intake")}><ClipboardList size={16} /> Staff intake</button>
        <button type="button" onClick={() => onNavigate("referrals-dispatch")}><BriefcaseBusiness size={16} /> Referrals</button>
        <button type="button" onClick={() => onNavigate("care-coordination")}><HeartHandshake size={16} /> Care team</button>
        <button type="button" onClick={() => onNavigate("specialist-dashboard")}><LayoutDashboard size={16} /> Specialist dashboard</button>
        <button type="button" onClick={() => onNavigate("notifications")}><Bell size={16} /> Notifications</button>
      </nav>
      <section className="zipshift-portal-grid" aria-label="Available ZipShift workspaces">
        {roles.map(({ key, label, description, features, icon: Icon, action, accent }) => (
          <article className="zipshift-portal-card" key={key} style={{ "--portal-accent": accent } as React.CSSProperties}>
            <div className="zipshift-portal-card-icon"><Icon size={21} aria-hidden="true" /></div>
            <h2>{label}</h2>
            <p>{description}</p>
            <div className="zipshift-portal-feature-list">{features.map((feature) => <span key={feature}>{feature}</span>)}</div>
            <button type="button" className="zipshift-portal-access" onClick={() => onNavigate(action)}>Access workspace <ChevronRight size={16} /></button>
          </article>
        ))}
      </section>
      <footer className="zipshift-portal-footer"><UsersRound size={14} /> End-to-end encrypted wayfinding network. Stanislaus citizen credentials verified.</footer>
    </main>
  );
}
