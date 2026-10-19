export const CLIENT_SCREEN_COVERAGE = [
  { id: "home", label: "Home", sourceState: "Client workspace entry", selector: "bottom-nav" },
  { id: "map", label: "Map Search", sourceState: "Find help nearby", selector: "sidebar+bottom-nav" },
  { id: "favorites", label: "Favorites", sourceState: "Saved resources", selector: "sidebar+bottom-nav" },
  { id: "gethelp", label: "Get Help", sourceState: "Connect to ZipShift", selector: "sidebar+bottom-nav" },
  { id: "more", label: "More", sourceState: "Additional client tools", selector: "bottom-nav" },
  { id: "search-results", label: "Search Results", sourceState: "Search submission", selector: "home-search" },
  { id: "resource-detail", label: "Resource Detail", sourceState: "Provider selection", selector: "directory+search" },
  { id: "referral-destination", label: "Referral Destination", sourceState: "AOR Step 8 destination selection", selector: "resource-detail+get-help" },
  { id: "before-you-go", label: "Before You Go", sourceState: "Visit preparation", selector: "resource-detail" },
  { id: "directions", label: "Directions", sourceState: "Route planning", selector: "resource-detail" },
  { id: "intake-form", label: "Intake", sourceState: "Connect to ZipShift workflow", selector: "sidebar+get-help" },
  { id: "client-directory", label: "Full Directory", sourceState: "Verified directory", selector: "sidebar+more" },
  { id: "notifications", label: "Notifications", sourceState: "Client updates empty state", selector: "sidebar+mobile-menu" },
  { id: "client-profile", label: "Profile", sourceState: "Client profile", selector: "sidebar+more+mobile-menu" },
  { id: "referral-history", label: "Referral History", sourceState: "Client follow-up", selector: "profile+more" },
  { id: "feedback", label: "Feedback", sourceState: "Support link", selector: "menu" },
  { id: "about", label: "About ZipShift", sourceState: "Support link", selector: "menu" },
  { id: "privacy", label: "Privacy Policy", sourceState: "Support link", selector: "menu" },
  { id: "terms", label: "Terms of Use", sourceState: "Support link", selector: "menu" },
  { id: "settings", label: "Settings", sourceState: "Accessibility and language", selector: "more" },
] as const;

export const FIGMA_PRIMARY_CLIENT_PAGES = [
  "home", "search-results", "map", "resource-detail", "before-you-go",
  "directions", "gethelp", "favorites", "client-profile", "referral-history",
] as const;

export const STAFF_SCREEN_COVERAGE = [
  { id: "role-portal", label: "Role Portal", sourceState: "Authorized workspace selection" },
  { id: "staff-intake", label: "Staff Intake", sourceState: "Connect to ZipShift handoff" },
  { id: "referrals-dispatch", label: "Referrals Dispatch", sourceState: "Live staff referral queue" },
] as const;

export const CLIENT_SELECTOR_DESTINATIONS = {
  desktop: ["map", "favorites", "intake-form", "gethelp", "client-directory", "notifications", "client-profile"],
  mobileMenu: ["notifications", "client-profile", "gethelp", "feedback", "about", "privacy", "terms"],
  bottomNav: ["home", "map", "favorites", "gethelp", "more"],
} as const;

export type ClientScreenId = (typeof CLIENT_SCREEN_COVERAGE)[number]["id"];

export function hasClientScreen(id: string): id is ClientScreenId {
  return CLIENT_SCREEN_COVERAGE.some((screen) => screen.id === id);
}
