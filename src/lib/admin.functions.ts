import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);

    const [usersRes, holdings, settings, deposits, withdrawals, referrals, code, roles] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      admin.from("holdings").select("user_id, symbol, amount"),
      admin.from("ai_trading_settings").select("*"),
      admin.from("crypto_deposits").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("referrals").select("referrer_id"),
      admin.from("daily_ai_codes").select("*").order("code_date", { ascending: false }).limit(1),
      admin.from("user_roles").select("user_id, role"),
    ]);

    const holdingRows = holdings.data ?? [];
    const settingRows = settings.data ?? [];
    const referralRows = referrals.data ?? [];
    const roleRows = roles.data ?? [];

    const users = (usersRes.data?.users ?? []).map((u) => {
      const own = holdingRows.filter((h: any) => h.user_id === u.id);
      const setting = settingRows.find((s: any) => s.user_id === u.id) ?? null;
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        usd: Number(own.find((h: any) => h.symbol === "USD")?.amount ?? 0),
        assets: own
          .filter((h: any) => h.symbol !== "USD" && Number(h.amount) > 0)
          .map((h: any) => ({ symbol: h.symbol, amount: Number(h.amount) })),
        planId: setting?.plan_id ?? "free",
        planRate: Number(setting?.plan_rate ?? 0.01),
        aiEnabled: setting?.enabled ?? true,
        totalProfit: Number(setting?.total_profit ?? 0),
        lastPayout: setting?.last_payout_date ?? null,
        boostDate: setting?.boost_date ?? null,
        isAdmin: roleRows.some((r: any) => r.user_id === u.id && r.role === "admin"),
        referrals: referralRows.filter((r: any) => r.referrer_id === u.id).length,
      };
    });

    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const withEmail = (rows: any[] | null) =>
      (rows ?? []).map((r) => ({ ...r, email: emailById.get(r.user_id) ?? r.user_id }));

    return {
      users,
      deposits: withEmail(deposits.data),
      withdrawals: withEmail(withdrawals.data),
      dailyCode: code.data?.[0] ?? null,
      totals: {
        users: users.length,
        usd: users.reduce((sum, u) => sum + u.usd, 0),
        deposits: (deposits.data ?? []).filter((d: any) => d.credited_at).length,
        depositedUsd: (deposits.data ?? [])
          .filter((d: any) => d.credited_at)
          .reduce((sum: number, d: any) => sum + Number(d.price_amount ?? 0), 0),
        withdrawals: (withdrawals.data ?? []).length,
        withdrawnUsd: (withdrawals.data ?? [])
          .filter((w: any) => w.status !== "failed")
          .reduce((sum: number, w: any) => sum + Number(w.usd_value ?? 0), 0),
        aiOn: users.filter((u) => u.aiEnabled).length,
      },
    };
  });

export const adminSetBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; symbol?: string; amount: number }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const symbol = (data.symbol ?? "USD").toUpperCase();
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount");
    const { error } = await admin
      .from("holdings")
      .upsert({ user_id: data.userId, symbol, amount }, { onConflict: "user_id,symbol" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; planId: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { getBotPlan } = await import("@/lib/plans");
    const plan = getBotPlan(data.planId);
    if (!plan) throw new Error("Unknown plan");
    const { error } = await admin.from("ai_trading_settings").upsert(
      {
        user_id: data.userId,
        plan_id: plan.id,
        plan_rate: plan.rate,
        enabled: data.enabled,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { depositId: string; action: "approve" | "reject" }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: row, error } = await admin
      .from("crypto_deposits")
      .select("*")
      .eq("id", data.depositId)
      .maybeSingle();
    if (error || !row) throw new Error("Deposit not found");

    if (data.action === "reject") {
      await admin.from("crypto_deposits").update({ status: "failed" }).eq("id", row.id);
      return { ok: true };
    }

    if (!row.payment_id) throw new Error("This deposit has no payment id yet");
    const { error: rpcError } = await admin.rpc("credit_crypto_deposit", {
      p_payment_id: row.payment_id,
      p_status: "finished",
      p_actually_paid: Number(row.pay_amount ?? 0),
    });
    if (rpcError) throw new Error(rpcError.message);
    return { ok: true };
  });

export const adminUpdateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { withdrawalId: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin
      .from("withdrawals")
      .update({ status: data.status })
      .eq("id", data.withdrawalId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRotateDailyCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("daily_ai_codes").delete().eq("code_date", today);
    const { data, error } = await admin.rpc("ensure_daily_ai_code");
    if (error) throw new Error(error.message);
    return { code: data as string };
  });

export const adminRunPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data, error } = await admin.rpc("run_daily_ai_trading_payout");
    if (error) throw new Error(error.message);
    return { paid: Number(data ?? 0) };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; symbol?: string; delta: number }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const symbol = (data.symbol ?? "USD").toUpperCase();
    const delta = Number(data.delta);
    if (!Number.isFinite(delta) || delta === 0) throw new Error("Invalid amount");
    const { data: row } = await admin
      .from("holdings")
      .select("amount")
      .eq("user_id", data.userId)
      .eq("symbol", symbol)
      .maybeSingle();
    const next = Math.max(Number(row?.amount ?? 0) + delta, 0);
    const { error } = await admin
      .from("holdings")
      .upsert({ user_id: data.userId, symbol, amount: next }, { onConflict: "user_id,symbol" });
    if (error) throw new Error(error.message);
    return { ok: true, amount: next };
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; makeAdmin: boolean }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin access");
    }
    if (data.makeAdmin) {
      const { error } = await admin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminSetBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; grant: boolean }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin
      .from("ai_trading_settings")
      .upsert(
        { user_id: data.userId, boost_date: data.grant ? today : null },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
