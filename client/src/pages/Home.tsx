import { useState, useEffect, useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Accessibility, Activity, ArrowLeft, ArrowRight, Bell, Brain, Building2, BusFront, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3, ClipboardList, FileText, Globe2, Heart, HeartPulse, Home as HomeIcon, House, Info, Landmark, Map, MapPin, Menu, MessageSquare, MoreHorizontal, Navigation, Phone, Scale, Search, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, UserCircle, UsersRound, Utensils, X } from "lucide-react";
import ZipShiftMap from "../components/ZipShiftMap";
import IntakeFormFlow from "../components/IntakeFormFlow";
import AdminDashboard from "../components/AdminDashboard";
import ResearcherAnalytics from "../components/ResearcherAnalytics";
import ReferralHistory from "../components/ReferralHistory";
import ClientProfile from "../components/ClientProfile";
import ClientDirectory from "../components/ClientDirectory";
import NotificationCenter from "../components/NotificationCenter";
import EmergencyResourceDirectory from "../components/EmergencyResourceDirectory";
import CountyResourceDirectory from "../components/CountyResourceDirectory";
import ClientQuickGuideModal from "../components/ClientQuickGuideModal";
import ReferralDestinationFlow from "../components/ReferralDestinationFlow";
import RolePortal from "../components/RolePortal";
import StaffIntakeFlow from "../components/StaffIntakeFlow";
import ReferralsDispatch from "../components/ReferralsDispatch";
import CareCoordinationPortal from "../components/CareCoordinationPortal";
import SpecialistDashboard from "../components/SpecialistDashboard";
import GuidedAccess from "../components/GuidedAccess";
import providersData from "../data/providers.json";
import { announce, useDialogA11y, useScreenChangeFocus } from "../lib/a11y";
import { BrandedSplash } from "../components/motion/Loaders";
import Breadcrumbs from "../components/Breadcrumbs";
import { acceptsWalkIns, documentsToBring, hoursStatus, isVerified, noIdRequired } from "../../../shared/providerAccess";
import { CONTACT_PREFERENCES, CONTACT_PREFERENCE_LABELS, HOUSING_STATUSES, HOUSING_STATUS_LABELS, contactNeedsPhone, type ContactPreference, type HousingStatus } from "../../../shared/accessOutcomes";

interface Provider {
  record_id: string;
  org_name: string;
  program_name: string;
  city: string;
  service_category: string;
  phone: string;
  website: string;
  address: string;
  hours: string;
  walk_in_allowed: string;
  referral_required: string;
  documents_required: string[];
  document_alternatives: string[];
  language_access: string;
  ada_access: string;
  pets_policy: string;
  partners_policy: string;
  capacity_status: string;
  waitlist_status: string;
  verification_status: string;
  verification_date: string;
  qr_record_id: string;
  transit_feasibility: string;
  service_node_cluster: string;
  referral_sources: string;
  hsai_score: number;
  lat: number;
  lng: number;
}

type Screen =
  | "splash" | "home" | "map" | "favorites" | "gethelp" | "more"
  | "search-results" | "resource-detail" | "before-you-go" | "directions"
  | "about" | "privacy" | "terms" | "feedback" | "settings"
  | "intake-form" | "admin-dashboard" | "researcher-analytics" | "referral-history" | "client-profile" | "client-directory" | "county-directory" | "emergency-directory" | "notifications" | "referral-destination" | "role-portal" | "staff-intake" | "referrals-dispatch" | "care-coordination" | "specialist-dashboard" | "guided-entry";

interface ClientSessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "client" | "admin" | "researcher";
}

type GlobalEditorSettings = {
  brandColor: string;
  accentColor: string;
  surfaceColor: string;
  textScale: number;
  radiusScale: number;
  sidebarDefaultCollapsed: boolean;
};

type QuickGuideProvider = { record_id: string; org_name: string; program_name: string; city: string; service_category: string; phone: string; address: string; hours: string; website: string; lastVerified?: string };

const GREENBOOK_LOGO = "/manus-storage/greenbook_logo_cleaned_a29b2032.png";
const AOR_LOGO = "/manus-storage/aor_logo_cleaned_8ed4cc4a.png";
const ZIPSHIFT_LOGO = "/manus-storage/zipshift_logo_cleaned_354ed835.png";
const PROMO_VIDEO = "/manus-storage/zipshift-navigator-website-promo-30s_1fd1b365.mp4";
const RESOURCE_LOGOS = {
  county: "/manus-storage/01-stanislaus-county-oes_b879595d.png",
  directory: "/manus-storage/02-211-stanislaus_acf1341e.png",
  csa: "/manus-storage/03-stanislaus-csa_bce1b650.png",
  health: "/manus-storage/11-stanislaus-health-services_fff30c5a.png",
  behavioral: "/manus-storage/12-stanislaus-behavioral-health_5fb3c96b.png",
  mission: "/manus-storage/05-modesto-gospel-mission_198ce3e7.png",
  salvation: "/manus-storage/06-salvation-army-modesto_9887aca5.png",
  samaritan: "/manus-storage/07-united-samaritans_e3d1c66b.png",
  humanServices: "/manus-storage/08-center-human-services_e84b379f.png",
  turlockMission: "/manus-storage/09-turlock-gospel-mission_2e3f3532.png",
};
function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getProviderLogo(provider: Provider) {
  const value = `${provider.org_name} ${provider.program_name} ${provider.service_category}`.toLowerCase();
  if (value.includes("211")) return RESOURCE_LOGOS.directory;
  if (value.includes("behavioral") || value.includes("bhrs")) return RESOURCE_LOGOS.behavioral;
  if (value.includes("health services") || value.includes("public health")) return RESOURCE_LOGOS.health;
  if (value.includes("community services agency") || value.includes("csa")) return RESOURCE_LOGOS.csa;
  if (value.includes("gospel mission") && value.includes("turlock")) return RESOURCE_LOGOS.turlockMission;
  if (value.includes("gospel mission")) return RESOURCE_LOGOS.mission;
  if (value.includes("salvation army")) return RESOURCE_LOGOS.salvation;
  if (value.includes("united samaritan")) return RESOURCE_LOGOS.samaritan;
  if (value.includes("center for human") || value.includes("youth navigation")) return RESOURCE_LOGOS.humanServices;
  return RESOURCE_LOGOS.county;
}

const CATEGORIES: Array<{ id: string; label: string; icon: LucideIcon; color: string }> = [
  { id: "emergency-shelter", label: "Emergency\nShelter", icon: House, color: "var(--zs-color-brand)" },
  { id: "food-meals", label: "Food &\nMeals", icon: Utensils, color: "#15803d" },
  { id: "medical", label: "Medical", icon: Stethoscope, color: "#dc2626" },
  { id: "behavioral-health", label: "Behavioral\nHealth", icon: Brain, color: "#7c3aed" },
  { id: "housing", label: "Housing\nAccess", icon: Building2, color: "#d97706" },
  { id: "documents", label: "Documents\n& ID", icon: FileText, color: "#0891b2" },
  { id: "transportation", label: "Transportation", icon: BusFront, color: "#059669" },
  { id: "hygiene", label: "Hygiene", icon: Activity, color: "#6366f1" },
  { id: "legal", label: "Legal\nHelp", icon: Scale, color: "#b45309" },
  { id: "case-management", label: "Case\nManagement", icon: UsersRound, color: "#0f766e" },
];

const COVERED_ZIPS = [
  { code: "95307", label: "95307 · Ceres" },
  { code: "95350", label: "95350 · Modesto" },
  { code: "95351", label: "95351 · Modesto" },
  { code: "95354", label: "95354 · Modesto" },
  { code: "95355", label: "95355 · Modesto" },
  { code: "95356", label: "95356 · Modesto" },
  { code: "95357", label: "95357 · Modesto" },
  { code: "95358", label: "95358 · Modesto" },
  { code: "95380", label: "95380 · Turlock" },
  { code: "95381", label: "95381 · Turlock" },
  { code: "95382", label: "95382 · Turlock" },
];

function getCategoryForProvider(p: Provider): string {
  const cat = (p.service_category || "").toLowerCase();
  if (cat.includes("shelter") || cat.includes("emergency")) return "emergency-shelter";
  if (cat.includes("food") || cat.includes("meal") || cat.includes("calfresh") || cat.includes("pantry")) return "food-meals";
  if (cat.includes("medical") || cat.includes("health") || cat.includes("fqhc") || cat.includes("public health")) return "medical";
  if (cat.includes("behavioral") || cat.includes("mental") || cat.includes("bh") || cat.includes("sud") || cat.includes("crisis")) return "behavioral-health";
  if (cat.includes("housing") || cat.includes("voucher") || cat.includes("family shelter")) return "housing";
  if (cat.includes("document") || cat.includes("benefits") || cat.includes("medi-cal")) return "documents";
  if (cat.includes("transport")) return "transportation";
  if (cat.includes("domestic") || cat.includes("violence") || cat.includes("safety")) return "legal";
  return "case-management";
}

const DISTANCES: Record<string, string> = {
  "PV-0001": "0.8 mi", "PV-0002": "1.2 mi", "PV-0003": "0.9 mi",
  "PV-0004": "1.1 mi", "PV-0005": "0.7 mi", "PV-0006": "14.2 mi",
  "PV-0007": "2.3 mi", "PV-0008": "1.8 mi", "PV-0009": "1.5 mi",
  "PV-0010": "2.1 mi", "PV-0011": "3.4 mi", "PV-0012": "4.2 mi",
  "PV-0013": "2.7 mi", "PV-0014": "1.3 mi", "PV-0015": "1.3 mi",
  "PV-0016": "1.3 mi", "PV-0017": "1.6 mi", "PV-0018": "13.8 mi",
  "PV-0019": "1.9 mi", "PV-0020": "14.5 mi",
};

function getDistanceLabel(p: Provider): string {
  return DISTANCES[p.record_id] || "2.0 mi";
}

type HoursDisplay = { state: "open" | "closed" | "unknown"; word: string; label: string; color: string };

/**
 * Hours shown to people deciding whether to make the trip. Only parseable
 * schedules get an open/closed answer; everything else says to call first.
 * (Previously every non-24/7 listing showed "Open · Closes 5:00 PM".)
 */
function hoursDisplay(p: Provider, language: "en" | "es" = "en", now = new Date()): HoursDisplay {
  const status = hoursStatus(p.hours, now);
  const es = language === "es";
  const hoursText = (p.hours || "").trim();
  const short = hoursText.length > 48 ? `${hoursText.slice(0, 47)}…` : hoursText;
  if (status.state === "open") return { state: "open", word: es ? "Abierto" : "Open", label: status.closesAt ? (es ? `Cierra a las ${status.closesAt}` : `Closes ${status.closesAt}`) : (es ? "Abierto 24/7" : "Open 24/7"), color: "#15803d" };
  if (status.state === "closed") return { state: "closed", word: es ? "Cerrado ahora" : "Closed now", label: short, color: "#b91c1c" };
  return { state: "unknown", word: es ? "Llame para confirmar el horario" : "Call to confirm hours", label: short || (es ? "Horario no publicado" : "Hours not listed"), color: "#b45309" };
}

const LOCAL_KEYS = { saved: "zipshift.saved.local", recent: "zipshift.recent.local", language: "zipshift.language", largeText: "zipshift.largeText", lowData: "zipshift.lowData", sharedDevice: "zipshift.sharedDevice", lastReferral: "zipshift.lastReferralCode" } as const;
function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw) as T; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
}
function removeLocal(keys: string[]) {
  try { keys.forEach((key) => localStorage.removeItem(key)); } catch { /* storage may be unavailable */ }
}
function prefersSaveData() {
  try { return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData); } catch { return false; }
}

function spanishServiceLabel(value: string) {
  const labels: Record<string, string> = { "Emergency Shelter": "Refugio de emergencia", "Food & Meals": "Alimentos y comidas", Medical: "Atención médica", "Behavioral Health": "Salud conductual", Housing: "Vivienda", Transportation: "Transporte", "Case Management": "Administración de casos", "Document Assistance": "Ayuda con documentos", "Substance Use": "Consumo de sustancias" };
  return value.split("/").map((part) => labels[part.trim()] || part.trim()).join(" / ");
}

function spanishProviderDescription(provider: Provider) {
  return `${spanishServiceLabel(provider.service_category)} en ${provider.city}. Confirma horarios, documentos y disponibilidad antes de ir.`;
}

type FieldEventType = "guided_start" | "guided_completion" | "guided_dropoff" | "resource_open" | "resource_call" | "resource_directions" | "resource_website" | "resource_share" | "resource_save" | "before_you_go_open" | "directions_handoff" | "search_no_results";
function sendFieldEvent(eventType: FieldEventType, resourceId?: string, metadata?: Record<string, unknown>) {
  let sessionKey = "";
  try { const key = "zipshift.field-test.session"; sessionKey = localStorage.getItem(key) || crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(key, sessionKey); } catch { /* optional when storage is unavailable */ }
  void fetch("/api/analytics/field-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType, resourceId, sessionKey, metadata }) }).catch(() => undefined);
}

function getCategoryIcon(catId: string): LucideIcon {
  return CATEGORIES.find((c) => c.id === catId)?.icon ?? MapPin;
}

function getCategoryColor(catId: string): string {
  return CATEGORIES.find((c) => c.id === catId)?.color ?? "var(--zs-color-brand)";
}

// Renders an inline render-function as a STABLE component type. Home builds
// its chrome (header, menus, nav) as closures; rendering them as `<RenderSlot render={Header} />`
// created a new component type every render, remounting the DOM and dropping
// keyboard focus. `<RenderSlot render={Header} />` keeps the DOM stable.
function RenderSlot<P extends object>({ render, ...props }: { render: (props: P) => ReactNode } & P) {
  return <>{render(props as unknown as P)}</>;
}

// Announced (and used as document.title) when the screen changes.
const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  home: "Home", map: "Resource map", favorites: "Saved resources", gethelp: "Get help", more: "More",
  "search-results": "Search results", "resource-detail": "Resource detail", "before-you-go": "Before you go", directions: "Directions",
  about: "About", privacy: "Privacy", terms: "Terms", feedback: "Feedback", settings: "Settings",
  "intake-form": "Intake form", "admin-dashboard": "Admin workspace", "researcher-analytics": "Research workspace", "referral-history": "Referral history",
  "client-profile": "Profile", "client-directory": "Client directory", "county-directory": "County resource directory", "emergency-directory": "Emergency resources",
  notifications: "Notifications", "referral-destination": "Referral destination", "role-portal": "Choose a workspace", "staff-intake": "Staff intake",
  "referrals-dispatch": "Referrals dispatch", "care-coordination": "Care coordination", "specialist-dashboard": "Specialist dashboard", "guided-entry": "Guided start",
};

