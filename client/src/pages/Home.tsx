import { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Accessibility, Activity, ArrowLeft, ArrowRight, Bell, Brain, Building2, BusFront, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3, ClipboardList, FileText, Globe2, Heart, HeartPulse, Home as HomeIcon, House, Info, Landmark, Map, MapPin, Menu, MessageSquare, MoreHorizontal, Navigation, Phone, Scale, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, UserCircle, UsersRound, Utensils, X } from "lucide-react";
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
  { id: "emergency-shelter", label: "Emergency\nShelter", icon: House, color: "#159d92" },
  { id: "food-meals", label: "Food &\nMeals", icon: Utensils, color: "#16a34a" },
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

function getStatusLabel(p: Provider): { open: boolean; label: string } {
  const h = (p.hours || "").toLowerCase();
  if (h.includes("24/7") || h.includes("24 hours")) return { open: true, label: "Open 24/7" };
  if (h.includes("closed")) return { open: false, label: "Closed" };
  return { open: true, label: "Open · Closes 5:00 PM" };
}

function spanishServiceLabel(value: string) {
  const labels: Record<string, string> = { "Emergency Shelter": "Refugio de emergencia", "Food & Meals": "Alimentos y comidas", Medical: "Atención médica", "Behavioral Health": "Salud conductual", Housing: "Vivienda", Transportation: "Transporte", "Case Management": "Administración de casos", "Document Assistance": "Ayuda con documentos", "Substance Use": "Consumo de sustancias" };
  return value.split("/").map((part) => labels[part.trim()] || part.trim()).join(" / ");
}

function spanishProviderDescription(provider: Provider) {
  return `${spanishServiceLabel(provider.service_category)} en ${provider.city}. Confirma horarios, documentos y disponibilidad antes de ir.`;
}

