import React, { useEffect, useState } from "react";
import { BellRing, CheckCircle2, RefreshCw } from "lucide-react";

export type NotificationRecord = { id: string; title: string; message: string; createdAt: number };

type NotificationCenterProps = {
  onBack: () => void;
  onProfile: () => void;
  onHelp: () => void;
  onRead?: (id: string) => void;
  initialNotifications?: NotificationRecord[];
};

const READ_KEY = "zipshift-notification-read";
type NotificationFilter = "all" | "privacy" | "consent" | "referral" | "care";

function notificationType(notification: NotificationRecord): Exclude<NotificationFilter, "all"> {
  const value = `${notification.id} ${notification.title}`.toLowerCase();
  if (value.includes("privacy")) return "privacy";
  if (value.includes("consent")) return "consent";
  if (value.includes("care-") || value.includes("handoff") || value.includes("unsigned")) return "care";
  return "referral";
}

function loadReadIds() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export default function NotificationCenter({ onBack, onProfile, onHelp, onRead, initialNotifications = [] }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(initialNotifications);
  const [readIds, setReadIds] = useState<string[]>(loadReadIds);
  const [lastChecked, setLastChecked] = useState(() => new Date());
  const [loading, setLoading] = useState(() => typeof window !== "undefined" && initialNotifications.length === 0);
  const [signedOut, setSignedOut] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (response.status === 401) { setSignedOut(true); setNotifications([]); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Unable to load notifications.");
      setSignedOut(false);
      setNotifications(body.notifications || []);
      setLastChecked(new Date());
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const markRead = (id: string) => {
    const wasUnread = !readIds.includes(id);
    setReadIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-100)));
      return next;
    });
    if (wasUnread) onRead?.(id);
  };

  const unread = notifications.filter((notification) => !readIds.includes(notification.id)).length;
  const visibleNotifications = notifications.filter((notification) => filter === "all" || notificationType(notification) === filter);
  const markAllRead = () => {
    const ids = notifications.map((notification) => notification.id);
    setReadIds((current) => { const next = Array.from(new Set([...current, ...ids])); localStorage.setItem(READ_KEY, JSON.stringify(next.slice(-100))); return next; });
  };

  return (
    <main className="zipshift-client-page" style={{ minHeight: "100vh", background: "#f6fafb", color: "#102f3c", padding: "24px 20px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <button aria-label="Go back" onClick={onBack} style={{ border: 0, background: "transparent", color: "#159d92", fontSize: 30, cursor: "pointer", lineHeight: 1 }}>‹</button>
          <div><p style={{ margin: 0, color: "#159d92", fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>ZipShift</p><h1 style={{ margin: "4px 0 0", fontSize: 28, letterSpacing: "-0.03em" }}>Notifications</h1><p style={{ margin: "5px 0 0", color: "#5d7480", fontSize: 12 }}>Privacy notices, consent agreements, and referral updates.</p></div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{unread > 0 && <span style={{ padding: "6px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>{unread} unread</span>}{unread > 0 && <button onClick={markAllRead} style={{ border: "1px solid #d9e8eb", borderRadius: 999, background: "#fff", color: "#0f766e", padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Mark all as read</button>}</div>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }} aria-label="Filter notifications">{(["all", "privacy", "consent", "referral", "care"] as NotificationFilter[]).map((option) => <button key={option} onClick={() => setFilter(option)} style={{ border: `1px solid ${filter === option ? "#159d92" : "#d9e8eb"}`, borderRadius: 999, background: filter === option ? "#e3f5f3" : "#fff", color: filter === option ? "#0f766e" : "#5d7480", padding: "7px 11px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{option === "all" ? "All" : option === "privacy" ? "Privacy notices" : option === "consent" ? "Consent agreements" : option === "referral" ? "Referral updates" : "Care reminders"}</button>)}</div>
        {loading ? <section style={{ background: "#ffffff", border: "1px solid #d9e8eb", borderRadius: 24, padding: "42px 24px", textAlign: "center", color: "#5d7480" }}>Loading live updates…</section> : visibleNotifications.length > 0 ? <section style={{ display: "grid", gap: 10 }}>{visibleNotifications.map((notification) => { const read = readIds.includes(notification.id); return <button key={notification.id} onClick={() => markRead(notification.id)} style={{ textAlign: "left", display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 12, alignItems: "center", padding: 16, background: read ? "#ffffff" : "#e3f5f3", border: `1px solid ${read ? "#d9e8eb" : "#b8d9d8"}`, borderRadius: 14, color: "#102f3c", cursor: "pointer" }}><div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, background: read ? "#eef4f6" : "#ffffff", color: "#0f766e" }}><BellRing size={20} aria-hidden="true" /></div><div><strong style={{ display: "block", fontSize: 14 }}>{notification.title}</strong><span style={{ display: "block", marginTop: 4, color: "#5d7480", fontSize: 12 }}>{notification.message}</span><span style={{ display: "block", marginTop: 5, color: "#8aa0a8", fontSize: 11 }}>{new Date(notification.createdAt).toLocaleString()}</span></div>{!read && <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#159d92" }} aria-label="Unread" />}</button>; })}</section> : <section style={{ background: "#ffffff", border: "1px solid #d9e8eb", borderRadius: 24, padding: "36px 24px", textAlign: "center", boxShadow: "0 16px 36px rgba(16,47,60,0.08)" }}><div aria-hidden="true" style={{ width: 64, height: 64, margin: "0 auto 18px", display: "grid", placeItems: "center", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}>{signedOut ? <BellRing size={30} /> : <CheckCircle2 size={30} />}</div><h2 style={{ margin: 0, fontSize: 22 }}>{signedOut ? "Sign in to see personal updates" : filter === "all" ? "You’re all caught up" : "No notifications in this filter"}</h2><p style={{ maxWidth: 460, margin: "12px auto 0", color: "#5d7480", lineHeight: 1.6 }}>{signedOut ? "Sign in to connect notifications to your saved resources and referral history." : "Privacy notices, consent agreements, and referral updates will appear here when available."}</p><p style={{ margin: "18px 0 0", color: "#8aa0a8", fontSize: 12 }}>Last checked {lastChecked.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><button onClick={() => void refresh()} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 22, border: "1px solid #b8d9d8", borderRadius: 12, background: "#ffffff", color: "#0f766e", padding: "11px 18px", fontWeight: 700, cursor: "pointer" }}><RefreshCw size={15} />Check again</button></section>}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginTop: 16 }}><button onClick={onProfile} style={{ textAlign: "left", border: "1px solid #d9e8eb", borderRadius: 18, padding: 18, background: "#ffffff", color: "#102f3c", cursor: "pointer" }}><strong style={{ display: "block", marginBottom: 6 }}>Manage your profile</strong><span style={{ color: "#5d7480", fontSize: 13, lineHeight: 1.45 }}>Review saved resources and referral history.</span></button><button onClick={onHelp} style={{ textAlign: "left", border: "1px solid #d9e8eb", borderRadius: 18, padding: 18, background: "#ffffff", color: "#102f3c", cursor: "pointer" }}><strong style={{ display: "block", marginBottom: 6 }}>Need help now?</strong><span style={{ color: "#5d7480", fontSize: 13, lineHeight: 1.45 }}>Connect to ZipShift to start an intake request.</span></button></section>
      </div>
    </main>
  );
}
