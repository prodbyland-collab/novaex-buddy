import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { paymentSchema, paymentAddressSchema, getCallbackUrl } from "./payment";
import type { Tables } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";

const DEPOSIT_COLUMNS =
  "id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at, purpose, plan_id";

type DepositInput = { currency: string; amountUsd: number; planId?: string };
type MinimumInput = { currency: string };

export const getMinDeposits = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .handler(async () => {
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const { fetchSupportedDepositCurrencies } = await import("@/lib/deposits.server");
    if (!apiKey) return { currencies: [] };
    return { currencies: await fetchSupportedDepositCurrencies(apiKey) };
  });

export const getDepositMinimum = createServerFn({ method: "GET" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ currency: z.string().min(1).max(30) }))
  .handler(async ({ data }) => {
    const currency = String(data.currency ?? "").toLowerCase();
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey) throw new Error("Deposit service is not configured");

    const { fetchMinDeposit, fetchSupportedDepositCurrencies } =
      await import("@/lib/deposits.server");
    const supported = await fetchSupportedDepositCurrencies(apiKey);
    if (!supported.some((item) => item.currency === currency)) {
      throw new Error("This currency or network is not currently supported by NOWPayments");
    }

    const minimum = await fetchMinDeposit(currency, apiKey);
    if (minimum.minUsd === null) {
      throw new Error("Could not retrieve the current NOWPayments minimum for this currency");
    }
    return { ...minimum, minUsd: Math.max(minimum.minUsd, 500) };
  });

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(
    z.object({
      currency: z.string().min(1).max(30),
      amountUsd: z.number().finite().nonnegative().max(100000),
      planId: z.enum(["pro", "elite"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const currency = String(data.currency ?? "").toLowerCase();
    const { getBotPlan } = await import("@/lib/plans");
    const plan = data.planId ? getBotPlan(String(data.planId)) : undefined;
    if (data.planId && (!plan || plan.price <= 0)) {
      throw new Error("Unknown bot plan");
    }
    const purpose = plan ? "plan" : "balance";
    const amount = plan ? plan.price : Number(data.amountUsd);
    if (!Number.isFinite(amount) || amount > 100000) {
      throw new Error("Choose a deposit up to $100,000");
    }
    if (!plan && amount < 500) {
      throw new Error("Minimum deposit is $500");
    }

    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const callbackUrl = getCallbackUrl(
      process.env["PUBLIC_SITE_URL"] || process.env["VITE_PUBLIC_SITE_URL"],
      getRequest().url,
    );
    if (!apiKey) throw new Error("Deposit service is not configured");

    const { fetchMinDeposit, fetchSupportedDepositCurrencies } =
      await import("@/lib/deposits.server");
    const supported = await fetchSupportedDepositCurrencies(apiKey);
    if (!supported.some((item) => item.currency === currency)) {
      throw new Error("This currency or network is not currently supported by NOWPayments");
    }
    const { minUsd: minUsdRaw } = await fetchMinDeposit(currency, apiKey);
    const minUsd = Math.max(minUsdRaw ?? 0, plan ? 0 : 500);
    if (minUsdRaw === null) {
      throw new Error("Could not retrieve the current NOWPayments minimum for this currency");
    }
    if (amount < minUsd) {
      throw new Error(`Minimum deposit for ${currency.toUpperCase()} is $${minUsd}`);
    }

    const userId = context.userId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reserved, error: reserveError } = await supabaseAdmin.rpc("reserve_deposit", {
      p_user_id: userId,
      p_currency: currency,
      p_amount: amount,
      p_plan_id: plan?.id ?? null,
    });
    if (reserveError) throw new Error(reserveError.message);
    const reservation = reserved as { created: boolean; deposit: Tables<"crypto_deposits"> } | null;
    if (!reservation) throw new Error("Could not start deposit");
    if (!reservation.created) {
      if (!reservation.deposit.payment_id)
        throw new Error("The payment is still being prepared. Please retry shortly.");
      return { deposit: reservation.deposit };
    }
    const draft = reservation.deposit;
    try {
      const paymentResponse = await fetch("https://api.nowpayments.io/v1/payment", {
        method: "POST",
        signal: AbortSignal.timeout(15000),
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: "usd",
          pay_currency: currency,
          order_id: draft.id,
          order_description: `GNG deposit ${draft.id}`,
          ipn_callback_url: callbackUrl,
        }),
      });

      if (!paymentResponse.ok) throw new Error("NOWPayments rejected the deposit request");
      const raw = await paymentResponse.json();
      // Save the provider identity before parsing address details so a malformed
      // response can still be reconciled by polling or a signed webhook.
      const identity = paymentSchema.safeParse(raw);
      if (identity.success) {
        const { error } = await supabaseAdmin
          .from("crypto_deposits")
          .update({ payment_id: identity.data.payment_id, status: "waiting" })
          .eq("id", draft.id)
          .is("payment_id", null)
          .is("credited_at", null);
        if (error) throw new Error("Could not save payment identity");
      }
      const payment = paymentAddressSchema.parse(raw);
      const { data: deposit, error: updateError } = await supabaseAdmin
        .from("crypto_deposits")
        .update({
          payment_id: String(payment.payment_id),
          pay_address: payment.pay_address,
          pay_amount: Number(payment.pay_amount ?? 0),
          status: payment.payment_status === "sending" ? "confirming" : payment.payment_status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id)
        .is("credited_at", null)
        .select(DEPOSIT_COLUMNS)
        .single();
      if (updateError || !deposit) throw new Error("Could not save deposit details");

      return { deposit };
    } catch (error) {
      const { error: cleanupError } = await supabaseAdmin
        .from("crypto_deposits")
        .update({ status: "creation_failed", updated_at: new Date().toISOString() })
        .eq("id", draft.id)
        .is("payment_id", null)
        .is("credited_at", null);
      if (cleanupError) console.error("Could not release deposit draft", cleanupError);
      throw error;
    }
  });

// Poll NOWPayments directly for the user's open deposits and credit them.
// Works even when the provider's webhook can't reach the app.
export const syncMyDeposits = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey) return { updated: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: open, error: openError } = await supabaseAdmin
      .from("crypto_deposits")
      .select("payment_id, status")
      .eq("user_id", context.userId)
      .is("credited_at", null)
      .not("payment_id", "is", null)
      .not("status", "in", "(failed,expired,refunded)")
      .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())
      .limit(10);
    if (openError) throw new Error("Could not load pending payments");
    let updated = 0;
    let failed = 0;
    for (const row of open ?? []) {
      try {
        const res = await fetch(`https://api.nowpayments.io/v1/payment/${row.payment_id}`, {
          headers: { "x-api-key": apiKey },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error("Payment lookup failed");
        const p = paymentAddressSchema.parse(await res.json());
        if (p.payment_id !== String(row.payment_id)) throw new Error("Payment identity mismatch");
        const { error: detailsError } = await supabaseAdmin
          .from("crypto_deposits")
          .update({ pay_address: p.pay_address, pay_amount: p.pay_amount })
          .eq("payment_id", p.payment_id)
          .is("credited_at", null);
        if (detailsError) throw new Error("Could not save payment details");
        const status = p.payment_status === "sending" ? "confirming" : p.payment_status;
        const { error } = await supabaseAdmin.rpc("credit_crypto_deposit", {
          p_payment_id: p.payment_id,
          p_status: status,
          p_actually_paid: p.actually_paid,
        });
        if (error) throw new Error(error.message);
        updated++;
      } catch {
        failed++;
      }
    }
    return { updated, failed };
  });
