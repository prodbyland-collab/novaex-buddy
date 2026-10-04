import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      assuranceError ||
      !assurance ||
      (data.user.factors?.some((f) => f.status === "verified") && assurance.currentLevel !== "aal2")
    )
      throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