function CategoryGlyph({ catId, size = 24 }: { catId: string; size?: number }) {
  const Icon = getCategoryIcon(catId);
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [prevScreen, setPrevScreen] = useState<Screen>("home");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [language, setLanguage] = useState<"en" | "es">(() => readLocal<string>(LOCAL_KEYS.language, "en") === "es" ? "es" : "en");
  const [darkMode, setDarkMode] = useState(false);
  const [largeText, setLargeText] = useState(() => readLocal<boolean>(LOCAL_KEYS.largeText, false) === true);
  // Low-data mode skips the promo video and provider logos; it starts on when the browser asks to save data.
  const [lowData, setLowData] = useState(() => readLocal<boolean | null>(LOCAL_KEYS.lowData, null) ?? prefersSaveData());
  // Shared-phone mode keeps saved places, recent views and referral codes off this device.
  const [sharedDevice, setSharedDevice] = useState(() => readLocal<boolean>(LOCAL_KEYS.sharedDevice, false) === true);
  const [walkInOnly, setWalkInOnly] = useState(false);
  const [noIdOnly, setNoIdOnly] = useState(false);
  const [lastReferralCode, setLastReferralCode] = useState<string | null>(() => readLocal<boolean>(LOCAL_KEYS.sharedDevice, false) ? null : readLocal<string | null>(LOCAL_KEYS.lastReferral, null));
  const [shareStatus, setShareStatus] = useState("");
  const [reduceMotion, setReduceMotion] = useState(() => {
    try { return localStorage.getItem("zipshift.reduceMotion") === "true"; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("zipshift.sidebar.collapsed") === "true"; } catch { return false; }
  });
  const [globalSettings, setGlobalSettings] = useState<GlobalEditorSettings>({ brandColor: "#159d92", accentColor: "#0d8077", surfaceColor: "#f7f9fc", textScale: 1, radiusScale: 1, sidebarDefaultCollapsed: false });
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZip, setSelectedZip] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(25);
  const [openNow, setOpenNow] = useState(false);
  const [savedProviders, setSavedProviders] = useState<string[]>(() => readLocal<boolean>(LOCAL_KEYS.sharedDevice, false) ? [] : readLocal<string[]>(LOCAL_KEYS.saved, []).filter((id) => typeof id === "string"));
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => readLocal<boolean>(LOCAL_KEYS.sharedDevice, false) ? [] : readLocal<string[]>(LOCAL_KEYS.recent, []).filter((id) => typeof id === "string"));
  const [favTab, setFavTab] = useState<"favorites" | "recent">("favorites");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<"all" | "Modesto" | "Turlock" | "Ceres">("all");
  const [activeNavTab, setActiveNavTab] = useState<"home" | "map" | "favorites" | "gethelp" | "more">("home");
  const [dirMode, setDirMode] = useState<"drive" | "transit" | "walk" | "bike">("transit");
  const [aorStep, setAorStep] = useState(0);
  const [aorData, setAorData] = useState({ name: "", phone: "", situation: "", needs: [] as string[], consent: false, contactPreference: "" as ContactPreference | "", housingStatus: "" as HousingStatus | "", sdohConsent: false });
  const [aorHandoff, setAorHandoff] = useState<{ outcome: string; failureReason: string; documentBurden: string; transitFeasibility: string; reviewConfirmed: boolean } | null>(null);
  const [aorSubmitted, setAorSubmitted] = useState(false);
  const [aorSubmitting, setAorSubmitting] = useState(false);
  const [aorSubmitError, setAorSubmitError] = useState("");
  const [feedbackAccess, setFeedbackAccess] = useState<"easy" | "not_easy" | null>(null);
  const [feedbackBarriers, setFeedbackBarriers] = useState<string[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [clientUser, setClientUser] = useState<ClientSessionUser | null>(null);
  const [sessionUser, setSessionUser] = useState<ClientSessionUser | null>(null);
  const [providers, setProviders] = useState<Provider[]>(providersData as Provider[]);
  const [guideProviders, setGuideProviders] = useState<QuickGuideProvider[]>([]);
  const [navigatorLoading, setNavigatorLoading] = useState(true);
  const [navigatorLoadError, setNavigatorLoadError] = useState("");
  const [quickGuideOpen, setQuickGuideOpen] = useState(false);
  const [landingConsent, setLandingConsent] = useState<"privacy" | "research" | null>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "geocoding" | "ready" | "denied" | "error">("idle");
  const [manualLocation, setManualLocation] = useState("");
  const [manualCoordinates, setManualCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const authenticatedSession = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const filtersDialogRef = useRef<HTMLDivElement>(null);
  const consentDialogRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerTouchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem("zipshift.sidebar.collapsed", String(sidebarCollapsed)); } catch { /* localStorage may be unavailable */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const apply = (settings: GlobalEditorSettings) => {
      document.documentElement.style.setProperty("--zipshift-brand-color", settings.brandColor);
      document.documentElement.style.setProperty("--zipshift-accent-color", settings.accentColor);
      document.documentElement.style.setProperty("--zipshift-surface-color", settings.surfaceColor);
      document.documentElement.style.setProperty("--zipshift-text-scale", String(settings.textScale));
      document.documentElement.style.setProperty("--zipshift-radius-scale", String(settings.radiusScale));
    };
    apply(globalSettings);
    const onGlobalSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<GlobalEditorSettings>).detail;
      if (detail?.brandColor) { setGlobalSettings(detail); apply(detail); }
    };
    window.addEventListener("zipshift-global-settings-updated", onGlobalSettingsUpdated);
    return () => window.removeEventListener("zipshift-global-settings-updated", onGlobalSettingsUpdated);
  }, [globalSettings]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if ((!menuOpen && touch.clientX <= 26) || (menuOpen && touch.clientX <= 360)) {
        drawerTouchStart.current = { x: touch.clientX, y: touch.clientY };
      } else {
        drawerTouchStart.current = null;
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      const start = drawerTouchStart.current;
      const touch = event.changedTouches[0];
      drawerTouchStart.current = null;
      if (!start || !touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      if (!menuOpen && start.x <= 26 && dx > 0) setMenuOpen(true);
      if (menuOpen && start.x <= 360 && dx < 0) setMenuOpen(false);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [menuOpen]);

  // Mobile drawer, filters sheet and consent dialog share one accessible modal
  // implementation: focus moves in, Tab is trapped, Escape closes, focus returns.
  useDialogA11y(mobileDrawerRef, menuOpen, () => setMenuOpen(false));
  useDialogA11y(filtersDialogRef, filtersOpen, () => setFiltersOpen(false));
  useDialogA11y(consentDialogRef, landingConsent !== null, () => setLandingConsent(null));

  useEffect(() => {
    document.documentElement.dataset.zsTheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    if (reduceMotion) document.documentElement.dataset.zsMotion = "reduce";
    else delete document.documentElement.dataset.zsMotion;
    try { localStorage.setItem("zipshift.reduceMotion", String(reduceMotion)); } catch { /* localStorage may be unavailable */ }
  }, [reduceMotion]);

  useEffect(() => { writeLocal(LOCAL_KEYS.language, language); }, [language]);
  useEffect(() => { writeLocal(LOCAL_KEYS.largeText, largeText); }, [largeText]);
  useEffect(() => { writeLocal(LOCAL_KEYS.lowData, lowData); }, [lowData]);
  useEffect(() => {
    writeLocal(LOCAL_KEYS.sharedDevice, sharedDevice);
    if (sharedDevice) removeLocal([LOCAL_KEYS.saved, LOCAL_KEYS.recent, LOCAL_KEYS.lastReferral, "zipshift.field-test.session"]);
  }, [sharedDevice]);
  useEffect(() => {
    if (sharedDevice) return;
    writeLocal(LOCAL_KEYS.saved, savedProviders);
    writeLocal(LOCAL_KEYS.recent, recentlyViewed);
  }, [savedProviders, recentlyViewed, sharedDevice]);

  useEffect(() => {
    const requestedScreen = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    const allowedScreens: Screen[] = ["admin-dashboard", "researcher-analytics", "client-profile", "client-directory", "county-directory", "emergency-directory", "notifications", "role-portal", "staff-intake", "referrals-dispatch", "care-coordination", "specialist-dashboard"];
    // People looking for help land on the public navigator; staff reach the
    // workspace selector from "Staff sign-in" or ?screen=role-portal.
    const targetScreen = requestedScreen && allowedScreens.includes(requestedScreen) ? requestedScreen : "home";
    const t = setTimeout(() => { if (!authenticatedSession.current) setScreen(targetScreen); }, 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const restoreClientSession = async () => {
      try {
        const [providerResponse, countyResponse, settingsResponse] = await Promise.all([fetch("/api/providers"), fetch("/api/county-resources"), fetch("/api/global-settings")]);
        if (providerResponse.ok) {
          const liveProviders = await providerResponse.json() as Provider[];
          if (Array.isArray(liveProviders) && liveProviders.length > 0) setProviders(liveProviders);
        }
        if (countyResponse.ok) {
          const body = await countyResponse.json() as { resources?: Array<{ id: string; name: string; category: string; phone: string; address: string; hours: string; website: string; serviceArea: string; lastVerified?: string }> };
          setGuideProviders((body.resources || []).map((resource) => ({ record_id: resource.id, org_name: resource.name, program_name: resource.category || "Community resource", city: resource.serviceArea.split(",")[0] || "Stanislaus County", service_category: resource.category || "Community resource", phone: resource.phone || "", address: resource.address || "", hours: resource.hours || "", website: resource.website || "", lastVerified: resource.lastVerified })));
        }
        if (settingsResponse.ok) {
          const body = await settingsResponse.json() as { settings?: GlobalEditorSettings };
          if (body.settings) {
            setGlobalSettings(body.settings);
            try {
              if (!localStorage.getItem("zipshift.sidebar.collapsed") && body.settings.sidebarDefaultCollapsed) setSidebarCollapsed(true);
            } catch { /* localStorage may be unavailable */ }
          }
        }
        const authResponse = await fetch("/api/auth/me", { credentials: "include" });
        if (!authResponse.ok) return;
        const auth = await authResponse.json() as { user?: ClientSessionUser };
        if (!auth.user) return;
        authenticatedSession.current = true;
        setSessionUser(auth.user);
        if (auth.user.role === "client") {
          setClientUser(auth.user);
          const savedResponse = await fetch("/api/saved-resources", { credentials: "include" });
          if (savedResponse.ok) {
            const saved = await savedResponse.json() as { saved?: Array<{ providerId: string }> };
            const serverIds = (saved.saved || []).map((item) => item.providerId);
            // Places saved before signing in move into the account instead of being lost.
            const localIds = readLocal<string[]>(LOCAL_KEYS.saved, []).filter((id) => typeof id === "string" && !serverIds.includes(id));
            await Promise.all(localIds.map((id) => fetch(`/api/saved-resources/${encodeURIComponent(id)}`, { method: "PUT", credentials: "include" }).catch(() => undefined)));
            setSavedProviders([...serverIds, ...localIds]);
          }
        }
        // A valid seven-day session survives refreshes and reopens the
        // correct role workspace instead of dropping administrators into the
        // client profile. Unsigned visitors still land in the workspace selector.
        setScreen(auth.user.role === "admin" ? "admin-dashboard" : auth.user.role === "researcher" ? "researcher-analytics" : "client-profile");
      } catch {
        setNavigatorLoadError("Showing the locally cached resource directory while live data reconnects.");
      } finally {
        setNavigatorLoading(false);
      }
    };
    void restoreClientSession();
  }, []);

  useEffect(() => {
    const refreshNotificationCount = async () => {
      try {
        const response = await fetch("/api/notifications", { credentials: "include" });
        if (!response.ok) { setNotificationCount(0); return; }
        const body = await response.json() as { notifications?: Array<{ id: string }> };
        const raw = localStorage.getItem("zipshift-notification-read");
        const parsed = raw ? JSON.parse(raw) as unknown : [];
        const readIds = Array.isArray(parsed) ? parsed : [];
        setNotificationCount((body.notifications || []).filter((item) => !readIds.includes(item.id)).length);
      } catch { setNotificationCount(0); }
    };
    void refreshNotificationCount();
    const timer = window.setInterval(() => void refreshNotificationCount(), 60000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const staffWorkspace = screen === "admin-dashboard" || screen === "researcher-analytics" || screen === "role-portal" || screen === "staff-intake" || screen === "referrals-dispatch" || screen === "care-coordination" || screen === "specialist-dashboard";
    const clientWorkspace = !staffWorkspace && screen !== "splash";
    document.body.classList.toggle("zipshift-client-shell", clientWorkspace);
    return () => document.body.classList.remove("zipshift-client-shell");
  }, [screen]);

  // Count searches that end with nothing to show (no query text is sent).
  const noResultsKey = `${screen}|${searchQuery}|${selectedCategories.join(",")}|${openNow}|${walkInOnly}|${noIdOnly}|${selectedZip}|${maxDistance}`;
  const lastNoResultsKey = useRef("");
  useEffect(() => {
    if (screen !== "search-results" || lastNoResultsKey.current === noResultsKey) return;
    const timer = window.setTimeout(() => {
      if (filteredProviders.length > 0) return;
      lastNoResultsKey.current = noResultsKey;
      sendFieldEvent("search_no_results", undefined, { categories: selectedCategories.length, walkInOnly, noIdOnly, openNow, hasQuery: Boolean(searchQuery.trim()) });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [noResultsKey]);

  // Move focus to the new screen's heading and announce it (single-page screen router).
  useScreenChangeFocus(screen, SCREEN_TITLES[screen], { skip: screen === "splash" });

  const translations = {
    en: {
      findHelpNearby: "Find help by need. Prepare before you go.",
      searchPlaceholder: "Search services, programs, or keywords",
      browseByCategory: "BROWSE BY CATEGORY",
      nearYou: "NEAR YOU",
      viewAll: "View all",
      open: "Open",
      closed: "Closed",
      verified: "Verified Provider",
      hours: "HOURS",
      services: "SERVICES",
      about: "ABOUT",
      viewAllServices: "View all services",
      callToConfirm: "Call to Confirm",
      iNeedThisHelp: "I Need This Help",
      beforeYouGo: "Before You Go",
      beforeYouGoSubtitle: "A little preparation goes a long way. Use this checklist to help your visit.",
      checklist: "WHAT TO BRING",
      whatToCheck: "WHAT TO CHECK",
      directions: "Directions",
      yourLocation: "Your location",
      recommendedRoute: "RECOMMENDED ROUTE",
      viewOnMap: "View on Map",
      home: "Home",
      map: "Map",
      favorites: "Favorites",
      getHelp: "Get Help",
      more: "More",
      saved: "Saved",
      recentlyViewed: "Recently Viewed",
      noSaved: "No saved resources yet",
      noSavedDesc: "Tap the heart icon on any resource to save it here.",
      helpCenter: "Help Center",
      feedback: "Feedback / Contact Us",
      aboutApp: "About ZipShift",
      privacy: "Privacy Policy",
      terms: "Terms of Use",
      signIn: "Sign In / Create Account",
      profile: "Profile",
      notifications: "Notifications",
      helloThere: "Hello there!",
      signInDesc: "Sign in to save favorites, get personalized recommendations, and more.",
      language: "Language",
      accessibility: "Accessibility",
      largeText: "Large Text",
      colorblind: "Colorblind Mode",
      darkMode: "Dark Mode",
      reduceMotion: "Reduce motion",
      filters: "Filters",
      reset: "Reset",
      categories: "Categories",
      selectAll: "Select all",
      distance: "Distance",
      anyDistance: "Any distance",
      openNow: "Open Now",
      applyFilters: "Apply Filters",
      resources: "resources nearby",
      tapToExplore: "Tap a pin to explore.",
      goodMorning: "Good morning,",
      howCanWeHelp: "How can we help you today?",
      sort: "Sort",
      results: "results",
      searchResultsTitle: "Search results",
      iReadyToGo: "I'm Ready to Go",
      aorTitle: "AOR Feedback / Referral",
      aorSubtitle: "Share your experience and get connected to the right support.",
      submit: "Submit",
      next: "Next",
      back: "Back",
    },
    es: {
      findHelpNearby: "Encuentra ayuda por necesidad. Prepárate antes de ir.",
      searchPlaceholder: "Buscar servicios, programas o palabras clave",
      browseByCategory: "EXPLORAR POR CATEGORÍA",
      nearYou: "CERCA DE TI",
      viewAll: "Ver todo",
      open: "Abierto",
      closed: "Cerrado",
      verified: "Proveedor Verificado",
      hours: "HORARIO",
      services: "SERVICIOS",
      about: "ACERCA DE",
      viewAllServices: "Ver todos los servicios",
      callToConfirm: "Llamar para Confirmar",
      iNeedThisHelp: "Necesito Esta Ayuda",
      beforeYouGo: "Antes de Ir",
      beforeYouGoSubtitle: "Un poco de preparación ayuda mucho. Usa esta lista para tu visita.",
      checklist: "QUÉ TRAER",
      whatToCheck: "QUÉ VERIFICAR",
      directions: "Indicaciones",
      yourLocation: "Tu ubicación",
      recommendedRoute: "RUTA RECOMENDADA",
      viewOnMap: "Ver en el Mapa",
      home: "Inicio",
      map: "Mapa",
      favorites: "Favoritos",
      getHelp: "Obtener Ayuda",
      more: "Más",
      saved: "Guardado",
      recentlyViewed: "Vistos Recientemente",
      noSaved: "No hay recursos guardados aún",
      noSavedDesc: "Toca el ícono de corazón en cualquier recurso para guardarlo aquí.",
      helpCenter: "Centro de Ayuda",
      feedback: "Comentarios / Contáctenos",
      aboutApp: "Acerca de ZipShift",
      privacy: "Política de Privacidad",
      terms: "Términos de Uso",
      signIn: "Iniciar Sesión / Crear Cuenta",
      profile: "Perfil",
      notifications: "Notificaciones",
      helloThere: "¡Hola!",
      signInDesc: "Inicia sesión para guardar favoritos, obtener recomendaciones personalizadas y más.",
      language: "Idioma",
      accessibility: "Accesibilidad",
      largeText: "Texto Grande",
      colorblind: "Modo Daltónico",
      darkMode: "Modo Oscuro",
      reduceMotion: "Reducir movimiento",
      filters: "Filtros",
      reset: "Restablecer",
      categories: "Categorías",
      selectAll: "Seleccionar todo",
      distance: "Distancia",
      anyDistance: "Cualquier distancia",
      openNow: "Abierto Ahora",
      applyFilters: "Aplicar Filtros",
      resources: "recursos cercanos",
      tapToExplore: "Toca un pin para explorar.",
      goodMorning: "Buenos días,",
      howCanWeHelp: "¿Cómo podemos ayudarte hoy?",
      sort: "Ordenar",
      results: "resultados",
      searchResultsTitle: "Resultados de búsqueda",
      iReadyToGo: "Estoy Listo para Ir",
      aorTitle: "AOR Retroalimentación / Referido",
      aorSubtitle: "Comparte tu experiencia y conéctate con el apoyo adecuado.",
      submit: "Enviar",
      next: "Siguiente",
      back: "Atrás",
    },
  };
  const t = translations[language];

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const filteredProviders = providers.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = q === "" || 
      p.org_name.toLowerCase().includes(q) || 
      (p.program_name && p.program_name.toLowerCase().includes(q)) ||
      p.service_category.toLowerCase().includes(q) || 
      p.city.toLowerCase().includes(q) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.language_access && p.language_access.toLowerCase().includes(q));
    
    const pCat = getCategoryForProvider(p);
    const matchesCat = selectedCategories.length === 0 || selectedCategories.includes(pCat);
    
    // "Any distance" (25+) never hides a listing, and a listing with no known
    // distance is not treated as 999 miles away (that hid half the directory).
    const knownDistance = DISTANCES[p.record_id] ? parseFloat(DISTANCES[p.record_id].split(" ")[0]) : null;
    const matchesDistance = maxDistance >= 25 || knownDistance === null || knownDistance <= maxDistance;
    
    const matchesOpenNow = !openNow || hoursStatus(p.hours, new Date()).state === "open";
    const matchesAccess = (!walkInOnly || acceptsWalkIns(p)) && (!noIdOnly || noIdRequired(p));
    const providerZip = p.address?.match(/\b\d{5}\b/)?.[0] || "";
    const matchesZip = selectedZip === "all" || providerZip === selectedZip;
    
    return matchesSearch && matchesCat && matchesDistance && matchesOpenNow && matchesZip && matchesAccess;
  });

  // Theme
  const bg = darkMode ? "#111827" : "#ffffff";
  const fg = darkMode ? "#f9fafb" : "#111827";
  const subFg = darkMode ? "#9ca3af" : "#6b7280";
  const cardBg = darkMode ? "#1f2937" : "#f9fafb";
  const borderColor = darkMode ? "#374151" : "#e5e7eb";
  const fontSize = largeText ? "17px" : "15px";

  // Navigation — clears provider state when going to top-level screens
  const navigate = (to: Screen) => {
    setPrevScreen(screen);
    setScreen(to);
    setMenuOpen(false);
    if (to === "home") { setActiveNavTab("home"); }
    else if (to === "map") { setActiveNavTab("map"); }
    else if (to === "favorites") { setActiveNavTab("favorites"); }
    else if (to === "gethelp") { setActiveNavTab("gethelp"); }
    else if (to === "more") { setActiveNavTab("more"); }
    // Clear provider when navigating away from detail screens
    if (!["resource-detail", "before-you-go", "directions"].includes(to)) {
      if (["home", "map", "favorites", "gethelp", "more", "search-results"].includes(to)) {
        // keep provider for back-nav from detail
      }
    }
  };

  const goBack = () => {
    setScreen(prevScreen);
    if (prevScreen === "home") setActiveNavTab("home");
    else if (prevScreen === "map") setActiveNavTab("map");
    else if (prevScreen === "favorites") setActiveNavTab("favorites");
    else if (prevScreen === "gethelp") setActiveNavTab("gethelp");
    else if (prevScreen === "more") setActiveNavTab("more");
  };

  const submitAor = async () => {
    if (!aorData.consent || !aorData.needs.length) return;
    setAorSubmitting(true); setAorSubmitError("");
    try {
      const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: aorData.name.trim() || "ZipShift client", phone: contactNeedsPhone(aorData.contactPreference || null) ? aorData.phone : null, situation: aorData.situation, needs: aorData.needs, consent: aorData.consent, providerId: selectedProvider?.record_id, handoff: aorHandoff, contactPreference: aorData.contactPreference || null, housingStatus: aorData.sdohConsent ? aorData.housingStatus || null : null, sdohConsent: aorData.sdohConsent && Boolean(aorData.housingStatus) }) });
      const text = await response.text();
      let body: { error?: string; referralId?: string } = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
      if (!response.ok) throw new Error(body.error || "Unable to submit the referral.");
      if (body.referralId) { setLastReferralCode(body.referralId); if (!sharedDevice) writeLocal(LOCAL_KEYS.lastReferral, body.referralId); }
      setAorSubmitted(true);
    } catch (error) {
      setAorSubmitError(error instanceof Error ? error.message : "Unable to submit the referral.");
    } finally { setAorSubmitting(false); }
  };

  const openProvider = (p: Provider) => {
    setSelectedProvider(p);
    sendFieldEvent("resource_open", p.record_id, { language });
    setRecentlyViewed((prev) => [p.record_id, ...prev.filter((id) => id !== p.record_id)].slice(0, 10));
    navigate("resource-detail");
  };

  const shareProvider = async (p: Provider) => {
    // Plain text works over SMS, on shared phones, and can be read aloud or written down.
    const status = hoursDisplay(p, language);
    const text = [p.org_name, p.address, p.phone ? `${language === "es" ? "Tel" : "Phone"}: ${p.phone}` : "", p.hours ? `${language === "es" ? "Horario" : "Hours"}: ${p.hours}` : status.word].filter(Boolean).join("\n");
    sendFieldEvent("resource_share", p.record_id);
    try {
      if (navigator.share) { await navigator.share({ title: p.org_name, text }); setShareStatus(""); return; }
      await navigator.clipboard.writeText(text);
      setShareStatus(language === "es" ? "Copiado. Péguelo en un mensaje o anótelo." : "Copied. Paste it in a text or write it down.");
      announce(language === "es" ? "Información copiada" : "Details copied");
    } catch {
      setShareStatus(language === "es" ? `Anote esto: ${text.replaceAll("\n", " · ")}` : `Write this down: ${text.replaceAll("\n", " · ")}`);
    }
  };

  const toggleSave = (id: string) => {
    const isSaved = savedProviders.includes(id);
    if (!isSaved) sendFieldEvent("resource_save", id);
    setSavedProviders((prev) => isSaved ? prev.filter((x) => x !== id) : [...prev, id]);
    if (clientUser?.role === "client") {
      fetch(`/api/saved-resources/${id}`, { method: isSaved ? "DELETE" : "PUT", credentials: "include" }).catch(() => {
        setSavedProviders((prev) => isSaved ? [...prev, id] : prev.filter((x) => x !== id));
      });
    }
  };

  const startProfileSignIn = () => {
    navigate("client-profile");
  };
  const routeConsentAudience = (audience: "client" | "staff" | "researcher" | "admin") => {
    setLandingConsent(null);
    if (audience === "client") navigate("client-profile");
    else if (audience === "staff") navigate("role-portal");
    else if (audience === "researcher") navigate("researcher-analytics");
    else navigate("admin-dashboard");
  };

  const startZipSearch = () => {
    if (selectedZip !== "all") {
      void fetch("/api/analytics/zip-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: selectedZip }),
      });
    }
    navigate("search-results");
  };

  const handleClientSession = (user: ClientSessionUser | null, saved: string[]) => {
    authenticatedSession.current = Boolean(user);
    setSessionUser(user);
    setClientUser(user?.role === "client" ? user : null);
    setSavedProviders(saved);
    if (user?.role === "admin") setScreen("admin-dashboard");
    else if (user?.role === "researcher") setScreen("researcher-analytics");
  };
  const handleWorkspaceSession = (user: ClientSessionUser | null) => {
    authenticatedSession.current = Boolean(user);
    setSessionUser(user);
    setClientUser(user?.role === "client" ? user : null);
    if (user?.role === "admin") setScreen("admin-dashboard");
    else if (user?.role === "researcher") setScreen("researcher-analytics");
  };

  // ─── BOTTOM NAV ───────────────────────────────────────────────────────────
  const BottomNav = () => (
    <nav className="zipshift-bottom-nav" aria-label={language === "es" ? "Navegación principal" : "Primary"} style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: bg, borderTop: `1px solid ${borderColor}`,
      display: "flex", height: 64, zIndex: 100,
    }}>
      {([
        { id: "home", icon: HomeIcon, label: t.home },
        { id: "map", icon: MapPin, label: t.map },
        { id: "favorites", icon: Heart, label: t.favorites },
        { id: "gethelp", icon: CircleHelp, label: t.getHelp },
        { id: "more", icon: MoreHorizontal, label: t.more },
      ] as const).map((item) => {
        const active = activeNavTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(item.id as Screen)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 2, background: "none", border: "none",
              cursor: "pointer", color: active ? "var(--zs-color-brand)" : subFg, fontSize: 11,
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon size={item.id === "more" ? 18 : 20} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  // ─── HAMBURGER MENU ───────────────────────────────────────────────────────
  const ClientDesktopSidebar = () => (
    <aside className={`zipshift-desktop-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`} aria-label="Navigator sidebar">
      <div className="zipshift-sidebar-top"><div className="zipshift-sidebar-brand"><img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" /><span aria-hidden="true"><ShieldCheck size={22} /></span></div><button type="button" className="zipshift-sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "Expand Navigator menu" : "Collapse Navigator menu"} title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}><span aria-hidden="true">{sidebarCollapsed ? "→" : "←"}</span></button></div>
      <div className="zipshift-sidebar-caption">NAVIGATOR</div>
      <nav aria-label="Navigator">
        {[
          { icon: Search, label: "Map Search", dest: "map" as Screen },
          { icon: Heart, label: "Favorites", dest: "favorites" as Screen },
          { icon: FileText, label: "Intake", dest: "intake-form" as Screen },
          { icon: CircleHelp, label: "Help Center", dest: "gethelp" as Screen },
          { icon: Landmark, label: "Full Directory", dest: "client-directory" as Screen },
          { icon: ShieldCheck, label: "Emergency Resources", dest: "emergency-directory" as Screen },
          { icon: Landmark, label: "County CSV Directory", dest: "county-directory" as Screen },
          { icon: Bell, label: "Notifications", dest: "notifications" as Screen },
          { icon: UserCircle, label: "Profile", dest: "client-profile" as Screen },
        ].map((item) => {
          const Icon = item.icon;
          const current = activeNavTab === item.dest || screen === item.dest;
          return <button key={item.dest} type="button" onClick={() => navigate(item.dest)} className={current ? "active" : ""} aria-current={current ? "page" : undefined} aria-label={item.dest === "notifications" && notificationCount > 0 ? `${item.label}, ${notificationCount} unread` : item.label} title={sidebarCollapsed ? item.label : undefined} data-tooltip={item.label}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>{item.dest === "notifications" && notificationCount > 0 && <b className="zipshift-notification-badge" aria-hidden="true">{notificationCount > 9 ? "9+" : notificationCount}</b>}</button>;
        })}
      </nav>
      <div className="zipshift-sidebar-profile">
        <div className="zipshift-sidebar-avatar" aria-hidden="true">{(clientUser || sessionUser)?.displayName?.slice(0, 1).toUpperCase() || "Z"}</div>
        <div><strong>{(clientUser || sessionUser)?.displayName || "ZipShift Client"}</strong><small>{sessionUser?.role === "admin" ? "Super administrator" : clientUser ? "Verified client" : "Create a profile"}</small></div>
        <button onClick={startProfileSignIn}>{clientUser ? "Profile" : sessionUser?.role === "admin" ? "Admin profile" : "Sign in"}</button>
      </div>
      {sessionUser?.role === "admin" && <div className="zipshift-sidebar-workspace-switcher"><span>Switch workspace</span><button onClick={() => navigate("role-portal")} title="Role portal" data-tooltip="Role portal"><ShieldCheck size={14} aria-hidden="true" /><span>Portal</span></button><button onClick={() => navigate("admin-dashboard")} title="Admin workspace" data-tooltip="Admin workspace"><Settings size={14} aria-hidden="true" /><span>Admin</span></button><button onClick={() => navigate("referrals-dispatch")} title="Website operations" data-tooltip="Website operations"><Globe2 size={14} aria-hidden="true" /><span>Website</span></button></div>}
    </aside>
  );

  const HamburgerMenu = () => (
    <>
      <RenderSlot render={ClientDesktopSidebar} />
      {menuOpen && (
        <>
          <div
            className="zipshift-mobile-drawer-backdrop"
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }}
            onClick={() => setMenuOpen(false)}
          />
          <div ref={mobileDrawerRef} className="zipshift-mobile-drawer" role="dialog" aria-modal="true" aria-label="Navigation menu" style={{
            position: "fixed", top: 0, left: 0, right: "auto", bottom: 0, width: "min(88vw, 340px)",
            background: bg, zIndex: 201, overflowY: "auto",
            boxShadow: "4px 0 20px rgba(0,0,0,0.15)",
          }}>
            <div style={{ padding: "20px 16px", borderBottom: `1px solid ${borderColor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 28 }} />
                <button type="button" className="zs-icon-button" onClick={() => setMenuOpen(false)} aria-label={language === "es" ? "Cerrar menú" : "Close menu"} style={{
                  fontSize: 24, color: fg, lineHeight: 1,
                }}><span aria-hidden="true">×</span></button>
              </div>
              {sessionUser && <div style={{ marginBottom: 10, borderRadius: 10, background: "#e8f7f5", color: "#0f766e", padding: "8px 10px", fontSize: 12, fontWeight: 800 }}><ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />Signed in: {sessionUser.displayName} · {sessionUser.role}</div>}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px",
                background: cardBg, borderRadius: 12,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", background: "#e3f5f3", color: "#0f766e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}><UserCircle size={24} strokeWidth={1.8} aria-hidden="true" /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: fg }}>{clientUser?.displayName || t.helloThere}</div>
                  <button onClick={startProfileSignIn} style={{
                    background: "none", border: "none", color: "var(--zs-color-brand)", fontSize: 13, cursor: "pointer", padding: 0,
                  }}>{clientUser ? "View profile" : `${t.signIn} →`}</button>
                </div>
              </div>
              {sessionUser?.role === "admin" && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => { setMenuOpen(false); navigate("role-portal"); }} style={{ flex: 1, border: `1px solid ${borderColor}`, borderRadius: 8, background: bg, color: fg, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>Workspaces</button><button onClick={() => { setMenuOpen(false); navigate("home"); }} style={{ flex: 1, border: `1px solid ${borderColor}`, borderRadius: 8, background: bg, color: fg, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>Client view</button></div>}
            </div>
            <nav aria-label={language === "es" ? "Menú" : "Menu"} style={{ padding: "8px 0" }}>
              {[
                { icon: Bell, label: t.notifications, dest: "notifications" as Screen },
                { icon: ShieldCheck, label: "Emergency resources", dest: "emergency-directory" as Screen },
                { icon: Landmark, label: "County resource directory", dest: "county-directory" as Screen },
                { icon: UserCircle, label: t.profile, dest: "client-profile" as Screen },
                { icon: CircleHelp, label: t.helpCenter, dest: "gethelp" as Screen },
                { icon: MessageSquare, label: t.feedback, dest: "feedback" as Screen },
                { icon: Info, label: t.aboutApp, dest: "about" as Screen },
                { icon: ShieldCheck, label: t.privacy, dest: "privacy" as Screen },
                { icon: FileText, label: t.terms, dest: "terms" as Screen },
              ].map((item) => {
                const Icon = item.icon;
                return (
                <button key={item.label} type="button" onClick={() => navigate(item.dest)} aria-current={screen === item.dest ? "page" : undefined} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  background: "none", border: "none", borderBottom: `1px solid ${borderColor}`,
                  cursor: "pointer", color: fg, fontSize: 15, width: "100%", textAlign: "left",
                }}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" style={{ width: 28 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>{item.dest === "notifications" && notificationCount > 0 && <b className="zipshift-notification-badge" aria-hidden="true">{notificationCount > 9 ? "9+" : notificationCount}</b>}
                  <span style={{ color: subFg }} aria-hidden="true">›</span>
                </button>
                );
              })}
            </nav>
            <div style={{ padding: "16px" }}>
              <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.language}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["en", "es"] as const).map((lang) => (
                  <button key={lang} type="button" lang={lang} aria-pressed={language === lang} onClick={() => { setLanguage(lang); announce(lang === "es" ? "Idioma: Español" : "Language: English"); }} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `2px solid ${language === lang ? "var(--zs-color-brand)" : borderColor}`,
                    background: language === lang ? "#eff6ff" : bg,
                    color: language === lang ? "var(--zs-color-brand)" : fg,
                    fontWeight: language === lang ? 700 : 400, cursor: "pointer", fontSize: 14,
                  }}>{lang === "en" ? "English" : "Español"}</button>
                ))}
              </div>
              <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.accessibility}</div>
              {[
                { label: t.largeText, value: largeText, toggle: () => setLargeText(!largeText) },
                { label: t.darkMode, value: darkMode, toggle: () => setDarkMode(!darkMode) },
                { label: t.reduceMotion, value: reduceMotion, toggle: () => setReduceMotion(!reduceMotion) },
              ].map((opt) => (
                <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ color: fg, fontSize: 14 }}>{opt.label}</span>
                  <button type="button" role="switch" aria-checked={opt.value} aria-label={opt.label} onClick={opt.toggle} className="zs-switch" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  // Keep the authenticated identity visible while an authorized user moves
  // between the public client experience and protected workspaces.
  const SessionSwitcher = ({ compact = false }: { compact?: boolean }) => sessionUser ? (
    <div className={compact ? "flex items-center gap-2" : "flex flex-wrap items-center gap-2"} aria-label={`Signed in as ${sessionUser.displayName}`}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, background: "#e8f7f5", color: "#0f766e", padding: compact ? "5px 8px" : "6px 10px", fontSize: 11, fontWeight: 800, maxWidth: compact ? 150 : 220 }} title={`${sessionUser.displayName} · ${sessionUser.email}`}>
        <ShieldCheck size={13} aria-hidden="true" /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionUser.displayName} · {sessionUser.role === "admin" ? "Admin" : sessionUser.role === "researcher" ? "Research" : "Client"}</span>
      </span>
      {sessionUser.role === "admin" && <>
        <button type="button" onClick={() => navigate("role-portal")} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, background: cardBg, color: fg, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Workspaces</button>
        <button type="button" onClick={() => navigate("home")} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, background: cardBg, color: fg, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Client view</button>
      </>}
      {sessionUser.role === "researcher" && <button type="button" onClick={() => navigate("role-portal")} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, background: cardBg, color: fg, padding: "5px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Workspaces</button>}
    </div>
  ) : null;

  // ─── HEADER ───────────────────────────────────────────────────────────────
  const Header = ({ title, showBack = false, showBookmark = false, onBookmark }: {
    title?: React.ReactNode; showBack?: boolean; showBookmark?: boolean; onBookmark?: () => void;
  }) => (
    <header className="zipshift-client-header" style={{
      position: "sticky", top: 0, zIndex: 50,
      background: bg, borderBottom: `1px solid ${borderColor}`,
      display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, minHeight: 56,
    }}>
      {showBack && (
        <button type="button" className="zs-icon-button" onClick={goBack} aria-label={language === "es" ? "Volver" : "Go back"} style={{
          color: "var(--zs-color-brand)", fontSize: 26, lineHeight: 1,
        }}><span aria-hidden="true">‹</span></button>
      )}
      <h1 style={{ flex: 1, margin: 0, minWidth: 0, fontSize: "inherit", fontWeight: "inherit", lineHeight: 1.2 }}>
        {title || <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 32 }} />}
      </h1>
      <RenderSlot render={SessionSwitcher} compact />
      {showBookmark && (
        <button type="button" className="zs-icon-button" onClick={onBookmark} aria-pressed={Boolean(selectedProvider && savedProviders.includes(selectedProvider.record_id))} aria-label={language === "es" ? "Guardar recurso" : "Save resource"} style={{
          fontSize: 20, color: selectedProvider && savedProviders.includes(selectedProvider.record_id) ? "#dc2626" : subFg,
        }}><Heart className="zs-heart" size={18} strokeWidth={1.8} fill={selectedProvider && savedProviders.includes(selectedProvider.record_id) ? "currentColor" : "none"} aria-hidden="true" /></button>
      )}
      <button type="button" ref={menuButtonRef} className="zs-icon-button" onClick={() => setMenuOpen(true)} aria-label={language === "es" ? "Abrir menú" : "Open menu"} aria-haspopup="dialog" aria-expanded={menuOpen} style={{
        display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center",
      }}>
        <span aria-hidden="true" style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
        <span aria-hidden="true" style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
        <span aria-hidden="true" style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
      </button>
    </header>
  );

  // ─── FILTERS DRAWER ───────────────────────────────────────────────────────
  const FiltersDrawer = () => (
    <>
      {filtersOpen && (
        <>
          <div className="zs-backdrop" aria-hidden="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }} onClick={() => setFiltersOpen(false)} />
          <div ref={filtersDialogRef} className="zs-sheet" role="dialog" aria-modal="true" aria-labelledby="zs-filters-title" style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: bg,
            borderRadius: "16px 16px 0 0", padding: "20px 16px 100px", zIndex: 301,
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 id="zs-filters-title" style={{ margin: 0, fontWeight: 700, fontSize: 18, color: fg }}>{t.filters}</h2>
              <button type="button" onClick={() => { setSelectedCategories([]); setMaxDistance(25); setOpenNow(false); announce(language === "es" ? "Filtros restablecidos" : "Filters reset"); }}
                style={{ background: "none", border: "none", color: "var(--zs-color-brand)", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{t.reset}</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span id="zs-filter-categories" style={{ fontWeight: 600, fontSize: 14, color: fg }}>{t.categories}</span>
              <button onClick={() => setSelectedCategories(CATEGORIES.map((c) => c.id))}
                style={{ background: "none", border: "none", color: "var(--zs-color-brand)", fontSize: 13, cursor: "pointer" }}>{t.selectAll}</button>
            </div>
            <div role="group" aria-labelledby="zs-filter-categories">
            {CATEGORIES.map((cat) => (
              <label key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedCategories.includes(cat.id)}
                  onChange={() => setSelectedCategories((prev) =>
                    prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id]
                  )}
                  style={{ width: 18, height: 18, accentColor: "var(--zs-color-brand)" }} />
                <span style={{ color: fg, fontSize: 14 }}>{cat.label.replace("\n", " ")}</span>
              </label>
            ))}
            </div>
            <div style={{ marginTop: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label htmlFor="zs-filter-distance" style={{ fontWeight: 600, fontSize: 14, color: fg }}>{t.distance}</label>
                <span style={{ color: subFg, fontSize: 13 }}>{maxDistance >= 25 ? t.anyDistance : `${maxDistance} mi`}</span>
              </div>
              <input id="zs-filter-distance" type="range" min={1} max={25} value={maxDistance} aria-valuetext={maxDistance >= 25 ? t.anyDistance : `${maxDistance} miles`} onChange={(e) => setMaxDistance(+e.target.value)}
                style={{ width: "100%", accentColor: "var(--zs-color-brand)" }} />
              <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: subFg, marginTop: 4 }}>
                <span>1 mi</span><span>5 mi</span><span>10 mi</span><span>25 mi+</span>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={openNow} onChange={() => setOpenNow(!openNow)}
                style={{ width: 18, height: 18, accentColor: "var(--zs-color-brand)" }} />
              <span style={{ color: fg, fontSize: 14 }}>{t.openNow}</span>
            </label>
            <button type="button" className="zs-press" onClick={() => { setFiltersOpen(false); announce(`${filteredProviders.length} ${t.results}`); }} style={{
              width: "100%", padding: "14px 0", background: "var(--zs-color-brand)", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer",
            }}>{t.applyFilters}</button>
          </div>
        </>
      )}
    </>
  );

  // ─── SPLASH ───────────────────────────────────────────────────────────────
  if (screen === "splash") {
    return <BrandedSplash tagline="Navigate. Connect. Act." status={language === "es" ? "Cargando ZipShift Navigator" : "Loading ZipShift Navigator"} />;
  }

  if (screen === "home" && navigatorLoading) {
    return <div className="zipshift-navigator-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="zipshift-loading-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div className="zipshift-loading-copy"><strong>Loading ZipShift Navigator</strong><span>Fetching verified resources and current availability…</span></div>
      <div className="zipshift-loading-skeleton-grid" aria-hidden="true"><span /><span /><span /><span /></div>
    </div>;
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────
  if (screen === "home") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "16px" }}>
          {/* Greeting */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: fg }}>{t.goodMorning}</div>
            <div style={{ fontSize: 14, color: subFg }}>{t.howCanWeHelp}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}><button onClick={() => setScreen("guided-entry")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: 10, background: "var(--zs-color-brand)", color: "#fff", padding: "11px 14px", fontWeight: 900, fontSize: 12, cursor: "pointer" }}><Sparkles size={15} aria-hidden="true" />{language === "es" ? "Empezar aquí" : "Start here"}</button><button onClick={() => setQuickGuideOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><FileText size={15} aria-hidden="true" />{language === "es" ? "Guía rápida de recursos" : "Quick resource guide"}</button><button onClick={() => setLandingConsent("privacy")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><ShieldCheck size={15} aria-hidden="true" />{language === "es" ? "Privacidad y consentimiento" : "Privacy & consent"}</button><button onClick={() => setLandingConsent("research")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><ClipboardList size={15} aria-hidden="true" />{language === "es" ? "Consentimiento de investigación" : "Research consent"}</button></div>
          </div>
          {(() => {
            const resume = !sharedDevice ? providers.find((provider) => provider.record_id === recentlyViewed[0]) : undefined;
            if (!resume && !lastReferralCode) return null;
            return <section aria-labelledby="zs-resume-title" style={{ marginBottom: 20, padding: "14px", border: `1px solid ${borderColor}`, borderRadius: 12, background: cardBg }}>
              <h2 id="zs-resume-title" style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800, color: fg }}>{language === "es" ? "Continúe donde se quedó" : "Pick up where you left off"}</h2>
              {resume && <button type="button" onClick={() => openProvider(resume)} style={{ display: "flex", width: "100%", minHeight: 48, alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10, border: `1px solid ${borderColor}`, background: bg, color: fg, fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left" }}><span>{resume.org_name}</span><span aria-hidden="true">›</span></button>}
              {lastReferralCode && <p style={{ margin: resume ? "10px 0 0" : 0, fontSize: 14, color: fg }}>{language === "es" ? "Su código de referencia:" : "Your referral code:"} <strong style={{ fontFamily: "ui-monospace, monospace", letterSpacing: 0.5 }}>{lastReferralCode}</strong></p>}
            </section>;
          })()}
          {lowData ? <p style={{ marginBottom: 20, fontSize: 13, color: subFg }}>{language === "es" ? "Modo de pocos datos activado: video e imágenes ocultos." : "Low-data mode is on: video and images are hidden."} <button type="button" onClick={() => setLowData(false)} style={{ border: "none", background: "none", color: "var(--zs-color-brand)", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>{language === "es" ? "Mostrar" : "Show them"}</button></p> :           <section aria-labelledby="zipshift-promo-title" style={{ marginBottom: 20, overflow: "hidden", borderRadius: 16, background: "#142846", boxShadow: "0 14px 30px rgba(20,40,70,0.16)" }}>
            <video src={PROMO_VIDEO} controls muted playsInline preload="metadata" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} aria-label="ZipShift Navigator 30-second overview video" />
            <div style={{ padding: "12px 14px 14px", color: "#fff" }}><div id="zipshift-promo-title" style={{ fontWeight: 800, fontSize: 14 }}>{language === "es" ? "Conoce ZipShift Navigator" : "See ZipShift Navigator in action"}</div><div style={{ marginTop: 4, color: "#b8ece7", fontSize: 12 }}>{language === "es" ? "Recursos, acceso y coordinación en un solo lugar." : "Resources, access, and care coordination in one place."}</div></div>
          </section>}
          {navigatorLoadError && <div role="status" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 9, background: darkMode ? "#163d42" : "#e3f5f3", color: darkMode ? "#b8ece7" : "#0f766e", fontSize: 12 }}>{navigatorLoadError}</div>}
          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 14px",
            background: cardBg, border: `1px solid ${borderColor}`,
            borderRadius: 10, marginBottom: 20,
          }}>
            <Search size={18} strokeWidth={1.8} color={subFg} aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startZipSearch(); }}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              type="search"
              style={{ flex: 1, minWidth: 180, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none" }}
            />
            <select aria-label="Filter resources by covered ZIP code" value={selectedZip} onChange={(e) => setSelectedZip(e.target.value)} style={{
              border: `1px solid ${borderColor}`, background: bg, color: fg, borderRadius: 7, padding: "7px 8px", fontSize: 12, fontWeight: 600, maxWidth: 160,
            }}>
              <option value="all">All covered ZIPs</option>
              {COVERED_ZIPS.map((zip) => <option key={zip.code} value={zip.code}>{zip.label}</option>)}
            </select>
            <button type="button" className="zs-icon-button" onClick={startZipSearch} aria-label={language === "es" ? "Buscar" : "Search"} style={{
              color: subFg, fontSize: 16,
            }}><Search size={17} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
          <p style={{ margin: "-12px 0 18px", fontSize: 11, color: subFg }}>ZIP selections are counted in daily totals only. ZipShift does not retain your IP address, account, or search terms with this planning data.</p>
          {/* Browse by Category */}
          <h2 style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5 }}>
            {t.browseByCategory}
          </h2>
          <div className="zipshift-category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
            {CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => { setSelectedCategories([cat.id]); navigate("search-results"); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 6, padding: "14px 8px",
                  background: cardBg, border: `1px solid ${borderColor}`,
                  borderRadius: 12, cursor: "pointer", textAlign: "center",
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: cat.color + "20", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 22,
                }}><CategoryGlyph catId={cat.id} size={22} /></div>
                <span style={{ fontSize: 11, color: fg, fontWeight: 500, lineHeight: 1.3, whiteSpace: "pre-line" }}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
          {/* Near You */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5 }}>{t.nearYou}</h2>
            <button onClick={() => navigate("search-results")} style={{
              background: "none", border: "none", color: "var(--zs-color-brand)", fontSize: 13, cursor: "pointer", fontWeight: 600,
            }}>{t.viewAll}</button>
          </div>
          <div className="zipshift-nearby-list">
          {providers.slice(0, 4).map((p) => {
            const catId = getCategoryForProvider(p);
            const status = hoursDisplay(p, language);
            return (
              <button key={p.record_id} onClick={() => openProvider(p)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "12px 0", background: "none", border: "none",
                borderBottom: `1px solid ${borderColor}`, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: getCategoryColor(catId) + "20",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, overflow: "hidden",
                }}>{!lowData && <img src={getProviderLogo(p)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} />}<CategoryGlyph catId={catId} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 2 }}>
                    {p.org_name.length > 35 ? p.org_name.slice(0, 35) + "…" : p.org_name}
                  </div>
                  <div style={{ fontSize: 12, color: subFg }}>{getDistanceLabel(p)} · {p.service_category.split("/")[0].trim()}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    <span style={{ color: status.color, fontWeight: 600 }}>{status.word}</span>{status.label ? <>{" · "}<span style={{ color: subFg }}>{status.label}</span></> : null}
                  </div>
                </div>
                <span style={{ color: subFg, fontSize: 18 }} aria-hidden="true">›</span>
              </button>
            );
                    })}
          </div>
        </div>
        </main>
        <RenderSlot render={BottomNav} />
        {quickGuideOpen && <ClientQuickGuideModal providers={guideProviders} language={language} onClose={() => setQuickGuideOpen(false)} onOpenDirectory={() => { setQuickGuideOpen(false); navigate("county-directory"); }} />}{landingConsent && <div className="fixed inset-0 z-[450] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="landing-consent-title" ref={consentDialogRef}><section className="zs-dialog-panel w-full max-w-xl rounded-t-3xl bg-white p-6 text-[#142846] shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-brand">{landingConsent === "privacy" ? (language === "es" ? "Privacidad primero" : "Privacy first") : (language === "es" ? "Participación informada" : "Informed participation")}</p><h2 id="landing-consent-title" className="mt-1 text-2xl font-black">{landingConsent === "privacy" ? (language === "es" ? "Revisa la privacidad antes de continuar" : "Review privacy before continuing") : (language === "es" ? "Elige tu portal de consentimiento" : "Choose your consent portal")}</h2></div><button type="button" onClick={() => setLandingConsent(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Close consent popup"><X size={18} aria-hidden="true" /></button></div>{landingConsent === "privacy" ? <><p className="mt-4 text-sm leading-6 text-slate-600">{language === "es" ? "ZipShift usa la información mínima necesaria para conectar a las personas con recursos. El consentimiento de servicios y el consentimiento de investigación son decisiones separadas." : "ZipShift uses the minimum information needed to connect people with resources. Service consent and research consent are separate decisions."}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setLandingConsent(null); navigate("privacy"); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">{language === "es" ? "Leer política" : "Read privacy policy"}</button><button type="button" onClick={() => routeConsentAudience(sessionUser?.role === "admin" ? "admin" : sessionUser?.role === "researcher" ? "researcher" : sessionUser?.role === "client" ? "client" : "client")} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white">{language === "es" ? "Continuar al portal" : "Continue to portal"}</button></div></> : <><p className="mt-4 text-sm leading-6 text-slate-600">{language === "es" ? "Clientes revisan las opciones en su perfil. El personal, investigadores y administradores deben entrar a su espacio protegido." : "Clients review options in their profile. Staff, researchers, and administrators enter their protected workspace."}</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => routeConsentAudience("client")} className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-left text-sm font-bold text-[#0f766e]">Client / participant<span className="mt-1 block text-xs font-normal text-slate-500">Review client consent</span></button><button type="button" onClick={() => routeConsentAudience("staff")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Care team / staff<span className="mt-1 block text-xs font-normal text-slate-500">Open staff sign-in and portal</span></button><button type="button" onClick={() => routeConsentAudience("researcher")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Researcher<span className="mt-1 block text-xs font-normal text-slate-500">Open researcher sign-in</span></button><button type="button" onClick={() => routeConsentAudience("admin")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Administrator<span className="mt-1 block text-xs font-normal text-slate-500">Open protected admin access</span></button></div></>}</section></div>}
      </div>
    );
  }
  // ─── SEARCH RESULTS ───────────────────────────────────────────────────────
  if (screen === "search-results") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={FiltersDrawer} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.searchResultsTitle}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        {/* Search + filter row */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${borderColor}`, display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10,
          }}>
            <Search size={18} strokeWidth={1.8} color={subFg} aria-hidden="true" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              type="search"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none" }} />
          </div>
          <button type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog" aria-expanded={filtersOpen} style={{
            padding: "8px 14px", background: selectedCategories.length > 0 ? "var(--zs-color-brand)" : cardBg,
            border: `1px solid ${selectedCategories.length > 0 ? "var(--zs-color-brand)" : borderColor}`,
            borderRadius: 10, color: selectedCategories.length > 0 ? "#fff" : fg,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}><SlidersHorizontal size={15} aria-hidden="true" /> {t.filters}{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ""}</button>
        </div>
        {/* Results count */}
        <div role="group" aria-label={language === "es" ? "Filtros rápidos" : "Quick filters"} style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 8 }}>
          {([
            { label: language === "es" ? "Sin cita" : "Walk-ins OK", active: walkInOnly, toggle: () => setWalkInOnly((value) => !value) },
            { label: language === "es" ? "No necesita ID" : "No ID needed", active: noIdOnly, toggle: () => setNoIdOnly((value) => !value) },
            { label: language === "es" ? "Abierto ahora" : "Open now", active: openNow, toggle: () => setOpenNow((value) => !value) },
          ]).map((chip) => <button key={chip.label} type="button" aria-pressed={chip.active} onClick={chip.toggle} style={{ minHeight: 44, padding: "8px 14px", borderRadius: 999, border: `2px solid ${chip.active ? "var(--zs-color-brand)" : borderColor}`, background: chip.active ? "var(--zs-color-brand)" : cardBg, color: chip.active ? "#fff" : fg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{chip.active ? "✓ " : ""}{chip.label}</button>)}
        </div>
        <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span role="status" aria-live="polite" style={{ fontSize: 13, color: subFg }}>{filteredProviders.length} {t.results}</span>
        </div>
        {filteredProviders.length === 0 && <div style={{ margin: "8px 16px 16px", padding: "18px 16px", border: `1px solid ${borderColor}`, borderRadius: 12, background: cardBg }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: fg }}>{language === "es" ? "No encontramos lugares con esos filtros" : "No places match these filters"}</h2>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: subFg, lineHeight: 1.5 }}>{language === "es" ? "Quite filtros para ver más, o llame al 211 para hablar con alguien." : "Clear filters to see more, or call 211 to talk to someone."}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => { setSearchQuery(""); setSelectedCategories([]); setMaxDistance(25); setOpenNow(false); setWalkInOnly(false); setNoIdOnly(false); setSelectedZip("all"); announce(language === "es" ? "Filtros borrados" : "Filters cleared"); }} style={{ minHeight: 44, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--zs-color-brand)", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{language === "es" ? "Borrar filtros" : "Clear filters"}</button>
            <a href="tel:211" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 10, border: "2px solid #15803d", color: "#15803d", fontWeight: 800, fontSize: 15, textDecoration: "none" }}><Phone size={16} aria-hidden="true" /> {language === "es" ? "Llamar al 211" : "Call 211"}</a>
          </div>
        </div>}
        {/* Provider list */}
        <div style={{ padding: "0 16px" }}>
          {filteredProviders.map((p) => {
            const catId = getCategoryForProvider(p);
            const status = hoursDisplay(p, language);
            const isSaved = savedProviders.includes(p.record_id);
            return (
              <div key={p.record_id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 0", borderBottom: `1px solid ${borderColor}`,
              }}>
                <button type="button" data-result-card onClick={() => openProvider(p)} style={{
                  display: "flex", alignItems: "center", gap: 12, flex: 1,
                  background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: getCategoryColor(catId) + "20",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  }}><CategoryGlyph catId={catId} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 2 }}>
                      {p.org_name.length > 35 ? p.org_name.slice(0, 35) + "…" : p.org_name}
                    </div>
                    <div style={{ fontSize: 12, color: subFg }}>{getDistanceLabel(p)} · {p.service_category.split("/")[0].trim()}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <span style={{ color: status.color, fontWeight: 600 }}>{status.word}</span>{status.label ? <>{" · "}<span style={{ color: subFg }}>{status.label}</span></> : null}
                    </div>
                    {(acceptsWalkIns(p) || noIdRequired(p)) && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {acceptsWalkIns(p) && <span style={{ borderRadius: 999, background: "#dcfce7", color: "#14532d", padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{language === "es" ? "Sin cita" : "Walk-ins OK"}</span>}
                      {noIdRequired(p) && <span style={{ borderRadius: 999, background: "#dcfce7", color: "#14532d", padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{language === "es" ? "No necesita ID" : "No ID needed"}</span>}
                    </div>}
                  </div>
                </button>
                <button onClick={() => toggleSave(p.record_id)} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 22,
                  color: isSaved ? "#dc2626" : subFg, flexShrink: 0, minWidth: 44, minHeight: 44,
                }} aria-label={`${isSaved ? "Remove" : "Save"} ${p.org_name}`} aria-pressed={isSaved}><Heart className="zs-heart" aria-hidden="true" size={20} fill={isSaved ? "currentColor" : "none"} strokeWidth={1.8} /></button>
              </div>
            );
          })}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── MAP ──────────────────────────────────────────────────────────────────
  if (screen === "map") {
    return (
      <div style={{ background: bg, height: "100vh", display: "flex", flexDirection: "column", fontSize, color: fg }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={FiltersDrawer} />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${borderColor}`, background: bg, zIndex: 10,
        }}>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: fg }}>{language === "es" ? "Mapa" : "Map"}</h1>
          <button type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog" aria-expanded={filtersOpen} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 20,
            fontSize: 13, color: fg, cursor: "pointer", fontWeight: 600,
          }}><SlidersHorizontal size={15} aria-hidden="true" /> {t.filters}</button>
        </div>
        {/* Map/List toggle */}
        <div role="group" aria-label={language === "es" ? "Vista" : "View"} style={{ display: "flex", gap: 0, padding: "8px 16px", background: bg }}>
          <button type="button" aria-pressed="true" style={{
            flex: 1, padding: "8px 0", background: "var(--zs-color-brand)", color: "#fff",
            border: "none", borderRadius: "8px 0 0 8px", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>{language === "es" ? "Mapa" : "Map"}</button>
          <button type="button" aria-pressed="false" onClick={() => navigate("search-results")} style={{
            flex: 1, padding: "8px 0", background: cardBg, color: fg,
            border: `1px solid ${borderColor}`, borderRadius: "0 8px 8px 0",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>List</button>
        </div>
        {/* Map */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <ZipShiftMap
            providers={filteredProviders}
            onProviderSelect={openProvider}
            darkMode={darkMode}
            selectedCity={selectedCity}
            label={language === "es" ? "Mapa de recursos comunitarios" : "Community resource map"}
          />
        </div>
        <div aria-hidden="true" style={{ height: 64, flex: "0 0 auto" }} />
        </main>
        <RenderSlot render={BottomNav} />
        {quickGuideOpen && <ClientQuickGuideModal providers={providers} language={language} onClose={() => setQuickGuideOpen(false)} onOpenDirectory={() => { setQuickGuideOpen(false); navigate("search-results"); }} />}
      </div>
    );
  }

  // ─── RESOURCE DETAIL ──────────────────────────────────────────────────────
  if (screen === "resource-detail" && selectedProvider) {
    const p = selectedProvider;
    const catId = getCategoryForProvider(p);
    const status = hoursDisplay(p, language);
    const isSaved = savedProviders.includes(p.record_id);
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header}
          title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>Resource Detail</span>}
          showBack
          showBookmark
          onBookmark={() => toggleSave(p.record_id)}
        />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <Breadcrumbs style={{ padding: "10px 16px 0" }} items={[{ label: t.home, onSelect: () => navigate("home") }, ...(prevScreen !== "home" && SCREEN_TITLES[prevScreen] && prevScreen !== screen ? [{ label: SCREEN_TITLES[prevScreen] as string, onSelect: goBack }] : []), { label: p.org_name }]} />
        <div style={{ padding: "16px" }}>
          {/* Provider header */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: getCategoryColor(catId) + "20",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, overflow: "hidden",
            }}>{!lowData && <img src={getProviderLogo(p)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} />}<CategoryGlyph catId={catId} /></div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: fg, margin: "0 0 4px" }}>{p.org_name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isVerified(p)
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#15803d", fontWeight: 600 }}><CheckCircle2 size={14} aria-hidden="true" /> {t.verified}{p.verification_date ? ` · ${p.verification_date}` : ""}</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#b45309", fontWeight: 600 }}><Info size={14} aria-hidden="true" /> {language === "es" ? "Sin verificar — llame para confirmar" : "Not yet verified — call to confirm"}</span>}
              </div>
              <div style={{ fontSize: 12, color: subFg, marginTop: 4 }}>
                {p.address} · <span style={{ color: fg }}>{getDistanceLabel(p)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {p.language_access && <span style={{ borderRadius: 999, background: "#eef2ff", color: "#4338ca", padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{language === "es" ? `Idiomas: ${p.language_access}` : `Languages: ${p.language_access}`}</span>}
                {p.ada_access && <span style={{ borderRadius: 999, background: "#fff7ed", color: "#9a3412", padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{language === "es" ? `Acceso: ${p.ada_access}` : `Access: ${p.ada_access}`}</span>}
                {acceptsWalkIns(p) && <span style={{ borderRadius: 999, background: "#dcfce7", color: "#14532d", padding: "4px 8px", fontSize: 12, fontWeight: 800 }}>{language === "es" ? "Sin cita" : "Walk-ins OK"}</span>}
                {noIdRequired(p) && <span style={{ borderRadius: 999, background: "#dcfce7", color: "#14532d", padding: "4px 8px", fontSize: 12, fontWeight: 800 }}>{language === "es" ? "No necesita ID" : "No ID needed"}</span>}
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {[
              { icon: Phone, label: language === "es" ? "Llamar" : "Call", action: () => { sendFieldEvent("resource_call", p.record_id); if (p.phone) window.open(`tel:${p.phone}`); } },
              { icon: Landmark, label: language === "es" ? "Sitio web" : "Website", action: () => { sendFieldEvent("resource_website", p.record_id); if (p.website) window.open(p.website.startsWith("http") ? p.website : `https://${p.website}`, "_blank"); } },
              { icon: Navigation, label: t.directions, action: () => { sendFieldEvent("resource_directions", p.record_id, { lowData }); setDirectionsOpen((open) => !open); if (!userLocation && navigator.geolocation) { setLocationStatus("locating"); navigator.geolocation.getCurrentPosition((position) => { setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocationStatus("ready"); }, () => setLocationStatus("denied"), { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }); } } },
              { icon: ClipboardList, label: "Refer", action: () => navigate("referral-destination") },
              { icon: Share2, label: language === "es" ? "Compartir" : "Share", action: () => void shareProvider(p) },
              { icon: Heart, label: "Save", action: () => toggleSave(p.record_id) },
            ].map((btn) => (
              <button key={btn.label} type="button" onClick={btn.action} aria-pressed={btn.label === "Save" ? isSaved : undefined} style={{
                flex: "1 1 72px", minHeight: 56, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 4, padding: "10px 4px", background: "var(--zs-color-brand)", color: "#fff",
                border: "none", borderRadius: 10, cursor: "pointer", fontSize: 11, fontWeight: 600,
              }}>
                <btn.icon size={20} strokeWidth={1.8} fill={btn.label === "Save" && isSaved ? "currentColor" : "none"} aria-hidden="true" />
                {btn.label}
              </button>
            ))}
          </div>
          {directionsOpen && (() => {
            const destination = { lat: Number(p.lat), lng: Number(p.lng) };
            const originLocation = userLocation || manualCoordinates;
            const estimate = originLocation && Number.isFinite(destination.lat) && Number.isFinite(destination.lng) ? distanceMiles(originLocation.lat, originLocation.lng, destination.lat, destination.lng) : null;
            const origin = originLocation ? `${originLocation.lat},${originLocation.lng}` : "";
            const destinationText = `${destination.lat},${destination.lng}`;
            const routes = [
              { label: language === "es" ? "Autobús" : "Bus / transit", href: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(p.address || destinationText)}&travelmode=transit` },
              { label: language === "es" ? "Caminando" : "Walking", href: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(p.address || destinationText)}&travelmode=walking` },
              { label: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destinationText)}&travelmode=driving` },
              { label: "Apple Maps", href: `https://maps.apple.com/?${origin ? `saddr=${encodeURIComponent(origin)}&` : ""}daddr=${encodeURIComponent(destinationText)}&dirflg=d` },
              { label: "Waze", href: `https://www.waze.com/ul?ll=${encodeURIComponent(destinationText)}&navigate=yes` },
            ];
            return <div style={{ marginBottom: 20, padding: "12px 14px", background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><div><div style={{ fontWeight: 800, fontSize: 13, color: fg }}>{estimate ? `${estimate.toFixed(1)} mi · ~${Math.max(1, Math.round(estimate / 30 * 60))} min drive` : locationStatus === "locating" ? "Finding your location…" : locationStatus === "geocoding" ? "Finding that address…" : locationStatus === "denied" ? "Location permission declined — enter a ZIP or address below" : locationStatus === "error" ? "We could not find that location — check the ZIP or address" : "Allow location or enter a ZIP/address for an estimate"}</div><div style={{ fontSize: 11, color: subFg, marginTop: 3 }}>Choose a routing app</div></div><button onClick={() => setDirectionsOpen(false)} style={{ border: 0, background: "transparent", color: subFg, cursor: "pointer", fontSize: 12 }}>Close</button></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}><input value={manualLocation} onChange={(event) => { setManualLocation(event.target.value); setManualCoordinates(null); setLocationStatus("idle"); }} placeholder="ZIP code or address" aria-label="ZIP code or address" style={{ flex: "1 1 210px", minWidth: 180, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "9px 10px", background: "#fff", color: fg, fontSize: 12 }} /><button onClick={async () => { const query = manualLocation.trim(); if (!query) return; setLocationStatus("geocoding"); try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`); const results = await response.json() as Array<{ lat: string; lon: string }>; const match = results[0]; if (!match) throw new Error("not-found"); setManualCoordinates({ lat: Number(match.lat), lng: Number(match.lon) }); setUserLocation(null); setLocationStatus("ready"); } catch { setLocationStatus("error"); } }} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, background: "#fff", color: "#0f766e", padding: "9px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Use location</button></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{routes.map((route) => <button key={route.label} onClick={() => window.open(route.href, "_blank", "noopener,noreferrer")} style={{ flex: 1, minWidth: 100, border: `1px solid ${borderColor}`, borderRadius: 8, background: "#fff", color: "#0f766e", padding: "9px 8px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{route.label}</button>)}</div></div>;
          })()}
          {shareStatus && <p role="status" style={{ margin: "-8px 0 14px", fontSize: 13, color: "#0f766e", fontWeight: 600 }}>{shareStatus}</p>}
          {/* Next step: one clear action, so viewing a listing leads somewhere */}
          <section aria-labelledby="zs-next-step" style={{ marginBottom: 20, padding: "14px", border: "2px solid #16a34a", borderRadius: 12, background: darkMode ? "#052e16" : "#f0fdf4" }}>
            <h2 id="zs-next-step" style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: fg }}>{language === "es" ? "Siguiente paso" : "Your next step"}</h2>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: fg, lineHeight: 1.5 }}>
              {status.state === "unknown" || !isVerified(p)
                ? (language === "es" ? "Llame primero para confirmar que están abiertos y que pueden ayudarle hoy." : "Call first to check they're open and can help you today.")
                : status.state === "closed"
                  ? (language === "es" ? "Están cerrados ahora. Guarde este lugar o prepárese para ir cuando abran." : "They're closed right now. Save this place or get ready to go when they open.")
                  : (language === "es" ? "Están abiertos. Revise qué llevar y vaya." : "They're open. Check what to bring, then go.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {p.phone && <a href={`tel:${p.phone}`} onClick={() => sendFieldEvent("resource_call", p.record_id)} style={{ flex: "1 1 160px", display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 48, padding: "12px 14px", borderRadius: 10, background: status.state === "open" && isVerified(p) ? "transparent" : "#15803d", color: status.state === "open" && isVerified(p) ? "#15803d" : "#fff", border: "2px solid #15803d", fontWeight: 800, fontSize: 16, textDecoration: "none" }}><Phone size={18} aria-hidden="true" /> {language === "es" ? `Llamar ${p.phone}` : `Call ${p.phone}`}</a>}
              <button type="button" onClick={() => { sendFieldEvent("before_you_go_open", p.record_id); navigate("before-you-go"); }} style={{ flex: "1 1 160px", minHeight: 48, padding: "12px 14px", borderRadius: 10, background: status.state === "open" && isVerified(p) ? "#15803d" : "transparent", color: status.state === "open" && isVerified(p) ? "#fff" : "#15803d", border: "2px solid #15803d", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>{t.iNeedThisHelp}</button>
            </div>
          </section>
          {/* Hours */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: cardBg, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>{t.hours}</div>
            <div style={{ fontSize: 14, color: fg }}>{p.hours || (language === "es" ? "Horario no publicado — llame antes de ir" : "Hours not listed — call before you go")}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span style={{ color: status.color, fontWeight: 700 }}>{status.word}</span>
              {status.state === "open" && <span style={{ color: subFg }}> · {status.label}</span>}
            </div>
          </div>
          {/* Services */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>{t.services}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.service_category.split("/").map((s) => (
                <span key={s} style={{
                  padding: "4px 10px", background: "#eff6ff", color: "var(--zs-color-brand)",
                  borderRadius: 20, fontSize: 12, fontWeight: 500,
                }}>{language === "es" ? spanishServiceLabel(s.trim()) : s.trim()}</span>
              ))}
            </div>
          </div>
          {/* About */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>{t.about}</div>
            <p style={{ fontSize: 14, color: fg, lineHeight: 1.6, margin: 0 }}>
              {language === "es" ? spanishProviderDescription(p) : `${p.program_name || p.org_name}. ${p.referral_sources ? p.referral_sources.slice(0, 140) + "." : ""}`}
            </p>
          </div>
          {/* Location */}
          <div style={{ marginBottom: 20, padding: "12px 14px", background: cardBg, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 6 }}>LOCATION</div>
            <div style={{ fontSize: 14, color: fg }}>{p.address}</div>
            <div style={{ fontSize: 12, color: subFg, marginTop: 4 }}>{p.city}, CA</div>
            {p.ada_access && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#15803d", marginTop: 4 }}><Accessibility size={14} aria-hidden="true" /> {language === "es" ? `Acceso: ${p.ada_access}` : p.ada_access}</div>}
          </div>
          {/* Additional info */}
          {(p.walk_in_allowed || p.referral_required || p.language_access) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>ADDITIONAL INFO</div>
              {p.walk_in_allowed && <div style={{ fontSize: 13, color: fg, marginBottom: 4 }}>Walk-in: {p.walk_in_allowed}</div>}
              {p.referral_required && <div style={{ fontSize: 13, color: fg, marginBottom: 4 }}>Referral: {p.referral_required}</div>}
              {p.language_access && <div style={{ fontSize: 13, color: fg, marginBottom: 4 }}>{language === "es" ? `Idiomas: ${p.language_access}` : `Languages: ${p.language_access}`}</div>}
            </div>
          )}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── REFERRAL DESTINATION ────────────────────────────────────────────────
  if (screen === "referral-destination") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingTop: 16, paddingRight: 16, paddingBottom: 100, paddingLeft: 16 }}>
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <ReferralDestinationFlow
          providers={providers}
          initialProviderId={selectedProvider?.record_id}
          requestedService={aorData.needs[0] || selectedProvider?.service_category || ""}
          darkMode={darkMode}
          onBack={goBack}
          onConfirm={(provider, handoff) => { setSelectedProvider(provider); setAorHandoff(handoff); setAorStep(2); setScreen("gethelp"); setActiveNavTab("gethelp"); }}
        />
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── BEFORE YOU GO ────────────────────────────────────────────────────────
  if (screen === "before-you-go") {
    const p = selectedProvider;
    const es = language === "es";
    const bring = p ? documentsToBring(p) : [];
    const idOptional = p ? noIdRequired(p) : false;
    const alternatives = (p?.document_alternatives || []).filter(Boolean);
    const status = p ? hoursDisplay(p, language) : null;
    // Only what this provider lists, plus optional items that speed things up.
    const checklistItems = [
      ...bring.map((item) => ({ key: `doc:${item}`, label: item, desc: es ? "Lo pide este lugar" : "This place asks for it" })),
      { key: "opt:medi-cal", label: es ? "Tarjeta de Medi-Cal (si tiene)" : "Medi-Cal card (if you have one)", desc: es ? "Opcional — puede acelerar el servicio" : "Optional — can speed things up" },
      { key: "opt:case-manager", label: es ? "Contacto de su administrador de caso (si tiene)" : "Case manager's name and phone (if you have one)", desc: es ? "Opcional" : "Optional" },
    ];
    const whatToCheck = [
      ...(status?.state !== "open" ? [{ key: "chk:hours", label: es ? "Llame para confirmar el horario de hoy" : "Call to confirm today's hours", desc: p?.hours || (es ? "Horario no publicado" : "Hours not listed") }] : []),
      ...(p && !acceptsWalkIns(p) ? [{ key: "chk:walkin", label: es ? "Pregunte si aceptan personas sin cita" : "Ask if you can walk in", desc: es ? "No sabemos si aceptan sin cita" : "We don't know if they take walk-ins" }] : []),
      { key: "chk:route", label: es ? "Planee cómo llegar" : "Plan how to get there", desc: es ? "Autobús, a pie o con alguien" : "Bus, walking, or a ride" },
    ];
    const box = (item: { key: string; label: string; desc: string }) => (
      <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(checklist[item.key])} onChange={() => setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key] }))} style={{ width: 22, height: 22, marginTop: 1, accentColor: "var(--zs-color-brand)", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: fg }}>{item.label}</div>
          <div style={{ fontSize: 13, color: subFg, marginTop: 2 }}>{item.desc}</div>
        </div>
      </label>
    );
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.beforeYouGo}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        {p && <Breadcrumbs style={{ padding: "10px 16px 0" }} items={[{ label: t.home, onSelect: () => navigate("home") }, { label: p.org_name, onSelect: () => navigate("resource-detail") }, { label: t.beforeYouGo }]} />}
        <div style={{ padding: "16px" }}>
          {p && <div style={{ padding: "12px 14px", background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: fg }}>{p.org_name}</div>
            <div style={{ fontSize: 14, color: fg, marginTop: 4 }}>{p.address}</div>
            {status && <div style={{ fontSize: 14, marginTop: 6 }}><span style={{ color: status.color, fontWeight: 700 }}>{status.word}</span>{status.state === "open" && <span style={{ color: subFg }}> · {status.label}</span>}</div>}
          </div>}
          {idOptional && <div role="note" style={{ padding: "12px 14px", borderRadius: 10, background: darkMode ? "#052e16" : "#dcfce7", color: darkMode ? "#bbf7d0" : "#14532d", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{es ? "Puede ir aunque no tenga identificación." : "You can go even if you don't have ID."}</div>}
          <h2 style={{ fontWeight: 700, fontSize: 13, color: subFg, letterSpacing: 0.5, margin: "0 0 12px" }}>{t.checklist}</h2>
          {checklistItems.map(box)}
          {!idOptional && alternatives.length > 0 && <div style={{ padding: "12px 14px", borderRadius: 10, border: `1px solid ${borderColor}`, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: fg, marginBottom: 6 }}>{es ? "¿No tiene ID o documentos? Pregunte:" : "No ID or papers? Ask about:"}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: fg, lineHeight: 1.6 }}>{alternatives.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>}
          <h2 style={{ fontWeight: 700, fontSize: 13, color: subFg, letterSpacing: 0.5, margin: "20px 0 12px" }}>{t.whatToCheck}</h2>
          {whatToCheck.map(box)}
          {p?.phone && <a href={`tel:${p.phone}`} onClick={() => sendFieldEvent("resource_call", p.record_id, { from: "before-you-go" })} style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, width: "100%", minHeight: 52, boxSizing: "border-box", padding: "14px 0", background: status?.state === "open" ? "transparent" : "#15803d", color: status?.state === "open" ? "#15803d" : "#fff", border: "2px solid #15803d", borderRadius: 10, fontWeight: 800, fontSize: 16, textDecoration: "none", marginBottom: 12 }}><Phone size={18} aria-hidden="true" /> {es ? `Llamar ${p.phone}` : `Call ${p.phone}`}</a>}
          <button type="button" onClick={() => navigate("directions")} style={{
            width: "100%", minHeight: 52, padding: "16px 0", background: "var(--zs-color-brand)", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 12,
          }}>{t.iReadyToGo}</button>
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── DIRECTIONS ───────────────────────────────────────────────────────────
  if (screen === "directions") {
    const p = selectedProvider;
    const es = language === "es";
    const destination = p ? (p.address || `${p.lat},${p.lng}`) : "";
    // Hand off to a real routing app. The previous screen showed the same
    // made-up bus route and times for every provider.
    const modes = [
      { id: "transit", icon: BusFront, label: es ? "Autobús" : "Bus", mode: "transit" },
      { id: "walk", icon: Navigation, label: es ? "Caminar" : "Walk", mode: "walking" },
      { id: "drive", icon: Landmark, label: es ? "Auto" : "Car", mode: "driving" },
      { id: "bike", icon: Activity, label: es ? "Bicicleta" : "Bike", mode: "bicycling" },
    ] as const;
    const openRoute = (mode: string) => {
      if (!p) return;
      sendFieldEvent("directions_handoff", p.record_id, { mode });
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`, "_blank", "noopener,noreferrer");
    };
    const status = p ? hoursDisplay(p, language) : null;
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.directions}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        {p && <Breadcrumbs style={{ padding: "10px 16px 0" }} items={[{ label: t.home, onSelect: () => navigate("home") }, { label: p.org_name, onSelect: () => navigate("resource-detail") }, { label: t.directions }]} />}
        <div style={{ padding: "16px" }}>
          {!p ? <p style={{ fontSize: 15, color: fg }}>{es ? "Elija un lugar primero." : "Choose a place first."}</p> : <>
          <section aria-labelledby="zs-destination" style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
            <h2 id="zs-destination" style={{ margin: 0, fontSize: 13, color: subFg, fontWeight: 700, letterSpacing: 0.5 }}>{es ? "VAYA A" : "GO TO"}</h2>
            <div style={{ fontSize: 18, fontWeight: 800, color: fg, marginTop: 6 }}>{p.org_name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: fg, marginTop: 4, lineHeight: 1.35 }}>{p.address}</div>
            {status && <div style={{ fontSize: 14, marginTop: 8 }}><span style={{ color: status.color, fontWeight: 700 }}>{status.word}</span>{status.state === "open" && <span style={{ color: subFg }}> · {status.label}</span>}</div>}
            <p style={{ margin: "10px 0 0", fontSize: 13, color: subFg }}>{es ? "Puede mostrarle esta dirección al chofer del autobús." : "You can show this address to the bus driver."}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${p.org_name}, ${p.address}`); setShareStatus(es ? "Dirección copiada." : "Address copied."); announce(es ? "Dirección copiada" : "Address copied"); } catch { setShareStatus(es ? `Anote: ${p.address}` : `Write down: ${p.address}`); } }} style={{ flex: "1 1 140px", minHeight: 44, border: `1px solid ${borderColor}`, borderRadius: 8, background: bg, color: fg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{es ? "Copiar dirección" : "Copy address"}</button>
              {p.phone && <a href={`tel:${p.phone}`} onClick={() => sendFieldEvent("resource_call", p.record_id, { from: "directions" })} style={{ flex: "1 1 140px", minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "2px solid #15803d", borderRadius: 8, color: "#15803d", fontWeight: 800, fontSize: 14, textDecoration: "none" }}><Phone size={16} aria-hidden="true" /> {es ? "Llamar" : "Call"}</a>}
            </div>
            {shareStatus && <p role="status" style={{ margin: "8px 0 0", fontSize: 13, color: "#0f766e", fontWeight: 600 }}>{shareStatus}</p>}
          </section>
          <h2 style={{ fontWeight: 700, fontSize: 13, color: subFg, letterSpacing: 0.5, margin: "0 0 10px" }}>{es ? "ABRIR RUTA EN GOOGLE MAPS" : "OPEN A ROUTE IN GOOGLE MAPS"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
            {modes.map((mode) => (
              <button key={mode.id} type="button" onClick={() => openRoute(mode.mode)} style={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, background: mode.id === "transit" ? "var(--zs-color-brand)" : cardBg, border: `1px solid ${mode.id === "transit" ? "var(--zs-color-brand)" : borderColor}`, color: mode.id === "transit" ? "#fff" : fg, cursor: "pointer", fontSize: 16, fontWeight: 700 }}>
                <mode.icon size={20} strokeWidth={1.8} aria-hidden="true" />{mode.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: subFg, margin: "0 0 16px" }}>{es ? "Se abre en una página nueva. Los horarios de autobús vienen de Google Maps." : "Opens in a new page. Bus times come from Google Maps."}</p>
          {!lowData && <button type="button" onClick={() => navigate("map")} style={{
            width: "100%", minHeight: 48, padding: "14px 0", background: cardBg, color: "var(--zs-color-brand)",
            border: "2px solid var(--zs-color-brand)", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}><Map size={17} strokeWidth={1.8} aria-hidden="true" /> {t.viewOnMap}</button>}
          </>}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── FAVORITES ────────────────────────────────────────────────────────────
  if (screen === "favorites") {
    const savedList = providers.filter((p) => savedProviders.includes(p.record_id));
    const recentList = providers.filter((p) => recentlyViewed.includes(p.record_id));
    const displayList = favTab === "favorites" ? savedList : recentList;
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 18, color: fg }}>{t.saved}</span>} />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        {/* Tabs */}
        <div style={{ display: "flex", padding: "12px 16px", gap: 8 }}>
          <button onClick={() => setFavTab("favorites")} style={{
            padding: "8px 20px", borderRadius: 20,
            background: favTab === "favorites" ? "var(--zs-color-brand)" : cardBg,
            color: favTab === "favorites" ? "#fff" : fg,
            border: `1px solid ${favTab === "favorites" ? "var(--zs-color-brand)" : borderColor}`,
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>Favorites</button>
          <button onClick={() => setFavTab("recent")} style={{
            padding: "8px 20px", borderRadius: 20,
            background: favTab === "recent" ? "var(--zs-color-brand)" : cardBg,
            color: favTab === "recent" ? "#fff" : fg,
            border: `1px solid ${favTab === "recent" ? "var(--zs-color-brand)" : borderColor}`,
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>{t.recentlyViewed}</button>
        </div>
        <div style={{ padding: "0 16px" }}>
          {displayList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ width: 54, height: 54, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}>{favTab === "favorites" ? <Heart size={28} strokeWidth={1.8} aria-hidden="true" /> : <Clock3 size={28} strokeWidth={1.8} aria-hidden="true" />}</div>
              <div style={{ fontWeight: 600, fontSize: 16, color: fg, marginBottom: 8 }}>{t.noSaved}</div>
              <div style={{ fontSize: 14, color: subFg }}>{t.noSavedDesc}</div>
            </div>
          ) : (
            displayList.map((p) => {
              const catId = getCategoryForProvider(p);
              const status = hoursDisplay(p, language);
              return (
                <button key={p.record_id} onClick={() => openProvider(p)} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "12px 0", background: "none", border: "none",
                  borderBottom: `1px solid ${borderColor}`, cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: getCategoryColor(catId) + "20",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                  }}><CategoryGlyph catId={catId} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 2 }}>
                      {p.org_name.length > 38 ? p.org_name.slice(0, 38) + "…" : p.org_name}
                    </div>
                    <div style={{ fontSize: 12, color: subFg }}>{getDistanceLabel(p)} · {p.service_category.split("/")[0].trim()}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <span style={{ color: status.color, fontWeight: 600 }}>{status.word}</span>{status.label ? <>{" · "}<span style={{ color: subFg }}>{status.label}</span></> : null}
                    </div>
                  </div>
                  <Heart size={20} color="#dc2626" fill="currentColor" aria-hidden="true" />
                </button>
              );
            })
          )}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── GET HELP (AOR INTAKE) ────────────────────────────────────────────────
  if (screen === "gethelp") {
    const aorNeeds = ["Emergency Shelter", "Food Assistance", "Medical Care", "Mental Health", "Housing", "Transportation", "Legal Help", "Employment", "Documents / ID", "Other"];
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<img onError={(event) => { event.currentTarget.style.display = "none"; }} src={AOR_LOGO} alt="AOR" style={{ height: 32 }} />} />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "16px" }}>
          {/* AOR Banner */}
          <div style={{
            background: "#d97706", borderRadius: 14, padding: "16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={AOR_LOGO} alt="AOR" style={{ height: 44, width: 44, borderRadius: 8, background: "#fff", padding: 4 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{t.aorTitle}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{t.aorSubtitle}</div>
            </div>
          </div>

          {aorSubmitted ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 66, height: 66, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}><CheckCircle2 size={38} strokeWidth={1.8} aria-hidden="true" /></div>
              <div style={{ fontWeight: 700, fontSize: 20, color: fg, marginBottom: 8 }}>{language === "es" ? "¡Solicitud enviada!" : "Referral sent!"}</div>
              {lastReferralCode && <div style={{ margin: "0 auto 16px", maxWidth: 360, padding: "14px", border: `2px dashed ${borderColor}`, borderRadius: 12 }}>
                <div style={{ fontSize: 13, color: subFg }}>{language === "es" ? "Su código de referencia — anótelo o tome una foto" : "Your referral code — write it down or take a photo"}</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, letterSpacing: 1, color: fg, fontFamily: "ui-monospace, monospace" }}>{lastReferralCode}</div>
              </div>}
              <div style={{ fontSize: 14, color: subFg, marginBottom: 24, lineHeight: 1.6, maxWidth: 420, marginInline: "auto" }}>
                {aorData.contactPreference === "check_back_with_code"
                  ? (language === "es" ? "Sin teléfono está bien. Muestre este código en cualquier oficina asociada o en un refugio, y el personal podrá ver su solicitud." : "No phone is fine. Show this code at any partner office or shelter and staff can look up your request.")
                  : aorData.contactPreference === "case_manager"
                    ? (language === "es" ? "Nos comunicaremos por medio de su administrador de caso o el personal del refugio en 1 a 2 días hábiles." : "We'll reach you through your case manager or shelter staff within 1–2 business days.")
                    : aorData.contactPreference === "shared_phone_no_details"
                      ? (language === "es" ? "Le llamaremos en 1 a 2 días hábiles y no dejaremos detalles en mensajes." : "We'll call within 1–2 business days and won't leave details in messages.")
                      : (language === "es" ? "Un coordinador le contactará en 1 a 2 días hábiles." : "A coordinator will contact you within 1–2 business days.")}
              </div>
              <button onClick={() => { setAorSubmitted(false); setAorStep(0); setAorData({ name: "", phone: "", situation: "", needs: [], consent: false, contactPreference: "", housingStatus: "", sdohConsent: false }); setAorHandoff(null); navigate("home"); }}
                style={{
                  padding: "14px 32px", background: "var(--zs-color-brand)", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>{language === "es" ? "Volver al inicio" : "Return Home"}</button>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                {[0, 1, 2].map((step) => (
                  <div key={step} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: step <= aorStep ? "var(--zs-color-brand)" : borderColor,
                  }} />
                ))}
              </div>

              {aorStep === 0 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 6 }}>What do you need help with?</div>
                  <div style={{ fontSize: 13, color: subFg, marginBottom: 16 }}>Select all that apply</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                    {aorNeeds.map((need) => {
                      const selected = aorData.needs.includes(need);
                      return (
                        <button key={need} onClick={() => setAorData((prev) => ({
                          ...prev,
                          needs: selected ? prev.needs.filter((n) => n !== need) : [...prev.needs, need],
                        }))} style={{
                          padding: "8px 14px", borderRadius: 20,
                          background: selected ? "var(--zs-color-brand)" : cardBg,
                          border: `1px solid ${selected ? "var(--zs-color-brand)" : borderColor}`,
                          color: selected ? "#fff" : fg,
                          fontWeight: selected ? 600 : 400, cursor: "pointer", fontSize: 13,
                        }}>{need}</button>
                      );
                    })}
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 8 }}>Describe your situation (optional)</div>
                    <textarea value={aorData.situation} onChange={(e) => setAorData((prev) => ({ ...prev, situation: e.target.value }))}
                      placeholder="Tell us more about what you're experiencing..."
                      style={{
                        width: "100%", minHeight: 100, padding: "12px", borderRadius: 10,
                        border: `1px solid ${borderColor}`, background: cardBg, color: fg,
                        fontSize: 14, resize: "vertical", boxSizing: "border-box",
                      }} />
                  </div>
                  <button onClick={() => setAorStep(1)} disabled={aorData.needs.length === 0}
                    style={{
                      width: "100%", padding: "14px 0", background: aorData.needs.length > 0 ? "var(--zs-color-brand)" : "#9ca3af",
                      color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: aorData.needs.length > 0 ? "pointer" : "not-allowed",
                    }}>{t.next} →</button>
                </div>
              )}

              {aorStep === 1 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 6 }}>{language === "es" ? "¿Cómo podemos comunicarnos con usted?" : "How can we reach you?"}</div>
                  <div style={{ fontSize: 13, color: subFg, marginBottom: 16 }}>{language === "es" ? "No necesita teléfono, ID ni dirección para pedir ayuda." : "You don't need a phone, ID, or address to ask for help."}</div>
                  <label htmlFor="zs-aor-name" style={{ display: "block", fontWeight: 600, fontSize: 14, color: fg, marginBottom: 6 }}>{language === "es" ? "Nombre o apodo (opcional)" : "First name or nickname (optional)"}</label>
                  <input id="zs-aor-name" type="text" autoComplete="given-name" value={aorData.name} onChange={(e) => setAorData((prev) => ({ ...prev, name: e.target.value }))} style={{ ...{ width: "100%", minHeight: 48, padding: "12px 14px", borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: fg, fontSize: 16, boxSizing: "border-box" as const }, marginBottom: 16 }} />
                  <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
                    <legend style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 8 }}>{language === "es" ? "La mejor forma de contactarle" : "Best way to reach you"}</legend>
                    {CONTACT_PREFERENCES.map((preference) => <label key={preference} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "8px 12px", marginBottom: 6, borderRadius: 10, border: `1px solid ${aorData.contactPreference === preference ? "var(--zs-color-brand)" : borderColor}`, background: aorData.contactPreference === preference ? (darkMode ? "#163d42" : "#e3f5f3") : cardBg, cursor: "pointer", fontSize: 15, color: fg }}>
                      <input type="radio" name="zs-aor-contact" value={preference} checked={aorData.contactPreference === preference} onChange={() => setAorData((prev) => ({ ...prev, contactPreference: preference }))} style={{ width: 20, height: 20, accentColor: "var(--zs-color-brand)" }} />
                      {CONTACT_PREFERENCE_LABELS[preference][language]}
                    </label>)}
                  </fieldset>
                  {contactNeedsPhone(aorData.contactPreference || null) && <>
                    <label htmlFor="zs-aor-phone" style={{ display: "block", fontWeight: 600, fontSize: 14, color: fg, marginBottom: 6 }}>{language === "es" ? "Número de teléfono" : "Phone number"}</label>
                    <input id="zs-aor-phone" type="tel" autoComplete="tel" inputMode="tel" value={aorData.phone} onChange={(e) => setAorData((prev) => ({ ...prev, phone: e.target.value }))} placeholder="(209) 555-0100" style={{ ...{ width: "100%", minHeight: 48, padding: "12px 14px", borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: fg, fontSize: 16, boxSizing: "border-box" as const }, marginBottom: 16 }} />
                  </>}
                  <label htmlFor="zs-aor-housing" style={{ display: "block", fontWeight: 600, fontSize: 14, color: fg, marginBottom: 6 }}>{language === "es" ? "¿Dónde se está quedando ahora? (opcional)" : "Where are you staying right now? (optional)"}</label>
                  <select id="zs-aor-housing" value={aorData.housingStatus} onChange={(e) => setAorData((prev) => ({ ...prev, housingStatus: e.target.value as HousingStatus | "", sdohConsent: e.target.value ? prev.sdohConsent : false }))} style={{ ...{ width: "100%", minHeight: 48, padding: "12px 14px", borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: fg, fontSize: 16, boxSizing: "border-box" as const }, marginBottom: 8 }}>
                    <option value="">{language === "es" ? "Saltar esta pregunta" : "Skip this question"}</option>
                    {HOUSING_STATUSES.map((status) => <option key={status} value={status}>{HOUSING_STATUS_LABELS[status][language]}</option>)}
                  </select>
                  {aorData.housingStatus && <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer", fontSize: 13, color: subFg, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={aorData.sdohConsent} onChange={(e) => setAorData((prev) => ({ ...prev, sdohConsent: e.target.checked }))} style={{ width: 20, height: 20, marginTop: 1, accentColor: "var(--zs-color-brand)", flexShrink: 0 }} />
                    <span>{language === "es" ? "Pueden usar esto para entender quién recibe ayuda y qué lo impide. Los investigadores solo ven totales, nunca su nombre. Si no marca esto, no lo guardamos." : "You can use this to understand who gets help and what gets in the way. Researchers only see totals, never your name. If you leave this unchecked, we don't save it."}</span>
                  </label>}
                  <button onClick={() => navigate("referral-destination")} style={{ width: "100%", padding: "12px 14px", marginBottom: 10, background: selectedProvider ? "#e3f5f3" : cardBg, color: selectedProvider ? "#0f766e" : fg, border: `1px solid ${selectedProvider ? "#b8e5e0" : borderColor}`, borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{selectedProvider ? `Destination selected: ${selectedProvider.org_name}` : "Choose a referral destination"}</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setAorStep(0)} style={{
                      flex: 1, padding: "14px 0", background: cardBg, color: fg,
                      border: `1px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer",
                    }}>{t.back}</button>
                    <button onClick={() => setAorStep(2)} style={{
                      flex: 2, padding: "14px 0", background: "var(--zs-color-brand)", color: "#fff",
                      border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
                    }}>{t.next} →</button>
                  </div>
                </div>
              )}

              {aorStep === 2 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 6 }}>Review & Submit</div>{aorSubmitError && <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 9, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>{aorSubmitError}</div>}
                  <div style={{ fontSize: 13, color: subFg, marginBottom: 16 }}>Please review your information before submitting</div>
                  <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px", marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: subFg, marginBottom: 8 }}>NEEDS SELECTED</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {aorData.needs.map((n) => (
                        <span key={n} style={{ padding: "4px 10px", background: "#eff6ff", color: "var(--zs-color-brand)", borderRadius: 20, fontSize: 12 }}>{n}</span>
                      ))}
                    </div>
                  </div>
                  {(aorData.name || aorData.contactPreference) && (
                    <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px", marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: subFg, marginBottom: 8 }}>{language === "es" ? "CONTACTO" : "CONTACT"}</div>
                      {aorData.name && <div style={{ fontSize: 14, color: fg, marginBottom: 4 }}>{language === "es" ? "Nombre" : "Name"}: {aorData.name}</div>}
                      {aorData.contactPreference && <div style={{ fontSize: 14, color: fg, marginBottom: 4 }}>{CONTACT_PREFERENCE_LABELS[aorData.contactPreference][language]}</div>}
                      {aorData.phone && contactNeedsPhone(aorData.contactPreference || null) && <div style={{ fontSize: 14, color: fg }}>{language === "es" ? "Teléfono" : "Phone"}: {aorData.phone}</div>}
                    </div>
                  )}
                  {selectedProvider && <div style={{ background: "#e3f5f3", border: "1px solid #b8e5e0", borderRadius: 12, padding: "14px", marginBottom: 16 }}><div style={{ fontWeight: 800, fontSize: 13, color: "#0f766e", marginBottom: 6 }}>REFERRAL DESTINATION</div><div style={{ fontSize: 15, fontWeight: 800, color: fg }}>{selectedProvider.org_name}</div><div style={{ marginTop: 4, fontSize: 13, color: subFg }}>{selectedProvider.program_name} · {selectedProvider.city}</div>{aorHandoff && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #b8e5e0", fontSize: 12, color: "#0f766e" }}><strong>Handoff:</strong> {aorHandoff.outcome.replace(/-/g, " ")} · Documents: {aorHandoff.documentBurden} · Transit: {aorHandoff.transitFeasibility}</div>}<button onClick={() => navigate("referral-destination")} style={{ marginTop: 10, border: 0, background: "transparent", color: "#0f766e", fontWeight: 800, fontSize: 12, padding: 0 }}>Change selection</button></div>}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                    <input type="checkbox" checked={aorData.consent}
                      onChange={() => setAorData((prev) => ({ ...prev, consent: !prev.consent }))}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--zs-color-brand)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: subFg, lineHeight: 1.5 }}>
                      I consent to sharing this information with ZipShift and partner organizations to connect me with services.
                    </span>
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setAorStep(1)} style={{
                      flex: 1, padding: "14px 0", background: cardBg, color: fg,
                      border: `1px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer",
                    }}>{t.back}</button>
                    <button onClick={() => void submitAor()}
                      disabled={!aorData.consent || aorSubmitting}
                      style={{
                        flex: 2, padding: "14px 0",
                        background: aorData.consent ? "#d97706" : "#9ca3af",
                        color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15,
                        cursor: aorData.consent ? "pointer" : "not-allowed",
                      }}>{aorSubmitting ? "Submitting…" : `${t.submit} Referral`}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── MORE / PROFILE ───────────────────────────────────────────────────────
  if (screen === "more") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 28 }} />} />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "16px" }}>
          {/* Profile card */}
          <div style={{
            background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 14,
            padding: "20px", marginBottom: 20, textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "#e3f5f3", color: "#0f766e",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
            }}><UserCircle size={34} strokeWidth={1.7} aria-hidden="true" /></div>
            <div style={{ fontWeight: 700, fontSize: 16, color: fg, marginBottom: 6 }}>{clientUser?.displayName || t.helloThere}</div>
            <div style={{ fontSize: 13, color: subFg, marginBottom: 14 }}>{clientUser ? "Manage your saved resources, referral history, and accessibility preferences." : t.signInDesc}</div>
            <button onClick={startProfileSignIn} style={{
              padding: "10px 24px", background: "var(--zs-color-brand)", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>{clientUser ? "View Profile" : t.signIn}</button>
          </div>
          {[
            { icon: UsersRound, label: language === "es" ? "Acceso para personal" : "Staff sign-in", dest: "role-portal" as Screen },
            { icon: CalendarDays, label: "Referral History", dest: "referral-history" as Screen },
            { icon: Landmark, label: "Full Service Directory", dest: "client-directory" as Screen },
            { icon: CircleHelp, label: t.helpCenter, dest: "gethelp" as Screen },
            { icon: MessageSquare, label: t.feedback, dest: "feedback" as Screen },
            { icon: Info, label: t.aboutApp, dest: "about" as Screen },
            { icon: ShieldCheck, label: t.privacy, dest: "privacy" as Screen },
            { icon: FileText, label: t.terms, dest: "terms" as Screen },
          ].map((item) => (
            <button key={item.label} onClick={() => navigate(item.dest)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 0",
              background: "none", border: "none", borderBottom: `1px solid ${borderColor}`,
              cursor: "pointer", color: fg, fontSize: 15, width: "100%", textAlign: "left",
            }}>
              <item.icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ color: subFg }}>›</span>
            </button>
          ))}
          {/* Language */}
          <div style={{ padding: "14px 0", borderBottom: `1px solid ${borderColor}` }}>
            <div style={{ color: subFg, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{t.language}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["en", "es"] as const).map((lang) => (
                <button key={lang} type="button" lang={lang} aria-pressed={language === lang} onClick={() => { setLanguage(lang); announce(lang === "es" ? "Idioma: Español" : "Language: English"); }} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `2px solid ${language === lang ? "var(--zs-color-brand)" : borderColor}`,
                  background: language === lang ? "#eff6ff" : bg,
                  color: language === lang ? "var(--zs-color-brand)" : fg,
                  fontWeight: language === lang ? 700 : 400, cursor: "pointer", fontSize: 14,
                }}>{lang === "en" ? "English" : "Español"}</button>
              ))}
            </div>
          </div>
          {/* Accessibility */}
          <div style={{ padding: "14px 0" }}>
            <div style={{ color: subFg, fontSize: 12, marginBottom: 10, fontWeight: 600 }}>{t.accessibility}</div>
            {[
              { label: t.largeText, value: largeText, toggle: () => setLargeText(!largeText) },
              { label: t.darkMode, value: darkMode, toggle: () => setDarkMode(!darkMode) },
                { label: t.reduceMotion, value: reduceMotion, toggle: () => setReduceMotion(!reduceMotion) },
              { label: language === "es" ? "Modo de pocos datos" : "Low-data mode", value: lowData, toggle: () => setLowData(!lowData) },
              { label: language === "es" ? "Teléfono compartido (no guardar en este teléfono)" : "Shared phone (don't keep my info on this phone)", value: sharedDevice, toggle: () => setSharedDevice(!sharedDevice) },
            ].map((opt) => (
              <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: fg, fontSize: 14 }}>{opt.label}</span>
                <button type="button" role="switch" aria-checked={opt.value} aria-label={opt.label} onClick={opt.toggle} className="zs-switch" />
              </div>
            ))}
          <button type="button" onClick={() => { removeLocal([LOCAL_KEYS.saved, LOCAL_KEYS.recent, LOCAL_KEYS.lastReferral, "zipshift.field-test.session", "zipshift-notification-read"]); if (!clientUser) setSavedProviders([]); setRecentlyViewed([]); setLastReferralCode(null); announce(language === "es" ? "Datos borrados de este teléfono" : "Cleared from this phone"); }} style={{ marginTop: 8, width: "100%", minHeight: 48, borderRadius: 10, border: "2px solid #b91c1c", background: "transparent", color: "#b91c1c", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{language === "es" ? "Borrar mis lugares y búsquedas de este teléfono" : "Clear my saved places and history from this phone"}</button>
          </div>
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── ABOUT ────────────────────────────────────────────────────────────────
  if (screen === "about") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.aboutApp}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "20px 16px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 60, marginBottom: 12 }} />
            <div style={{ fontSize: 13, color: subFg }}>Version 1.0.0</div>
          </div>
          <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: fg, marginBottom: 8 }}>About ZipShift</div>
            <p style={{ color: subFg, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              ZipShift is a community resource navigation tool designed to help individuals and families in Stanislaus County find verified social services, prepare for appointments, and connect with the support they need.
            </p>
          </div>
          <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: fg, marginBottom: 8 }}>Our Mission</div>
            <p style={{ color: subFg, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              To bridge the gap between people in need and the services that can help them — through accurate information, accessible technology, and community partnerships.
            </p>
          </div>
          <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: fg, marginBottom: 12 }}>Powered By</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={GREENBOOK_LOGO} alt="GreenBook" style={{ height: 32 }} />
              <div style={{ fontSize: 13, color: subFg }}>GreenBook Community Directory</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={AOR_LOGO} alt="AOR" style={{ height: 32 }} />
              <div style={{ fontSize: 13, color: subFg }}>AOR Feedback & Referral System</div>
            </div>
          </div>
          <button onClick={() => navigate("feedback")} style={{
            width: "100%", padding: "14px 0", background: "var(--zs-color-brand)", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}><MessageSquare size={17} strokeWidth={1.8} aria-hidden="true" /> Send Feedback</button>
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── FEEDBACK ─────────────────────────────────────────────────────────────
  if (screen === "feedback") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.feedback}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "20px 16px" }}>
          {feedbackSubmitted ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 64, height: 64, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}><CheckCircle2 size={36} strokeWidth={1.8} aria-hidden="true" /></div>
              <div style={{ fontWeight: 700, fontSize: 20, color: fg, marginBottom: 8 }}>Thank You!</div>
              <div style={{ fontSize: 14, color: subFg, marginBottom: 24 }}>Your feedback helps us improve ZipShift for everyone.</div>
              <button onClick={() => { setFeedbackSubmitted(false); setFeedbackAccess(null); setFeedbackBarriers([]); setFeedbackText(""); setFeedbackError(""); navigate("home"); }}
                style={{
                  padding: "14px 32px", background: "var(--zs-color-brand)", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>Return Home</button>
            </div>
          ) : (
            <>
              {feedbackError && <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid #fecaca", borderRadius: 9, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>{feedbackError}</div>}
              <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 8 }}>Was this easy to access?</div>
              <div style={{ color: subFg, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>Your feedback helps identify access barriers and improve services for everyone.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[{ value: "easy" as const, label: "Easy", detail: "I was able to get what I needed" }, { value: "not_easy" as const, label: "Not easy", detail: "I had trouble accessing this" }].map((choice) => <button key={choice.value} onClick={() => { setFeedbackAccess(choice.value); setFeedbackError(""); }} style={{ textAlign: "left", padding: 14, background: feedbackAccess === choice.value ? "#e3f5f3" : cardBg, border: `2px solid ${feedbackAccess === choice.value ? "var(--zs-color-brand)" : borderColor}`, borderRadius: 11, color: fg, cursor: "pointer" }}><span style={{ display: "block", fontWeight: 800, fontSize: 15 }}>{choice.label}</span><span style={{ display: "block", marginTop: 5, fontSize: 12, color: subFg, lineHeight: 1.4 }}>{choice.detail}</span></button>)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: fg, marginBottom: 8 }}>What made it difficult? <span style={{ fontWeight: 400, color: subFg }}>(select all that apply)</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{["Documents", "Language", "Transit", "Hours", "Wrong information"].map((barrier) => { const active = feedbackBarriers.includes(barrier); return <button key={barrier} onClick={() => setFeedbackBarriers((current) => active ? current.filter((item) => item !== barrier) : [...current, barrier])} style={{ padding: "9px 11px", border: `1px solid ${active ? "var(--zs-color-brand)" : borderColor}`, borderRadius: 9, background: active ? "#e3f5f3" : cardBg, color: active ? "#0f766e" : fg, fontSize: 12, fontWeight: active ? 800 : 600 }}>{barrier}</button>; })}</div>
              <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Tell us more (optional)" style={{ width: "100%", minHeight: 100, padding: "12px", borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: fg, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={async () => { if (!feedbackAccess || (!feedbackBarriers.length && !feedbackText.trim())) { setFeedbackError("Choose an access outcome and add a barrier or note."); return; } try { const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ accessRating: feedbackAccess, barriers: feedbackBarriers, narrative: feedbackText }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error || "Unable to submit feedback."); setFeedbackSubmitted(true); } catch (error) { setFeedbackError(error instanceof Error ? error.message : "Unable to submit feedback."); } }} style={{ marginTop: 16, width: "100%", padding: "14px 0", background: "var(--zs-color-brand)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Submit access feedback</button>
            </>
          )}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── PRIVACY ──────────────────────────────────────────────────────────────
  if (screen === "privacy") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.privacy}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "20px 16px" }}>
          {[
            { title: "Information We Collect", body: "ZipShift collects only the minimum information necessary to provide services. This includes location data (with your permission), search queries, and saved resources. Covered-ZIP search demand is stored only as an anonymous daily aggregate; ZipShift does not retain IP addresses, account identifiers, or search terms with that metric." },
            { title: "How We Use Your Information", body: "Your data is used solely to improve your experience within the app — providing relevant resource suggestions, calculating distances, and personalizing your saved resources list." },
            { title: "Data Sharing", body: "We do not sell your personal data to third parties. Anonymized, aggregated usage data may be shared with community partners to improve resource availability." },
            { title: "Your Rights", body: "You may request deletion of your account and associated data at any time by contacting us through the Feedback section." },
            { title: "Contact", body: "For privacy concerns, contact us at privacy@zipshift.app" },
          ].map((section) => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: fg, marginBottom: 8 }}>{section.title}</div>
              <p style={{ color: subFg, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{section.body}</p>
            </div>
          ))}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── TERMS ────────────────────────────────────────────────────────────────
  if (screen === "terms") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.terms}</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "20px 16px" }}>
          {[
            { title: "Acceptance of Terms", body: "By using ZipShift, you agree to these Terms of Use. If you do not agree, please do not use the application." },
            { title: "Use of the Application", body: "ZipShift is provided as a community resource navigation tool. Resource information is provided for informational purposes only and may change without notice." },
            { title: "Accuracy of Information", body: "While we strive to maintain accurate and up-to-date information, ZipShift does not guarantee the accuracy, completeness, or availability of any listed resource." },
            { title: "Limitation of Liability", body: "ZipShift and its partners are not liable for any damages arising from use of the application or reliance on information provided." },
            { title: "Changes to Terms", body: "We reserve the right to modify these terms at any time. Continued use of the application constitutes acceptance of updated terms." },
          ].map((section) => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: fg, marginBottom: 8 }}>{section.title}</div>
              <p style={{ color: subFg, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{section.body}</p>
            </div>
          ))}
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  // ─── SETTINGS (fallback) ──────────────────────────────────────────────────
  if (screen === "settings") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <RenderSlot render={HamburgerMenu} />
        <RenderSlot render={Header} title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>Settings</span>} showBack />
        <main id="main-content" key={screen} tabIndex={-1} className="zs-screen">
        <div style={{ padding: "16px" }}>
          <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.language}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {(["en", "es"] as const).map((lang) => (
              <button key={lang} type="button" lang={lang} aria-pressed={language === lang} onClick={() => { setLanguage(lang); announce(lang === "es" ? "Idioma: Español" : "Language: English"); }} style={{
                flex: 1, padding: "10px 0", borderRadius: 8,
                border: `2px solid ${language === lang ? "var(--zs-color-brand)" : borderColor}`,
                background: language === lang ? "#eff6ff" : bg,
                color: language === lang ? "var(--zs-color-brand)" : fg,
                fontWeight: language === lang ? 700 : 400, cursor: "pointer", fontSize: 14,
              }}>{lang === "en" ? "English" : "Español"}</button>
            ))}
          </div>
          <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.accessibility}</div>
          {[
            { label: t.largeText, value: largeText, toggle: () => setLargeText(!largeText) },
            { label: t.darkMode, value: darkMode, toggle: () => setDarkMode(!darkMode) },
                { label: t.reduceMotion, value: reduceMotion, toggle: () => setReduceMotion(!reduceMotion) },
            { label: language === "es" ? "Modo de pocos datos" : "Low-data mode", value: lowData, toggle: () => setLowData(!lowData) },
            { label: language === "es" ? "Teléfono compartido (no guardar en este teléfono)" : "Shared phone (don't keep my info on this phone)", value: sharedDevice, toggle: () => setSharedDevice(!sharedDevice) },
          ].map((opt) => (
            <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: fg, fontSize: 15 }}>{opt.label}</span>
              <button type="button" role="switch" aria-checked={opt.value} aria-label={opt.label} onClick={opt.toggle} className="zs-switch" />
            </div>
          ))}
          <button type="button" onClick={() => { removeLocal([LOCAL_KEYS.saved, LOCAL_KEYS.recent, LOCAL_KEYS.lastReferral, "zipshift.field-test.session", "zipshift-notification-read"]); if (!clientUser) setSavedProviders([]); setRecentlyViewed([]); setLastReferralCode(null); announce(language === "es" ? "Datos borrados de este teléfono" : "Cleared from this phone"); }} style={{ marginTop: 8, width: "100%", minHeight: 48, borderRadius: 10, border: "2px solid #b91c1c", background: "transparent", color: "#b91c1c", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{language === "es" ? "Borrar mis lugares y búsquedas de este teléfono" : "Clear my saved places and history from this phone"}</button>
        </div>
        </main>
        <RenderSlot render={BottomNav} />
      </div>
    );
  }

  if (screen === "guided-entry") {
    return <div key={screen} className="zs-screen"><GuidedAccess providers={providers} language={language} onBack={() => setScreen("home")} onOpenProvider={(provider) => { openProvider(provider as Provider); }} onOpenDirectory={() => setScreen("county-directory")} onFieldEvent={(eventType) => sendFieldEvent(eventType, undefined, { language })} /></div>;
  }

  // Intake Form Screen
  if (screen === "intake-form") {
    return (
      <main id="main-content" key={screen} className="zs-screen"><IntakeFormFlow
        onBack={() => setScreen("gethelp")}
        onSubmit={(data, referralId) => {
          // Show the same confirmation (with the referral code) as Get Help instead of a blocking alert.
          if (referralId) { setLastReferralCode(referralId); if (!sharedDevice) writeLocal(LOCAL_KEYS.lastReferral, referralId); }
          setAorData((prev) => ({ ...prev, contactPreference: (CONTACT_PREFERENCES as readonly string[]).includes(data.contactPreference) ? data.contactPreference as ContactPreference : "" }));
          setAorSubmitted(true);
          navigate("gethelp");
        }}
      /></main>
    );
  }

  // Admin Dashboard Screen
  if (screen === "admin-dashboard") {
    return (
      <div key={screen} className="zs-screen"><AdminDashboard
        onBack={() => setScreen("home")}
        onSessionChange={handleWorkspaceSession}
      /></div>
    );
  }

  // Researcher Analytics Screen
  if (screen === "researcher-analytics") {
    return (
      <div key={screen} className="zs-screen"><ResearcherAnalytics
        onBack={() => setScreen("home")}
        onSessionChange={handleWorkspaceSession}
      /></div>
    );
  }

  if (screen === "role-portal") {
    return <div key={screen} className="zs-screen"><RolePortal user={sessionUser} onNavigate={(destination) => setScreen(destination as Screen)} /></div>;
  }
  if (screen === "staff-intake") {
    return <div key={screen} className="zs-screen"><StaffIntakeFlow onBack={() => setScreen("role-portal")} onComplete={() => setScreen("referrals-dispatch")} /></div>;
  }
  if (screen === "referrals-dispatch") {
    return <div key={screen} className="zs-screen"><ReferralsDispatch onBack={() => setScreen("role-portal")} onNewReferral={() => setScreen("staff-intake")} onNotifications={() => setScreen("notifications")} /></div>;
  }
  if (screen === "care-coordination") {
    return <div key={screen} className="zs-screen"><CareCoordinationPortal onBack={() => setScreen("role-portal")} /></div>;
  }
  if (screen === "specialist-dashboard") {
    return <div key={screen} className="zs-screen"><SpecialistDashboard onBack={() => setScreen("role-portal")} onOpenPortal={() => setScreen("care-coordination")} /></div>;
  }
  if (screen === "client-profile") {
    return (
      <main id="main-content" key={screen} className="zs-screen"><ClientProfile
        providers={providers}
        onBack={() => setScreen("more")}
        onSessionChange={handleClientSession}
      /></main>
    );
  }

  if (screen === "client-directory") {
    return <main id="main-content" key={screen} className="zs-screen"><ClientDirectory onBack={() => setScreen("more")} /></main>;
  }
  if (screen === "emergency-directory") {
    return <div key={screen} className="zs-screen"><EmergencyResourceDirectory language={language} onBack={() => setScreen("more")} /></div>;
  }
  if (screen === "county-directory") {
    return <div key={screen} className="zs-screen"><CountyResourceDirectory language={language} onBack={() => setScreen("more")} /></div>;
  }
  if (screen === "notifications") {
    return (
      <div key={screen} className="zs-screen"><NotificationCenter
        onBack={() => setScreen("more")}
        onProfile={() => setScreen("client-profile")}
        onHelp={() => setScreen("gethelp")}
        onRead={() => setNotificationCount((count) => Math.max(0, count - 1))}
      /></div>
    );
  }
  // Referral History Screen
  if (screen === "referral-history") {
    return (
      <div key={screen} className="zs-screen"><ReferralHistory
        onBack={() => setScreen("more")}
      /></div>
    );
  }

  return null;
}
