import StaffWorkspace from "./StaffWorkspace";

interface AdminDashboardProps {
  onBack: () => void;
  onSessionChange?: (user: { id: string; email: string; displayName: string; role: "admin" | "researcher" | "client" } | null) => void;
}

export default function AdminDashboard({ onBack, onSessionChange }: AdminDashboardProps) {
  return <StaffWorkspace role="admin" onBack={onBack} onSessionChange={onSessionChange} />;
}
