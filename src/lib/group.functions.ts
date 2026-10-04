import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";
import { validateNews } from "@/lib/group";

export const getGroupFeed = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const [posts, role] = await Promise.all([
      context.supabase
        .from("group_announcements")
        .select("id, kind, body, code, code_date, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (posts.error) throw new Error("Could not load the group. Please try again later.");
    return { posts: posts.data ?? [], isAdmin: !role.error && role.data === true };
  });

export const publishGroupNews = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(validateNews)
  .handler(async ({ data, context }) => {
    const { publishAdministratorNews } = await import("@/lib/group.server");
    return publishAdministratorNews({ ...context, input: data }, async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return supabaseAdmin;
    });
  });
