import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Optional secured scheduler hook. The database also schedules publication.
export const Route = createFileRoute("/api/public/hooks/daily-ai-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rejected = await authenticateCronRequest(request);
        if (rejected) return rejected;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("publish_daily_group_code");
        if (error) {
          console.error("Daily group code publication failed", error);
          return json({ error: "Could not publish the daily code" }, 500);
        }
        return json({ ok: true, announcementId: data, skipped: !data });
      },
    },
  },
});
