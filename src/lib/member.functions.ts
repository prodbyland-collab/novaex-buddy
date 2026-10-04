import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";

export const getMemberOverview = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const [settings, codes, deposits, withdrawals] = await Promise.all([
      context.supabase
        .from("ai_trading_settings")
        .select("enabled,plan_id,last_payout_date,total_profit")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("group_announcements")
        .select("id,kind,code,code_date,expires_at")
        .eq("kind", "code")
        .order("created_at", { ascending: false })
        .limit(1),
      context.supabase
        .from("crypto_deposits")
        .select("id,status,purpose,price_amount,created_at,credited_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("withdrawals")
        .select("id,status,symbol,amount,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    for (const result of [settings, codes, deposits, withdrawals])
      if (result.error) throw new Error("Could not load account activity. Please retry.");
    return {
      settings: settings.data,
      code: codes.data?.[0] ?? null,
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
    };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase
      .from("member_notifications")
      .select("id,kind,details,created_at,expires_at")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (result.error) throw new Error("Could not load notifications. Please retry.");
    const ids = (result.data ?? []).map((row) => row.id);
    if (!ids.length) return [];
    const reads = await context.supabase
      .from("notification_reads")
      .select("notification_id,read_at")
      .eq("user_id", context.userId)
      .in("notification_id", ids);
    if (reads.error) throw new Error("Could not load notifications. Please retry.");
    return (result.data ?? []).map((row) => ({
      ...row,
      notification_reads: (reads.data ?? []).filter((read) => read.notification_id === row.id),
    }));
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("mark_notifications_read", {});
    if (error) throw new Error("Could not mark notifications as read. Please retry.");
    return { ok: true };
  });