function sendFieldEvent(eventType: "guided_start" | "guided_completion" | "guided_dropoff" | "resource_open" | "resource_call" | "resource_directions" | "resource_website", resourceId?: string, metadata?: Record<string, unknown>) {
  let sessionKey = "";
  try { const key = "zipshift.field-test.session"; sessionKey = localStorage.getItem(key) || crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(key, sessionKey); } catch { /* optional when storage is unavailable */ }
  void fetch("/api/analytics/field-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType, resourceId, sessionKey, metadata }) }).catch(() => undefined);
}

function getCategoryIcon(catId: string): LucideIcon {
  return CATEGORIES.find((c) => c.id === catId)?.icon ?? MapPin;
}

function getCategoryColor(catId: string): string {
  return CATEGORIES.find((c) => c.id === catId)?.color ?? "#159d92";
}

function CategoryGlyph({ catId, size = 24 }: { catId: string; size?: number }) {
  const Icon = getCategoryIcon(catId);
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [prevScreen, setPrevScreen] = useState<Screen>("home");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [darkMode, setDarkMode] = useState(false);
  const [largeText, setLargeText] = useState(false);
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
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);
  const [favTab, setFavTab] = useState<"favorites" | "recent">("favorites");
  const [checklist, setChecklist] = useState({
    photoId: false, mediCal: false, proofHomeless: false,
    referralPaper: false, caseManager: false,
    hoursConfirmed: false, walkIn: false, transitPlanned: false, language: false,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<"all" | "Modesto" | "Turlock" | "Ceres">("all");
  const [activeNavTab, setActiveNavTab] = useState<"home" | "map" | "favorites" | "gethelp" | "more">("home");
  const [dirMode, setDirMode] = useState<"drive" | "transit" | "walk" | "bike">("transit");
  const [aorStep, setAorStep] = useState(0);
  const [aorData, setAorData] = useState({ name: "", dob: "", phone: "", situation: "", needs: [] as string[], consent: false });
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

  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const drawer = mobileDrawerRef.current;
    const getFocusable = () => drawer ? Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
    const focusFirst = window.setTimeout(() => getFocusable()[0]?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [menuOpen]);

  useEffect(() => {
    const requestedScreen = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    const allowedScreens: Screen[] = ["admin-dashboard", "researcher-analytics", "client-profile", "client-directory", "county-directory", "emergency-directory", "notifications", "role-portal", "staff-intake", "referrals-dispatch", "care-coordination", "specialist-dashboard"];
    const targetScreen = requestedScreen && allowedScreens.includes(requestedScreen) ? requestedScreen : "role-portal";
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
            setSavedProviders((saved.saved || []).map((item) => item.providerId));
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

  useEffect(() => {
    if (screen === "splash") return;
    const root = document.getElementById("root");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || reducedMotion) return;
    root.classList.remove("zipshift-route-enter");
    void root.offsetWidth;
    root.classList.add("zipshift-route-enter");
    const cleanup = window.setTimeout(() => root.classList.remove("zipshift-route-enter"), 360);
    return () => window.clearTimeout(cleanup);
  }, [screen]);

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
    
    const distance = parseFloat(DISTANCES[p.record_id]?.split(" ")[0] || "999");
    const matchesDistance = distance <= maxDistance;
    
    const status = getStatusLabel(p);
    const matchesOpenNow = !openNow || status.open;
    const providerZip = p.address?.match(/\b\d{5}\b/)?.[0] || "";
    const matchesZip = selectedZip === "all" || providerZip === selectedZip;
    
    return matchesSearch && matchesCat && matchesDistance && matchesOpenNow && matchesZip;
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
      const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: aorData.name || "ZipShift client", phone: aorData.phone, situation: aorData.situation, needs: aorData.needs, consent: aorData.consent, providerId: selectedProvider?.record_id, handoff: aorHandoff }) });
      const text = await response.text();
      let body: { error?: string } = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
      if (!response.ok) throw new Error(body.error || "Unable to submit the referral.");
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

  const toggleSave = (id: string) => {
    const isSaved = savedProviders.includes(id);
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
    <div className="zipshift-bottom-nav" style={{
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
            onClick={() => navigate(item.id as Screen)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 2, background: "none", border: "none",
              cursor: "pointer", color: active ? "#159d92" : subFg, fontSize: 10,
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon size={item.id === "more" ? 18 : 20} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  // ─── HAMBURGER MENU ───────────────────────────────────────────────────────
  const ClientDesktopSidebar = () => (
    <aside className={`zipshift-desktop-sidebar ${sidebarCollapsed ? "is-collapsed" : ""}`}>
      <div className="zipshift-sidebar-top"><div className="zipshift-sidebar-brand"><img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" /><span aria-hidden="true"><ShieldCheck size={22} /></span></div><button type="button" className="zipshift-sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand Navigator menu" : "Collapse Navigator menu"} title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}>{sidebarCollapsed ? "→" : "←"}</button></div>
      <div className="zipshift-sidebar-caption">NAVIGATOR</div>
      <nav>
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
          return <button key={item.dest} onClick={() => navigate(item.dest)} className={activeNavTab === item.dest || screen === item.dest ? "active" : ""} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} data-tooltip={item.label}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>{item.dest === "notifications" && notificationCount > 0 && <b className="zipshift-notification-badge" aria-label={`${notificationCount} unread notifications`}>{notificationCount > 9 ? "9+" : notificationCount}</b>}</button>;
        })}
      </nav>
      <div className="zipshift-sidebar-profile">
        <div className="zipshift-sidebar-avatar">{(clientUser || sessionUser)?.displayName?.slice(0, 1).toUpperCase() || "Z"}</div>
        <div><strong>{(clientUser || sessionUser)?.displayName || "ZipShift Client"}</strong><small>{sessionUser?.role === "admin" ? "Super administrator" : clientUser ? "Verified client" : "Create a profile"}</small></div>
        <button onClick={startProfileSignIn}>{clientUser ? "Profile" : sessionUser?.role === "admin" ? "Admin profile" : "Sign in"}</button>
      </div>
      {sessionUser?.role === "admin" && <div className="zipshift-sidebar-workspace-switcher"><span>Switch workspace</span><button onClick={() => navigate("role-portal")} title="Role portal" data-tooltip="Role portal"><ShieldCheck size={14} aria-hidden="true" /><span>Portal</span></button><button onClick={() => navigate("admin-dashboard")} title="Admin workspace" data-tooltip="Admin workspace"><Settings size={14} aria-hidden="true" /><span>Admin</span></button><button onClick={() => navigate("referrals-dispatch")} title="Website operations" data-tooltip="Website operations"><Globe2 size={14} aria-hidden="true" /><span>Website</span></button></div>}
    </aside>
  );

  const HamburgerMenu = () => (
    <>
      <ClientDesktopSidebar />
      {menuOpen && (
        <>
          <div
            className="zipshift-mobile-drawer-backdrop"
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
                <button onClick={() => setMenuOpen(false)} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 24, color: fg, lineHeight: 1,
                }}>×</button>
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
                    background: "none", border: "none", color: "#159d92", fontSize: 13, cursor: "pointer", padding: 0,
                  }}>{clientUser ? "View profile" : `${t.signIn} →`}</button>
                </div>
              </div>
              {sessionUser?.role === "admin" && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => { setMenuOpen(false); navigate("role-portal"); }} style={{ flex: 1, border: `1px solid ${borderColor}`, borderRadius: 8, background: bg, color: fg, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>Workspaces</button><button onClick={() => { setMenuOpen(false); navigate("home"); }} style={{ flex: 1, border: `1px solid ${borderColor}`, borderRadius: 8, background: bg, color: fg, padding: "8px 6px", fontSize: 12, fontWeight: 700 }}>Client view</button></div>}
            </div>
            <div style={{ padding: "8px 0" }}>
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
                <button key={item.label} onClick={() => navigate(item.dest)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  background: "none", border: "none", borderBottom: `1px solid ${borderColor}`,
                  cursor: "pointer", color: fg, fontSize: 15, width: "100%", textAlign: "left",
                }}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" style={{ width: 28 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>{item.dest === "notifications" && notificationCount > 0 && <b className="zipshift-notification-badge" aria-label={`${notificationCount} unread notifications`}>{notificationCount > 9 ? "9+" : notificationCount}</b>}
                  <span style={{ color: subFg }}>›</span>
                </button>
                );
              })}
            </div>
            <div style={{ padding: "16px" }}>
              <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.language}</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["en", "es"] as const).map((lang) => (
                  <button key={lang} onClick={() => setLanguage(lang)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `2px solid ${language === lang ? "#159d92" : borderColor}`,
                    background: language === lang ? "#eff6ff" : bg,
                    color: language === lang ? "#159d92" : fg,
                    fontWeight: language === lang ? 700 : 400, cursor: "pointer", fontSize: 14,
                  }}>{lang === "en" ? "English" : "Español"}</button>
                ))}
              </div>
              <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.accessibility}</div>
              {[
                { label: t.largeText, value: largeText, toggle: () => setLargeText(!largeText) },
                { label: t.darkMode, value: darkMode, toggle: () => setDarkMode(!darkMode) },
              ].map((opt) => (
                <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ color: fg, fontSize: 14 }}>{opt.label}</span>
                  <button onClick={opt.toggle} style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: opt.value ? "#159d92" : "#d1d5db",
                    border: "none", cursor: "pointer", position: "relative",
                  }}>
                    <div style={{
                      position: "absolute", top: 2, left: opt.value ? 22 : 2,
                      width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      transition: "left 0.2s",
                    }} />
                  </button>
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
    <div className="zipshift-client-header" style={{
      position: "sticky", top: 0, zIndex: 50,
      background: bg, borderBottom: `1px solid ${borderColor}`,
      display: "flex", alignItems: "center", padding: "12px 16px", gap: 12, minHeight: 56,
    }}>
      {showBack && (
        <button onClick={goBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#159d92", fontSize: 22, padding: 0, lineHeight: 1,
        }}>‹</button>
      )}
      <div style={{ flex: 1 }}>
        {title || <img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 32 }} />}
      </div>
      <SessionSwitcher compact />
      {showBookmark && (
        <button onClick={onBookmark} style={{
          background: "none", border: "none", cursor: "pointer", fontSize: 20, color: subFg,
        }}><Heart size={18} strokeWidth={1.8} fill={selectedProvider && savedProviders.includes(selectedProvider.record_id) ? "currentColor" : "none"} aria-hidden="true" /></button>
      )}
      <button onClick={() => setMenuOpen(true)} style={{
        background: "none", border: "none", cursor: "pointer", padding: 4,
        display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
      }}>
        <div style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
        <div style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
        <div style={{ width: 20, height: 2, background: fg, borderRadius: 1 }} />
      </button>
    </div>
  );

  // ─── FILTERS DRAWER ───────────────────────────────────────────────────────
  const FiltersDrawer = () => (
    <>
      {filtersOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }} onClick={() => setFiltersOpen(false)} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, background: bg,
            borderRadius: "16px 16px 0 0", padding: "20px 16px 100px", zIndex: 301,
            maxHeight: "85vh", overflowY: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: fg }}>{t.filters}</span>
              <button onClick={() => { setSelectedCategories([]); setMaxDistance(25); setOpenNow(false); }}
                style={{ background: "none", border: "none", color: "#159d92", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{t.reset}</button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: fg }}>{t.categories}</span>
              <button onClick={() => setSelectedCategories(CATEGORIES.map((c) => c.id))}
                style={{ background: "none", border: "none", color: "#159d92", fontSize: 13, cursor: "pointer" }}>{t.selectAll}</button>
            </div>
            {CATEGORIES.map((cat) => (
              <label key={cat.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedCategories.includes(cat.id)}
                  onChange={() => setSelectedCategories((prev) =>
                    prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id]
                  )}
                  style={{ width: 18, height: 18, accentColor: "#159d92" }} />
                <span style={{ color: fg, fontSize: 14 }}>{cat.label.replace("\n", " ")}</span>
              </label>
            ))}
            <div style={{ marginTop: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: fg }}>{t.distance}</span>
                <span style={{ color: subFg, fontSize: 13 }}>{maxDistance >= 25 ? t.anyDistance : `${maxDistance} mi`}</span>
              </div>
              <input type="range" min={1} max={25} value={maxDistance} onChange={(e) => setMaxDistance(+e.target.value)}
                style={{ width: "100%", accentColor: "#159d92" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: subFg, marginTop: 4 }}>
                <span>1 mi</span><span>5 mi</span><span>10 mi</span><span>25 mi+</span>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <input type="checkbox" checked={openNow} onChange={() => setOpenNow(!openNow)}
                style={{ width: 18, height: 18, accentColor: "#159d92" }} />
              <span style={{ color: fg, fontSize: 14 }}>{t.openNow}</span>
            </label>
            <button onClick={() => setFiltersOpen(false)} style={{
              width: "100%", padding: "14px 0", background: "#159d92", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer",
            }}>{t.applyFilters}</button>
          </div>
        </>
      )}
    </>
  );

  // ─── SPLASH ───────────────────────────────────────────────────────────────
  if (screen === "splash") {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#159d92",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <div aria-label="ZipShift" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, color: "#fff", fontSize: 28, fontWeight: 900, letterSpacing: -1 }}><ShieldCheck size={34} strokeWidth={1.7} aria-hidden="true" />ZipShift</div>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, letterSpacing: 1 }}>Navigate. Connect. Act.</p>
        <div style={{
          marginTop: 48, width: 120, height: 4, background: "rgba(255,255,255,0.2)",
          borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", background: "#fff", borderRadius: 2,
            animation: "loadbar 2s linear forwards",
          }} />
        </div>
        <style>{`@keyframes loadbar { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  if (screen === "home" && navigatorLoading) {
    return <div className="zipshift-navigator-loading" role="status" aria-live="polite" aria-label="Loading ZipShift resources">
      <div className="zipshift-loading-orbit"><span /><span /><span /></div>
      <div className="zipshift-loading-copy"><strong>Loading ZipShift Navigator</strong><span>Fetching verified resources and current availability…</span></div>
      <div className="zipshift-loading-skeleton-grid"><span /><span /><span /><span /></div>
    </div>;
  }

  // ─── HOME ─────────────────────────────────────────────────────────────────
  if (screen === "home") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header />
        <div style={{ padding: "16px" }}>
          {/* Greeting */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: fg }}>{t.goodMorning}</div>
            <div style={{ fontSize: 14, color: subFg }}>{t.howCanWeHelp}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}><button onClick={() => setScreen("guided-entry")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: 10, background: "#159d92", color: "#fff", padding: "11px 14px", fontWeight: 900, fontSize: 12, cursor: "pointer" }}><Sparkles size={15} />{language === "es" ? "Empezar aquí" : "Start here"}</button><button onClick={() => setQuickGuideOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><FileText size={15} />{language === "es" ? "Guía rápida de recursos" : "Quick resource guide"}</button><button onClick={() => setLandingConsent("privacy")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><ShieldCheck size={15} />{language === "es" ? "Privacidad y consentimiento" : "Privacy & consent"}</button><button onClick={() => setLandingConsent("research")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #b8d9d8", borderRadius: 10, background: cardBg, color: "#0f766e", padding: "10px 13px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}><ClipboardList size={15} />{language === "es" ? "Consentimiento de investigación" : "Research consent"}</button></div>
          </div>
          <section aria-labelledby="zipshift-promo-title" style={{ marginBottom: 20, overflow: "hidden", borderRadius: 16, background: "#142846", boxShadow: "0 14px 30px rgba(20,40,70,0.16)" }}>
            <video src={PROMO_VIDEO} controls muted playsInline preload="metadata" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} aria-label="ZipShift Navigator 30-second overview video" />
            <div style={{ padding: "12px 14px 14px", color: "#fff" }}><div id="zipshift-promo-title" style={{ fontWeight: 800, fontSize: 14 }}>{language === "es" ? "Conoce ZipShift Navigator" : "See ZipShift Navigator in action"}</div><div style={{ marginTop: 4, color: "#b8ece7", fontSize: 12 }}>{language === "es" ? "Recursos, acceso y coordinación en un solo lugar." : "Resources, access, and care coordination in one place."}</div></div>
          </section>
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
              style={{ flex: 1, minWidth: 180, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none" }}
            />
            <select aria-label="Filter resources by covered ZIP code" value={selectedZip} onChange={(e) => setSelectedZip(e.target.value)} style={{
              border: `1px solid ${borderColor}`, background: bg, color: fg, borderRadius: 7, padding: "7px 8px", fontSize: 12, fontWeight: 600, maxWidth: 160,
            }}>
              <option value="all">All covered ZIPs</option>
              {COVERED_ZIPS.map((zip) => <option key={zip.code} value={zip.code}>{zip.label}</option>)}
            </select>
            <button onClick={startZipSearch} style={{
              background: "none", border: "none", cursor: "pointer", color: subFg, fontSize: 16,
            }}><Search size={17} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
          <p style={{ margin: "-12px 0 18px", fontSize: 11, color: subFg }}>ZIP selections are counted in daily totals only. ZipShift does not retain your IP address, account, or search terms with this planning data.</p>
          {/* Browse by Category */}
          <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 12 }}>
            {t.browseByCategory}
          </div>
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
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5 }}>{t.nearYou}</div>
            <button onClick={() => navigate("search-results")} style={{
              background: "none", border: "none", color: "#159d92", fontSize: 13, cursor: "pointer", fontWeight: 600,
            }}>{t.viewAll}</button>
          </div>
          <div className="zipshift-nearby-list">
          {providers.slice(0, 4).map((p) => {
            const catId = getCategoryForProvider(p);
            const status = getStatusLabel(p);
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
                }}><img src={getProviderLogo(p)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} /><CategoryGlyph catId={catId} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 2 }}>
                    {p.org_name.length > 35 ? p.org_name.slice(0, 35) + "…" : p.org_name}
                  </div>
                  <div style={{ fontSize: 12, color: subFg }}>{getDistanceLabel(p)} · {p.service_category.split("/")[0].trim()}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    <span style={{ color: status.open ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {status.open ? t.open : t.closed}
                    </span>
                    {" · "}<span style={{ color: subFg }}>{status.label.replace("Open · ", "")}</span>
                  </div>
                </div>
                <span style={{ color: subFg, fontSize: 18 }}>›</span>
              </button>
            );
                    })}
          </div>
        </div>
        <BottomNav />
        {quickGuideOpen && <ClientQuickGuideModal providers={guideProviders} language={language} onClose={() => setQuickGuideOpen(false)} onOpenDirectory={() => { setQuickGuideOpen(false); navigate("county-directory"); }} />}{landingConsent && <div className="fixed inset-0 z-[450] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="landing-consent-title"><section className="w-full max-w-xl rounded-t-3xl bg-white p-6 text-[#142846] shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#159d92]">{landingConsent === "privacy" ? (language === "es" ? "Privacidad primero" : "Privacy first") : (language === "es" ? "Participación informada" : "Informed participation")}</p><h2 id="landing-consent-title" className="mt-1 text-2xl font-black">{landingConsent === "privacy" ? (language === "es" ? "Revisa la privacidad antes de continuar" : "Review privacy before continuing") : (language === "es" ? "Elige tu portal de consentimiento" : "Choose your consent portal")}</h2></div><button type="button" onClick={() => setLandingConsent(null)} className="rounded-lg border border-slate-200 p-2 text-slate-500" aria-label="Close consent popup"><X size={18} /></button></div>{landingConsent === "privacy" ? <><p className="mt-4 text-sm leading-6 text-slate-600">{language === "es" ? "ZipShift usa la información mínima necesaria para conectar a las personas con recursos. El consentimiento de servicios y el consentimiento de investigación son decisiones separadas." : "ZipShift uses the minimum information needed to connect people with resources. Service consent and research consent are separate decisions."}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => { setLandingConsent(null); navigate("privacy"); }} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">{language === "es" ? "Leer política" : "Read privacy policy"}</button><button type="button" onClick={() => routeConsentAudience(sessionUser?.role === "admin" ? "admin" : sessionUser?.role === "researcher" ? "researcher" : sessionUser?.role === "client" ? "client" : "client")} className="rounded-lg bg-[#159d92] px-4 py-2.5 text-sm font-bold text-white">{language === "es" ? "Continuar al portal" : "Continue to portal"}</button></div></> : <><p className="mt-4 text-sm leading-6 text-slate-600">{language === "es" ? "Clientes revisan las opciones en su perfil. El personal, investigadores y administradores deben entrar a su espacio protegido." : "Clients review options in their profile. Staff, researchers, and administrators enter their protected workspace."}</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => routeConsentAudience("client")} className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-left text-sm font-bold text-[#0f766e]">Client / participant<span className="mt-1 block text-xs font-normal text-slate-500">Review client consent</span></button><button type="button" onClick={() => routeConsentAudience("staff")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Care team / staff<span className="mt-1 block text-xs font-normal text-slate-500">Open staff sign-in and portal</span></button><button type="button" onClick={() => routeConsentAudience("researcher")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Researcher<span className="mt-1 block text-xs font-normal text-slate-500">Open researcher sign-in</span></button><button type="button" onClick={() => routeConsentAudience("admin")} className="rounded-lg border border-slate-200 px-4 py-3 text-left text-sm font-bold text-[#142846]">Administrator<span className="mt-1 block text-xs font-normal text-slate-500">Open protected admin access</span></button></div></>}</section></div>}
      </div>
    );
  }
  // ─── SEARCH RESULTS ───────────────────────────────────────────────────────
  if (screen === "search-results") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <FiltersDrawer />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.searchResultsTitle}</span>} showBack />
        {/* Search + filter row */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${borderColor}`, display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10,
          }}>
            <Search size={18} strokeWidth={1.8} color={subFg} aria-hidden="true" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 14, color: fg, outline: "none" }} />
          </div>
          <button onClick={() => setFiltersOpen(true)} style={{
            padding: "8px 14px", background: selectedCategories.length > 0 ? "#159d92" : cardBg,
            border: `1px solid ${selectedCategories.length > 0 ? "#159d92" : borderColor}`,
            borderRadius: 10, color: selectedCategories.length > 0 ? "#fff" : fg,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}><SlidersHorizontal size={15} aria-hidden="true" /> {t.filters}{selectedCategories.length > 0 ? ` (${selectedCategories.length})` : ""}</button>
        </div>
        {/* Results count */}
        <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: subFg }}>{filteredProviders.length} {t.results}</span>
          <button style={{ background: "none", border: "none", color: "#159d92", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            {t.sort} ›
          </button>
        </div>
        {/* Provider list */}
        <div style={{ padding: "0 16px" }}>
          {filteredProviders.map((p) => {
            const catId = getCategoryForProvider(p);
            const status = getStatusLabel(p);
            const isSaved = savedProviders.includes(p.record_id);
            return (
              <div key={p.record_id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 0", borderBottom: `1px solid ${borderColor}`,
              }}>
                <button onClick={() => openProvider(p)} style={{
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
                      <span style={{ color: status.open ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {status.open ? t.open : t.closed}
                      </span>
                      {" · "}<span style={{ color: subFg }}>{status.label.replace("Open · ", "")}</span>
                    </div>
                  </div>
                </button>
                <button onClick={() => toggleSave(p.record_id)} style={{
                  background: "none", border: "none", cursor: "pointer", fontSize: 22,
                  color: isSaved ? "#dc2626" : subFg, flexShrink: 0,
                }} aria-label={isSaved ? "Remove saved resource" : "Save resource"} aria-pressed={isSaved}><Heart size={20} fill={isSaved ? "currentColor" : "none"} strokeWidth={1.8} /></button>
              </div>
            );
          })}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── MAP ──────────────────────────────────────────────────────────────────
  if (screen === "map") {
    return (
      <div style={{ background: bg, height: "100vh", display: "flex", flexDirection: "column", fontSize, color: fg }}>
        <HamburgerMenu />
        <FiltersDrawer />
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${borderColor}`, background: bg, zIndex: 10,
        }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: fg }}>Map</span>
          <button onClick={() => setFiltersOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 20,
            fontSize: 13, color: fg, cursor: "pointer", fontWeight: 600,
          }}><SlidersHorizontal size={15} aria-hidden="true" /> {t.filters}</button>
        </div>
        {/* Map/List toggle */}
        <div style={{ display: "flex", gap: 0, padding: "8px 16px", background: bg }}>
          <button style={{
            flex: 1, padding: "8px 0", background: "#159d92", color: "#fff",
            border: "none", borderRadius: "8px 0 0 8px", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>Map</button>
          <button onClick={() => navigate("search-results")} style={{
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
          />
        </div>
        {/* Bottom info bar */}
        <div style={{
          background: bg, borderTop: `1px solid ${borderColor}`,
          padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 76,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: fg }}>
              {filteredProviders.length} {t.resources}
            </div>
            <div style={{ fontSize: 12, color: subFg }}>{t.tapToExplore}</div>
          </div>
          <button onClick={() => navigate("search-results")} style={{
            padding: "8px 16px", background: "#159d92", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>View List ›</button>
        </div>
        <BottomNav />
        {quickGuideOpen && <ClientQuickGuideModal providers={providers} language={language} onClose={() => setQuickGuideOpen(false)} onOpenDirectory={() => { setQuickGuideOpen(false); navigate("search-results"); }} />}
      </div>
    );
  }

  // ─── RESOURCE DETAIL ──────────────────────────────────────────────────────
  if (screen === "resource-detail" && selectedProvider) {
    const p = selectedProvider;
    const catId = getCategoryForProvider(p);
    const status = getStatusLabel(p);
    const isSaved = savedProviders.includes(p.record_id);
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <HamburgerMenu />
        <Header
          title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>Resource Detail</span>}
          showBack
          showBookmark
          onBookmark={() => toggleSave(p.record_id)}
        />
        <div style={{ padding: "16px" }}>
          {/* Provider header */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 12, flexShrink: 0,
              background: getCategoryColor(catId) + "20",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, overflow: "hidden",
            }}><img src={getProviderLogo(p)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5 }} /><CategoryGlyph catId={catId} /></div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: fg, margin: "0 0 4px" }}>{p.org_name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#16a34a", fontWeight: 600 }}><CheckCircle2 size={14} aria-hidden="true" /> {t.verified}</span>
              </div>
              <div style={{ fontSize: 12, color: subFg, marginTop: 4 }}>
                {p.address} · <span style={{ color: fg }}>{getDistanceLabel(p)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {p.language_access && <span style={{ borderRadius: 999, background: "#eef2ff", color: "#4338ca", padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{language === "es" ? `Idiomas: ${p.language_access}` : `Languages: ${p.language_access}`}</span>}
                {p.ada_access && <span style={{ borderRadius: 999, background: "#fff7ed", color: "#9a3412", padding: "4px 8px", fontSize: 11, fontWeight: 700 }}>{language === "es" ? `Acceso: ${p.ada_access}` : `Access: ${p.ada_access}`}</span>}
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[
              { icon: Phone, label: language === "es" ? "Llamar" : "Call", action: () => { sendFieldEvent("resource_call", p.record_id); if (p.phone) window.open(`tel:${p.phone}`); } },
              { icon: Landmark, label: language === "es" ? "Sitio web" : "Website", action: () => { sendFieldEvent("resource_website", p.record_id); if (p.website) window.open(p.website.startsWith("http") ? p.website : `https://${p.website}`, "_blank"); } },
              { icon: Navigation, label: t.directions, action: () => { sendFieldEvent("resource_directions", p.record_id); setDirectionsOpen((open) => !open); if (!userLocation && navigator.geolocation) { setLocationStatus("locating"); navigator.geolocation.getCurrentPosition((position) => { setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocationStatus("ready"); }, () => setLocationStatus("denied"), { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }); } } },
              { icon: ClipboardList, label: "Refer", action: () => navigate("referral-destination") },
              { icon: Heart, label: "Save", action: () => toggleSave(p.record_id) },
            ].map((btn) => (
              <button key={btn.label} onClick={btn.action} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 4, padding: "10px 4px", background: "#159d92", color: "#fff",
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
              { label: "Google Maps", href: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destinationText)}&travelmode=driving` },
              { label: "Apple Maps", href: `https://maps.apple.com/?${origin ? `saddr=${encodeURIComponent(origin)}&` : ""}daddr=${encodeURIComponent(destinationText)}&dirflg=d` },
              { label: "Waze", href: `https://www.waze.com/ul?ll=${encodeURIComponent(destinationText)}&navigate=yes` },
            ];
            return <div style={{ marginBottom: 20, padding: "12px 14px", background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><div><div style={{ fontWeight: 800, fontSize: 13, color: fg }}>{estimate ? `${estimate.toFixed(1)} mi · ~${Math.max(1, Math.round(estimate / 30 * 60))} min drive` : locationStatus === "locating" ? "Finding your location…" : locationStatus === "geocoding" ? "Finding that address…" : locationStatus === "denied" ? "Location permission declined — enter a ZIP or address below" : locationStatus === "error" ? "We could not find that location — check the ZIP or address" : "Allow location or enter a ZIP/address for an estimate"}</div><div style={{ fontSize: 11, color: subFg, marginTop: 3 }}>Choose a routing app</div></div><button onClick={() => setDirectionsOpen(false)} style={{ border: 0, background: "transparent", color: subFg, cursor: "pointer", fontSize: 12 }}>Close</button></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}><input value={manualLocation} onChange={(event) => { setManualLocation(event.target.value); setManualCoordinates(null); setLocationStatus("idle"); }} placeholder="ZIP code or address" aria-label="ZIP code or address" style={{ flex: "1 1 210px", minWidth: 180, border: `1px solid ${borderColor}`, borderRadius: 8, padding: "9px 10px", background: "#fff", color: fg, fontSize: 12 }} /><button onClick={async () => { const query = manualLocation.trim(); if (!query) return; setLocationStatus("geocoding"); try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`); const results = await response.json() as Array<{ lat: string; lon: string }>; const match = results[0]; if (!match) throw new Error("not-found"); setManualCoordinates({ lat: Number(match.lat), lng: Number(match.lon) }); setUserLocation(null); setLocationStatus("ready"); } catch { setLocationStatus("error"); } }} style={{ border: `1px solid ${borderColor}`, borderRadius: 8, background: "#fff", color: "#0f766e", padding: "9px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Use location</button></div><div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{routes.map((route) => <button key={route.label} onClick={() => window.open(route.href, "_blank", "noopener,noreferrer")} style={{ flex: 1, minWidth: 100, border: `1px solid ${borderColor}`, borderRadius: 8, background: "#fff", color: "#0f766e", padding: "9px 8px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{route.label}</button>)}</div></div>;
          })()}
          {/* Hours */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: cardBg, borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>{t.hours}</div>
            <div style={{ fontSize: 14, color: fg }}>{p.hours || "Mon – Fri: 8:00 AM – 5:00 PM"}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span style={{ color: status.open ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                {status.open ? t.open : t.closed}
              </span>
              {status.open && <span style={{ color: subFg }}> · Closes 5:00 PM</span>}
            </div>
          </div>
          {/* Services */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 8 }}>{t.services}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.service_category.split("/").map((s) => (
                <span key={s} style={{
                  padding: "4px 10px", background: "#eff6ff", color: "#159d92",
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
            {p.ada_access && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#16a34a", marginTop: 4 }}><Accessibility size={14} aria-hidden="true" /> {language === "es" ? `Acceso: ${p.ada_access}` : p.ada_access}</div>}
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
          {/* CTAs */}
          <button onClick={() => navigate("before-you-go")} style={{
            width: "100%", padding: "14px 0", background: "#16a34a", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 12,
          }}>{t.iNeedThisHelp}</button>
          <button onClick={() => p.phone && window.open(`tel:${p.phone}`)} style={{
            width: "100%", padding: "14px 0", background: "transparent", color: "#16a34a",
            border: "2px solid #16a34a", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer",
          }}><Phone size={17} strokeWidth={1.8} aria-hidden="true" /> {t.callToConfirm}</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── REFERRAL DESTINATION ────────────────────────────────────────────────
  if (screen === "referral-destination") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingTop: 16, paddingRight: 16, paddingBottom: 100, paddingLeft: 16 }}>
        <ReferralDestinationFlow
          providers={providers}
          initialProviderId={selectedProvider?.record_id}
          requestedService={aorData.needs[0] || selectedProvider?.service_category || ""}
          darkMode={darkMode}
          onBack={goBack}
          onConfirm={(provider, handoff) => { setSelectedProvider(provider); setAorHandoff(handoff); setAorStep(2); setScreen("gethelp"); setActiveNavTab("gethelp"); }}
        />
        <BottomNav />
      </div>
    );
  }

  // ─── BEFORE YOU GO ────────────────────────────────────────────────────────
  if (screen === "before-you-go") {
    const checklistItems = [
      { key: "photoId", label: "Photo ID (if available)", desc: "Any government-issued ID" },
      { key: "mediCal", label: "Medi-Cal card", desc: "Helps speed up services" },
      { key: "proofHomeless", label: "Proof of homelessness / housing instability", desc: "Not required, but may help" },
      { key: "referralPaper", label: "Referral paperwork (if provided)", desc: "Bring any documents you have" },
      { key: "caseManager", label: "Case manager contact (name & phone)", desc: "If you have one" },
    ];
    const whatToCheck = [
      { key: "hoursConfirmed", label: "Hours of operation", desc: "Confirm today's hours" },
      { key: "walkIn", label: "Walk-in availability", desc: "Call ahead to confirm" },
      { key: "transitPlanned", label: "Transit access", desc: "Plan your route" },
      { key: "language", label: "Language access", desc: "Ask about interpretation" },
    ];
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.beforeYouGo}</span>} showBack />
        <div style={{ padding: "16px" }}>
          <p style={{ color: subFg, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{t.beforeYouGoSubtitle}</p>
          <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 12 }}>{t.checklist}</div>
          {checklistItems.map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox"
                checked={checklist[item.key as keyof typeof checklist]}
                onChange={() => setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof checklist] }))}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: "#159d92", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>{item.label}</div>
                <div style={{ fontSize: 12, color: subFg, marginTop: 2 }}>{item.desc}</div>
              </div>
            </label>
          ))}
          <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginTop: 20, marginBottom: 12 }}>{t.whatToCheck}</div>
          {whatToCheck.map((item) => (
            <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, cursor: "pointer" }}>
              <input type="checkbox"
                checked={checklist[item.key as keyof typeof checklist]}
                onChange={() => setChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key as keyof typeof checklist] }))}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: "#159d92", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>{item.label}</div>
                <div style={{ fontSize: 12, color: subFg, marginTop: 2 }}>{item.desc}</div>
              </div>
            </label>
          ))}
          {selectedProvider && (
            <div style={{ padding: "12px 14px", background: "#f0fdf4", borderRadius: 10, marginTop: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: subFg, marginBottom: 4 }}>Check Hours</div>
              <div style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>Open now · Closes 5:00 PM</div>
            </div>
          )}
          <button onClick={() => navigate("directions")} style={{
            width: "100%", padding: "16px 0", background: "#159d92", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 12,
          }}>{t.iReadyToGo}</button>
          <button onClick={() => selectedProvider && window.open(`tel:${selectedProvider.phone}`)} style={{
            width: "100%", padding: "14px 0", background: "transparent", color: "#16a34a",
            border: "2px solid #16a34a", borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: "pointer",
          }}><Phone size={17} strokeWidth={1.8} aria-hidden="true" /> {t.callToConfirm}</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── DIRECTIONS ───────────────────────────────────────────────────────────
  if (screen === "directions") {
    const p = selectedProvider;
    const modes = [
      { id: "drive", icon: Landmark, label: "Drive", time: "18 min", detail: "6.2 mi" },
      { id: "transit", icon: BusFront, label: "Transit", time: "24 min", detail: "Route 6" },
      { id: "walk", icon: Navigation, label: "Walk", time: "42 min", detail: "1.8 mi" },
      { id: "bike", icon: Activity, label: "Bike", time: "12 min", detail: "1.8 mi" },
    ] as const;
    const transitSteps = [
      { icon: Navigation, color: "#6b7280", step: "Walk to Sisk Rd & Standiford Ave", detail: "0.4 mi · 8 min" },
      { icon: BusFront, color: "#159d92", step: "Board Route 6 (Turlock)", detail: "Sisk Rd & Standiford Ave · 9:48 AM" },
      { icon: BusFront, color: "#159d92", step: "Ride 12 stops (24 min)", detail: "Stay on until 9th St & I St" },
      { icon: Navigation, color: "#6b7280", step: "Walk to destination", detail: "0.2 mi · 3 min" },
      { icon: MapPin, color: "#16a34a", step: p ? (p.org_name.length > 35 ? p.org_name.slice(0, 35) + "…" : p.org_name) : "Destination", detail: p ? p.address : "" },
    ];
    const driveSteps = [
      { icon: Landmark, color: "#159d92", step: "Head south on your street", detail: "0.3 mi" },
      { icon: ArrowRight, color: "#6b7280", step: "Turn right onto Standiford Ave", detail: "1.2 mi" },
      { icon: ArrowLeft, color: "#6b7280", step: "Turn left onto 9th St", detail: "0.8 mi" },
      { icon: MapPin, color: "#16a34a", step: p ? (p.org_name.length > 35 ? p.org_name.slice(0, 35) + "…" : p.org_name) : "Destination", detail: p ? p.address : "" },
    ];
    const steps = dirMode === "transit" ? transitSteps : driveSteps;
    const selectedMode = modes.find((m) => m.id === dirMode) || modes[1];
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 100 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.directions}</span>} showBack />
        <div style={{ padding: "16px" }}>
          {/* From/To */}
          <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#159d92", flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: subFg }}>From</span>
              <span style={{ fontSize: 14, color: fg, fontWeight: 500 }}>{t.yourLocation}</span>
            </div>
            <div style={{ width: 2, height: 16, background: borderColor, marginLeft: 5, marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: subFg }}>To</span>
              <span style={{ fontSize: 14, color: fg, fontWeight: 500 }}>
                {p ? (p.org_name.length > 30 ? p.org_name.slice(0, 30) + "…" : p.org_name) : "Destination"}
              </span>
            </div>
          </div>
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {modes.map((mode) => (
              <button key={mode.id} onClick={() => setDirMode(mode.id)} style={{
                flex: 1, padding: "8px 4px", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 2, borderRadius: 8,
                background: dirMode === mode.id ? "#159d92" : cardBg,
                border: `1px solid ${dirMode === mode.id ? "#159d92" : borderColor}`,
                color: dirMode === mode.id ? "#fff" : fg, cursor: "pointer", fontSize: 11,
              }}>
                <mode.icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {mode.label}
              </button>
            ))}
          </div>
          {/* Time summary */}
          <div style={{
            background: "#eff6ff", borderRadius: 12, padding: "14px", marginBottom: 16,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, color: "#159d92" }}>{selectedMode.time}</div>
              <div style={{ fontSize: 13, color: subFg }}>{selectedMode.detail}</div>
            </div>
            {dirMode === "transit" && (
              <div style={{ padding: "4px 10px", background: "#dcfce7", color: "#16a34a", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                <><Accessibility size={15} aria-hidden="true" /> Accessible</>
              </div>
            )}
          </div>
          {/* Step by step */}
          <div style={{ fontWeight: 700, fontSize: 12, color: subFg, letterSpacing: 0.5, marginBottom: 12 }}>
            {t.recommendedRoute}
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: step.color + "20",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                }}><step.icon size={16} strokeWidth={1.8} aria-hidden="true" /></div>
                {i < steps.length - 1 && <div style={{ width: 2, flex: 1, background: borderColor, minHeight: 20, marginTop: 4 }} />}
              </div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: fg }}>{step.step}</div>
                <div style={{ fontSize: 12, color: subFg, marginTop: 2 }}>{step.detail}</div>
              </div>
            </div>
          ))}
          <button onClick={() => navigate("map")} style={{
            width: "100%", padding: "14px 0", background: cardBg, color: "#159d92",
            border: `2px solid #159d92`, borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8,
          }}><Map size={17} strokeWidth={1.8} aria-hidden="true" /> {t.viewOnMap}</button>
        </div>
        <BottomNav />
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
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 18, color: fg }}>{t.saved}</span>} />
        {/* Tabs */}
        <div style={{ display: "flex", padding: "12px 16px", gap: 8 }}>
          <button onClick={() => setFavTab("favorites")} style={{
            padding: "8px 20px", borderRadius: 20,
            background: favTab === "favorites" ? "#159d92" : cardBg,
            color: favTab === "favorites" ? "#fff" : fg,
            border: `1px solid ${favTab === "favorites" ? "#159d92" : borderColor}`,
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>Favorites</button>
          <button onClick={() => setFavTab("recent")} style={{
            padding: "8px 20px", borderRadius: 20,
            background: favTab === "recent" ? "#159d92" : cardBg,
            color: favTab === "recent" ? "#fff" : fg,
            border: `1px solid ${favTab === "recent" ? "#159d92" : borderColor}`,
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
              const status = getStatusLabel(p);
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
                      <span style={{ color: status.open ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {status.open ? t.open : t.closed}
                      </span>
                      <span style={{ color: subFg }}> · Closes 5:00 PM</span>
                    </div>
                  </div>
                  <Heart size={20} color="#dc2626" fill="currentColor" aria-hidden="true" />
                </button>
              );
            })
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── GET HELP (AOR INTAKE) ────────────────────────────────────────────────
  if (screen === "gethelp") {
    const aorNeeds = ["Emergency Shelter", "Food Assistance", "Medical Care", "Mental Health", "Housing", "Transportation", "Legal Help", "Employment", "Documents / ID", "Other"];
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<img onError={(event) => { event.currentTarget.style.display = "none"; }} src={AOR_LOGO} alt="AOR" style={{ height: 32 }} />} />
        <div style={{ padding: "16px" }}>
          {/* Admin & Researcher Access */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => navigate("admin-dashboard")} style={{
              flex: 1, padding: "10px 12px", background: "#1e40af", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}><UserCircle size={16} strokeWidth={1.8} aria-hidden="true" /> Admin</button>
            <button onClick={() => navigate("researcher-analytics")} style={{
              flex: 1, padding: "10px 12px", background: "#059669", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer",
            }}><Activity size={16} strokeWidth={1.8} aria-hidden="true" /> Researcher</button>
          </div>

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
              <div style={{ fontWeight: 700, fontSize: 20, color: fg, marginBottom: 8 }}>Referral Submitted!</div>
              <div style={{ fontSize: 14, color: subFg, marginBottom: 24 }}>
                Your information has been securely submitted. A case coordinator will follow up within 1-2 business days.
              </div>
              <button onClick={() => { setAorSubmitted(false); setAorStep(0); setAorData({ name: "", dob: "", phone: "", situation: "", needs: [], consent: false }); setAorHandoff(null); navigate("home"); }}
                style={{
                  padding: "14px 32px", background: "#159d92", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>Return Home</button>
            </div>
          ) : (
            <>
              {/* Step indicator */}
              <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                {[0, 1, 2].map((step) => (
                  <div key={step} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: step <= aorStep ? "#159d92" : borderColor,
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
                          background: selected ? "#159d92" : cardBg,
                          border: `1px solid ${selected ? "#159d92" : borderColor}`,
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
                      width: "100%", padding: "14px 0", background: aorData.needs.length > 0 ? "#159d92" : "#9ca3af",
                      color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: aorData.needs.length > 0 ? "pointer" : "not-allowed",
                    }}>{t.next} →</button>
                </div>
              )}

              {aorStep === 1 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 6 }}>Your Contact Information</div>
                  <div style={{ fontSize: 13, color: subFg, marginBottom: 16 }}>This helps us connect you with the right resources</div>
                  {[
                    { label: "Full Name", key: "name", placeholder: "Your name", type: "text" },
                    { label: "Date of Birth", key: "dob", placeholder: "MM/DD/YYYY", type: "text" },
                    { label: "Phone Number", key: "phone", placeholder: "(555) 000-0000", type: "tel" },
                  ].map((field) => (
                    <div key={field.key} style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: fg, marginBottom: 6 }}>{field.label}</div>
                      <input type={field.type} value={aorData[field.key as keyof typeof aorData] as string}
                        onChange={(e) => setAorData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        style={{
                          width: "100%", padding: "12px 14px", borderRadius: 10,
                          border: `1px solid ${borderColor}`, background: cardBg, color: fg,
                          fontSize: 14, boxSizing: "border-box",
                        }} />
                    </div>
                  ))}
                  <button onClick={() => navigate("referral-destination")} style={{ width: "100%", padding: "12px 14px", marginBottom: 10, background: selectedProvider ? "#e3f5f3" : cardBg, color: selectedProvider ? "#0f766e" : fg, border: `1px solid ${selectedProvider ? "#b8e5e0" : borderColor}`, borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{selectedProvider ? `Destination selected: ${selectedProvider.org_name}` : "Choose a referral destination"}</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setAorStep(0)} style={{
                      flex: 1, padding: "14px 0", background: cardBg, color: fg,
                      border: `1px solid ${borderColor}`, borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer",
                    }}>{t.back}</button>
                    <button onClick={() => setAorStep(2)} style={{
                      flex: 2, padding: "14px 0", background: "#159d92", color: "#fff",
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
                        <span key={n} style={{ padding: "4px 10px", background: "#eff6ff", color: "#159d92", borderRadius: 20, fontSize: 12 }}>{n}</span>
                      ))}
                    </div>
                  </div>
                  {aorData.name && (
                    <div style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "14px", marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: subFg, marginBottom: 8 }}>CONTACT INFO</div>
                      {aorData.name && <div style={{ fontSize: 14, color: fg, marginBottom: 4 }}>Name: {aorData.name}</div>}
                      {aorData.dob && <div style={{ fontSize: 14, color: fg, marginBottom: 4 }}>DOB: {aorData.dob}</div>}
                      {aorData.phone && <div style={{ fontSize: 14, color: fg }}>Phone: {aorData.phone}</div>}
                    </div>
                  )}
                  {selectedProvider && <div style={{ background: "#e3f5f3", border: "1px solid #b8e5e0", borderRadius: 12, padding: "14px", marginBottom: 16 }}><div style={{ fontWeight: 800, fontSize: 13, color: "#0f766e", marginBottom: 6 }}>REFERRAL DESTINATION</div><div style={{ fontSize: 15, fontWeight: 800, color: fg }}>{selectedProvider.org_name}</div><div style={{ marginTop: 4, fontSize: 13, color: subFg }}>{selectedProvider.program_name} · {selectedProvider.city}</div>{aorHandoff && <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #b8e5e0", fontSize: 12, color: "#0f766e" }}><strong>Handoff:</strong> {aorHandoff.outcome.replace(/-/g, " ")} · Documents: {aorHandoff.documentBurden} · Transit: {aorHandoff.transitFeasibility}</div>}<button onClick={() => navigate("referral-destination")} style={{ marginTop: 10, border: 0, background: "transparent", color: "#0f766e", fontWeight: 800, fontSize: 12, padding: 0 }}>Change selection</button></div>}
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer" }}>
                    <input type="checkbox" checked={aorData.consent}
                      onChange={() => setAorData((prev) => ({ ...prev, consent: !prev.consent }))}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: "#159d92", flexShrink: 0 }} />
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
        <BottomNav />
      </div>
    );
  }

  // ─── MORE / PROFILE ───────────────────────────────────────────────────────
  if (screen === "more") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<img onError={(event) => { event.currentTarget.style.display = "none"; }} src={ZIPSHIFT_LOGO} alt="ZipShift" style={{ height: 28 }} />} />
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
              padding: "10px 24px", background: "#159d92", color: "#fff",
              border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}>{clientUser ? "View Profile" : t.signIn}</button>
          </div>
          {[
            { icon: UsersRound, label: "Workspaces", dest: "role-portal" as Screen },
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
                <button key={lang} onClick={() => setLanguage(lang)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8,
                  border: `2px solid ${language === lang ? "#159d92" : borderColor}`,
                  background: language === lang ? "#eff6ff" : bg,
                  color: language === lang ? "#159d92" : fg,
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
            ].map((opt) => (
              <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: fg, fontSize: 14 }}>{opt.label}</span>
                <button onClick={opt.toggle} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: opt.value ? "#159d92" : "#d1d5db",
                  border: "none", cursor: "pointer", position: "relative",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: opt.value ? 22 : 2,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── ABOUT ────────────────────────────────────────────────────────────────
  if (screen === "about") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.aboutApp}</span>} showBack />
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
            width: "100%", padding: "14px 0", background: "#159d92", color: "#fff",
            border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
          }}><MessageSquare size={17} strokeWidth={1.8} aria-hidden="true" /> Send Feedback</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── FEEDBACK ─────────────────────────────────────────────────────────────
  if (screen === "feedback") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.feedback}</span>} showBack />
        <div style={{ padding: "20px 16px" }}>
          {feedbackSubmitted ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ width: 64, height: 64, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: "#e3f5f3", color: "#0f766e" }}><CheckCircle2 size={36} strokeWidth={1.8} aria-hidden="true" /></div>
              <div style={{ fontWeight: 700, fontSize: 20, color: fg, marginBottom: 8 }}>Thank You!</div>
              <div style={{ fontSize: 14, color: subFg, marginBottom: 24 }}>Your feedback helps us improve ZipShift for everyone.</div>
              <button onClick={() => { setFeedbackSubmitted(false); setFeedbackAccess(null); setFeedbackBarriers([]); setFeedbackText(""); setFeedbackError(""); navigate("home"); }}
                style={{
                  padding: "14px 32px", background: "#159d92", color: "#fff",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer",
                }}>Return Home</button>
            </div>
          ) : (
            <>
              {feedbackError && <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid #fecaca", borderRadius: 9, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>{feedbackError}</div>}
              <div style={{ fontWeight: 700, fontSize: 17, color: fg, marginBottom: 8 }}>Was this easy to access?</div>
              <div style={{ color: subFg, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>Your feedback helps identify access barriers and improve services for everyone.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[{ value: "easy" as const, label: "Easy", detail: "I was able to get what I needed" }, { value: "not_easy" as const, label: "Not easy", detail: "I had trouble accessing this" }].map((choice) => <button key={choice.value} onClick={() => { setFeedbackAccess(choice.value); setFeedbackError(""); }} style={{ textAlign: "left", padding: 14, background: feedbackAccess === choice.value ? "#e3f5f3" : cardBg, border: `2px solid ${feedbackAccess === choice.value ? "#159d92" : borderColor}`, borderRadius: 11, color: fg, cursor: "pointer" }}><span style={{ display: "block", fontWeight: 800, fontSize: 15 }}>{choice.label}</span><span style={{ display: "block", marginTop: 5, fontSize: 12, color: subFg, lineHeight: 1.4 }}>{choice.detail}</span></button>)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: fg, marginBottom: 8 }}>What made it difficult? <span style={{ fontWeight: 400, color: subFg }}>(select all that apply)</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{["Documents", "Language", "Transit", "Hours", "Wrong information"].map((barrier) => { const active = feedbackBarriers.includes(barrier); return <button key={barrier} onClick={() => setFeedbackBarriers((current) => active ? current.filter((item) => item !== barrier) : [...current, barrier])} style={{ padding: "9px 11px", border: `1px solid ${active ? "#159d92" : borderColor}`, borderRadius: 9, background: active ? "#e3f5f3" : cardBg, color: active ? "#0f766e" : fg, fontSize: 12, fontWeight: active ? 800 : 600 }}>{barrier}</button>; })}</div>
              <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Tell us more (optional)" style={{ width: "100%", minHeight: 100, padding: "12px", borderRadius: 10, border: `1px solid ${borderColor}`, background: cardBg, color: fg, fontSize: 14, resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={async () => { if (!feedbackAccess || (!feedbackBarriers.length && !feedbackText.trim())) { setFeedbackError("Choose an access outcome and add a barrier or note."); return; } try { const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ accessRating: feedbackAccess, barriers: feedbackBarriers, narrative: feedbackText }) }); const body = await response.json(); if (!response.ok) throw new Error(body?.error || "Unable to submit feedback."); setFeedbackSubmitted(true); } catch (error) { setFeedbackError(error instanceof Error ? error.message : "Unable to submit feedback."); } }} style={{ marginTop: 16, width: "100%", padding: "14px 0", background: "#159d92", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Submit access feedback</button>
            </>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── PRIVACY ──────────────────────────────────────────────────────────────
  if (screen === "privacy") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.privacy}</span>} showBack />
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
        <BottomNav />
      </div>
    );
  }

  // ─── TERMS ────────────────────────────────────────────────────────────────
  if (screen === "terms") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>{t.terms}</span>} showBack />
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
        <BottomNav />
      </div>
    );
  }

  // ─── SETTINGS (fallback) ──────────────────────────────────────────────────
  if (screen === "settings") {
    return (
      <div style={{ background: bg, minHeight: "100vh", fontSize, color: fg, paddingBottom: 80 }}>
        <HamburgerMenu />
        <Header title={<span style={{ fontWeight: 700, fontSize: 16, color: fg }}>Settings</span>} showBack />
        <div style={{ padding: "16px" }}>
          <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.language}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {(["en", "es"] as const).map((lang) => (
              <button key={lang} onClick={() => setLanguage(lang)} style={{
                flex: 1, padding: "10px 0", borderRadius: 8,
                border: `2px solid ${language === lang ? "#159d92" : borderColor}`,
                background: language === lang ? "#eff6ff" : bg,
                color: language === lang ? "#159d92" : fg,
                fontWeight: language === lang ? 700 : 400, cursor: "pointer", fontSize: 14,
              }}>{lang === "en" ? "English" : "Español"}</button>
            ))}
          </div>
          <div style={{ color: subFg, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{t.accessibility}</div>
          {[
            { label: t.largeText, value: largeText, toggle: () => setLargeText(!largeText) },
            { label: t.darkMode, value: darkMode, toggle: () => setDarkMode(!darkMode) },
          ].map((opt) => (
            <div key={opt.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ color: fg, fontSize: 15 }}>{opt.label}</span>
              <button onClick={opt.toggle} style={{
                width: 44, height: 24, borderRadius: 12,
                background: opt.value ? "#159d92" : "#d1d5db",
                border: "none", cursor: "pointer", position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: opt.value ? 22 : 2,
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s",
                }} />
              </button>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  if (screen === "guided-entry") {
    return <GuidedAccess providers={providers} language={language} onBack={() => setScreen("home")} onOpenProvider={(provider) => { openProvider(provider as Provider); }} onOpenDirectory={() => setScreen("county-directory")} onFieldEvent={(eventType) => sendFieldEvent(eventType, undefined, { language })} />;
  }

  // Intake Form Screen
  if (screen === "intake-form") {
    return (
      <IntakeFormFlow
        onBack={() => setScreen("gethelp")}
        onSubmit={(data) => {
          console.log("Intake form submitted:", data);
          alert("Thank you! Your intake form has been submitted.");
          setScreen("home");
        }}
      />
    );
  }

  // Admin Dashboard Screen
  if (screen === "admin-dashboard") {
    return (
      <AdminDashboard
        onBack={() => setScreen("home")}
        onSessionChange={handleWorkspaceSession}
      />
    );
  }

  // Researcher Analytics Screen
  if (screen === "researcher-analytics") {
    return (
      <ResearcherAnalytics
        onBack={() => setScreen("home")}
        onSessionChange={handleWorkspaceSession}
      />
    );
  }

  if (screen === "role-portal") {
    return <RolePortal user={sessionUser} onNavigate={(destination) => setScreen(destination as Screen)} />;
  }
  if (screen === "staff-intake") {
    return <StaffIntakeFlow onBack={() => setScreen("role-portal")} onComplete={() => setScreen("referrals-dispatch")} />;
  }
  if (screen === "referrals-dispatch") {
    return <ReferralsDispatch onBack={() => setScreen("role-portal")} onNewReferral={() => setScreen("staff-intake")} onNotifications={() => setScreen("notifications")} />;
  }
  if (screen === "care-coordination") {
    return <CareCoordinationPortal onBack={() => setScreen("role-portal")} />;
  }
  if (screen === "specialist-dashboard") {
    return <SpecialistDashboard onBack={() => setScreen("role-portal")} onOpenPortal={() => setScreen("care-coordination")} />;
  }
  if (screen === "client-profile") {
    return (
      <ClientProfile
        providers={providers}
        onBack={() => setScreen("more")}
        onSessionChange={handleClientSession}
      />
    );
  }

  if (screen === "client-directory") {
    return <ClientDirectory onBack={() => setScreen("more")} />;
  }
  if (screen === "emergency-directory") {
    return <EmergencyResourceDirectory language={language} onBack={() => setScreen("more")} />;
  }
  if (screen === "county-directory") {
    return <CountyResourceDirectory language={language} onBack={() => setScreen("more")} />;
  }
  if (screen === "notifications") {
    return (
      <NotificationCenter
        onBack={() => setScreen("more")}
        onProfile={() => setScreen("client-profile")}
        onHelp={() => setScreen("gethelp")}
        onRead={() => setNotificationCount((count) => Math.max(0, count - 1))}
      />
    );
  }
  // Referral History Screen
  if (screen === "referral-history") {
    return (
      <ReferralHistory
        onBack={() => setScreen("more")}
      />
    );
  }

  return null;
}
