import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";
import { assetSymbol } from "./account.functions";
import { paymentSchema } from "./payment";
import { getBotPlan } from "./plans";
import { fetchAllRows } from "./pagination";

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
const userId = z.string().uuid();
const symbol = assetSymbol.default("USD");
const totalsSchema = z.object({
  users: z.number(),
  usd: z.number(),
  deposits: z.number(),
  depositedUsd: z.number(),
  withdrawals: z.number(),
  withdrawnUsd: z.number(),
  aiOn: z.number(),
});

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const allUsers: User[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load users");
      allUsers.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const [holdingRows, settingRows, referralRows, roleRows, deposits, withdrawals, code, totals] =
      await Promise.all([
        fetchAllRows((from, to) =>
          admin.from("holdings").select("user_id,symbol,amount").order("id").range(from, to),
        ),
        fetchAllRows((from, to) =>
          admin.from("ai_trading_settings").select("*").order("id").range(from, to),
        ),
        fetchAllRows((from, to) =>
          admin.from("referrals").select("referrer_id").order("id").range(from, to),
        ),
        fetchAllRows((from, to) =>
          admin.from("user_roles").select("user_id,role").order("id").range(from, to),
        ),
        admin
          .from("crypto_deposits")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        admin.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("daily_ai_codes").select("*").order("code_date", { ascending: false }).limit(1),
        admin.rpc("admin_account_totals"),
      ]);
    for (const result of [deposits, withdrawals, code, totals])
      if (result.error) throw new Error("Could not load administrator data");
    const users = allUsers.map((u) => {
      const own = holdingRows.filter((h) => h.user_id === u.id);
      const setting = settingRows.find((s) => s.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        usd: Number(own.find((h) => h.symbol === "USD")?.amount ?? 0),
        assets: own
          .filter((h) => h.symbol !== "USD" && Number(h.amount) > 0)
          .map((h) => ({ symbol: h.symbol, amount: Number(h.amount) })),
        planId: setting?.plan_id ?? "free",
        planRate: Number(setting?.plan_rate ?? 0.01),
        aiEnabled: setting?.enabled ?? false,
        totalProfit: Number(setting?.total_profit ?? 0),
        lastPayout: setting?.last_payout_date ?? null,
        boostDate: setting?.boost_date ?? null,
        isAdmin: roleRows.some((r) => r.user_id === u.id && r.role === "admin"),
        referrals: referralRows.filter((r) => r.referrer_id === u.id).length,
      };
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    return {
      users,
      deposits: (deposits.data ?? []).map((r) => ({
        ...r,
        email: emailById.get(r.user_id) ?? r.user_id,
      })),
      withdrawals: (withdrawals.data ?? []).map((r) => ({
        ...r,
        email: emailById.get(r.user_id) ?? r.user_id,
      })),
      dailyCode: code.data?.[0] ?? null,
      totals: totalsSchema.parse(totals.data),
    };
  });

export const adminSetBalance = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, symbol, amount: z.number().finite().nonnegative().max(1e12) }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin.rpc("admin_change_balance", {
      p_user_id: data.userId,
      p_symbol: data.symbol,
      p_value: data.amount,
      p_replace: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(
    z.object({
      userId,
      symbol,
      delta: z
        .number()
        .finite()
        .min(-1e12)
        .max(1e12)
        .refine((v) => v !== 0),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: amount, error } = await admin.rpc("admin_change_balance", {
      p_user_id: data.userId,
      p_symbol: data.symbol,
      p_value: data.delta,
      p_replace: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true, amount };
  });
export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, planId: z.enum(["free", "pro", "elite"]), enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const plan = getBotPlan(data.planId);
    if (!plan) throw new Error("Unknown plan");
    const { error } = await admin
      .from("ai_trading_settings")
      .upsert(
        { user_id: data.userId, plan_id: plan.id, plan_rate: plan.rate, enabled: data.enabled },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const adminUpdateDeposit = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ depositId: z.string().uuid(), action: z.enum(["approve", "reject"]) }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: row, error } = await admin
      .from("crypto_deposits")
      .select("*")
      .eq("id", data.depositId)
      .single();
    if (error || !row) throw new Error("Deposit not found");
    if (row.credited_at) throw new Error("A credited deposit cannot be changed");
    if (data.action === "reject") {
      const { error: writeError } = await admin
        .from("crypto_deposits")
        .update({ status: "failed" })
        .eq("id", row.id)
        .is("credited_at", null);
      if (writeError) throw new Error(writeError.message);
      return { ok: true };
    }
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey || !row.payment_id) throw new Error("Payment lookup is unavailable");
    const response = await fetch(
      "https://api.nowpayments.io/v1/payment/" + encodeURIComponent(row.payment_id),
      { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error("Could not verify payment");
    const payment = paymentSchema.parse(await response.json());
    if (
      payment.payment_id !== row.payment_id ||
      payment.payment_status !== "finished" ||
      payment.actually_paid < Number(row.pay_amount ?? Infinity)
    )
      throw new Error("Payment is not fully settled");
    const { error: creditError } = await admin.rpc("credit_crypto_deposit", {
      p_payment_id: payment.payment_id,
      p_status: payment.payment_status,
      p_actually_paid: payment.actually_paid,
    });
    if (creditError) throw new Error(creditError.message);
    return { ok: true };
  });
export const adminUpdateWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(
    z.object({
      withdrawalId: z.string().uuid(),
      status: z.enum(["pending", "completed", "failed"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin.rpc("admin_change_withdrawal", {
      p_id: data.withdrawalId,
      p_status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const adminRotateDailyCode = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data, error } = await admin.rpc("rotate_daily_group_code");
    if (error) throw new Error(error.message);
    return { code: data };
  });
export const adminRunPayout = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data, error } = await admin.rpc("run_daily_ai_trading_payout");
    if (error) throw new Error(error.message);
    return { paid: Number(data ?? 0) };
  });
export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, makeAdmin: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin)
      throw new Error("You cannot remove your own admin access");
    const result = data.makeAdmin
      ? await admin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" })
      : await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });
export const adminSetBoost = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, grant: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { error } = await admin.from("ai_trading_settings").upsert(
      {
        user_id: data.userId,
        boost_date: data.grant ? new Date().toISOString().slice(0, 10) : null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
