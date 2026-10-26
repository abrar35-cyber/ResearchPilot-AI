import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function HomePage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
