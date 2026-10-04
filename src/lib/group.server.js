import { validateNews } from "./group.js";

export async function publishAdministratorNews(context, loadAdmin) {
  const { data: allowed, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || allowed !== true) throw new Error("Forbidden");
  const data = validateNews(context.input);
  const admin = await loadAdmin();
  const { error: writeError } = await admin
    .from("group_announcements")
    .insert({ kind: "news", body: data.body, author_id: context.userId });
  if (writeError) throw new Error("Could not publish the news. Please try again.");
  return { ok: true };
}
