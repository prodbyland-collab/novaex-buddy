import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PortfolioProvider } from "@/lib/portfolio";
import AppLayout from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const { user } = useAuth();
  return (
    <PortfolioProvider user={user}>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </PortfolioProvider>
  );
}
