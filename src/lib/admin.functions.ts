import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";
import { assetSymbol } from "./account.functions";
import { paymentSchema } from "./payment";
import { fetchAllRows } from "./pagination";
import { changeAccountAccess } from "./admin-tools";

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
async function audited(
  admin: SupabaseClient<Database>,
  actor: string,
  action: string,
  target: string | null = null,
  details: import("@/integrations/supabase/types").Json = {},
) {
  const { performAdminAction } = await import("./admin-audit.server");
  return performAdminAction(admin, actor, action, target, details);
}
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
    const [
      holdingRows,
      settingRows,
      referralRows,
      roleRows,
      deposits,
      withdrawals,
      code,
      totals,
      announcements,
    ] = await Promise.all([
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
      fetchAllRows((from, to) =>
        admin
          .from("crypto_deposits")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        admin
          .from("withdrawals")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      ),
      admin.from("daily_ai_codes").select("*").order("code_date", { ascending: false }).limit(1),
      admin.rpc("admin_account_totals"),
      admin
        .from("group_announcements")
        .select("id,body,kind,created_at")
        .eq("kind", "news")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    for (const result of [code, totals, announcements])
      if (result.error) throw new Error("Could not load administrator data");
    const users = allUsers.map((u) => {
      const own = holdingRows.filter((h) => h.user_id === u.id);
      const setting = settingRows.find((s) => s.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        emailConfirmed: Boolean(u.email_confirmed_at),
        suspended: Boolean(u.banned_until && Date.parse(u.banned_until) > Date.now()),
        mfaEnabled: Boolean(u.factors?.some((f) => f.status === "verified")),
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
      announcements: announcements.data ?? [],
      deposits: deposits.map((r) => ({
        ...r,
        email: emailById.get(r.user_id) ?? r.user_id,
      })),
      withdrawals: withdrawals.map((r) => ({
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
    return audited(admin, context.userId, "balance.set", data.userId, {
      symbol: data.symbol,
      value: data.amount,
    });
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
    return audited(admin, context.userId, "balance.adjust", data.userId, {
      symbol: data.symbol,
      value: data.delta,
    });
  });
export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, planId: z.enum(["free", "pro", "elite"]), enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    return audited(admin, context.userId, "plan.set", data.userId, {
      plan: data.planId,
      enabled: data.enabled,
    });
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
      return audited(admin, context.userId, "deposit.reject", row.id);
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
    return audited(admin, context.userId, "deposit.credit", row.id, {
      paymentId: payment.payment_id,
      paid: payment.actually_paid,
    });
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
    return audited(admin, context.userId, "withdrawal.status", data.withdrawalId, {
      status: data.status,
    });
  });
export const adminRotateDailyCode = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    return audited(admin, context.userId, "code.rotate");
  });
export const adminRunPayout = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    return audited(admin, context.userId, "payout.run");
  });
export const adminSetAdminRole = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, makeAdmin: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin)
      throw new Error("You cannot remove your own admin access");
    return audited(admin, context.userId, "role.set", data.userId, { admin: data.makeAdmin });
  });
export const adminSetBoost = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, grant: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    return audited(admin, context.userId, "boost.set", data.userId, { grant: data.grant });
  });
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { auditAuthAction } = await import("./admin-audit.server");
    return auditAuthAction(admin, context.userId, data.userId, "account.delete", async () => {
      const { error } = await admin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
    });
  });

export const adminSetAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ userId, suspended: z.boolean() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { auditAuthAction } = await import("./admin-audit.server");
    return auditAuthAction(
      admin,
      context.userId,
      data.userId,
      data.suspended ? "account.suspend" : "account.restore",
      () => changeAccountAccess(admin, context.userId, data.userId, data.suspended),
    );
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ announcementId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    return audited(admin, context.userId, "announcement.delete", data.announcementId);
  });

export const adminAuditHistory = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ page: z.number().int().min(0).max(1000000) }))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: rows, error } = await admin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(data.page * 50, data.page * 50 + 50);
    if (error)
      throw new Error(
        "Could not load audit history. Apply the member tools SQL migration and retry.",
      );
    return { rows: rows.slice(0, 50), hasMore: rows.length > 50 };
  });
