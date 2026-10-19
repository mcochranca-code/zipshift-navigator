import StaffWorkspace from "./StaffWorkspace";

interface ResearcherAnalyticsProps {
  onBack: () => void;
  onSessionChange?: (user: { id: string; email: string; displayName: string; role: "admin" | "researcher" | "client" } | null) => void;
}

export default function ResearcherAnalytics({ onBack, onSessionChange }: ResearcherAnalyticsProps) {
  return <StaffWorkspace role="researcher" onBack={onBack} onSessionChange={onSessionChange} />;
}

