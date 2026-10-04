import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database";
import type { Json } from "@/integrations/supabase/types";

export async function performAdminAction(
  admin: SupabaseClient<Database>,
  actor: string,
  action: string,
  target: string | null = null,
  details: Json = {},
) {
  const { data, error } = await admin.rpc("perform_admin_action", {
    p_actor: actor,
    p_action: action,
    p_target: target,
    p_details: details,
  });
  if (error) throw new Error(error.message);
  return data as { ok: true; amount?: number; code?: string; paid?: number };
}

export async function auditAuthAction(
  admin: SupabaseClient<Database>,
  actor: string,
  target: string,
  action: string,
  operation: () => Promise<unknown>,
) {
  const { data: id, error } = await admin.rpc("begin_admin_auth_action", {
    p_actor: actor,
    p_target: target,
    p_action: action,
  });
  if (error || !id) throw new Error(error?.message ?? "Could not create audit intent");
  try {
    await operation();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Auth provider operation failed";
    const { error: logError } = await admin.rpc("finish_admin_auth_action", {
      p_id: id,
      p_success: false,
      p_error: message,
    });
    if (logError) console.error("Could not finalize failed admin audit", id, logError.code);
    throw cause;
  }
  const { error: logError } = await admin.rpc("finish_admin_auth_action", {
    p_id: id,
    p_success: true,
  });
  if (logError)
    throw new Error(
      "Account change succeeded, but audit finalization failed. Refresh before making another change.",
    );
  return { ok: true };
}
