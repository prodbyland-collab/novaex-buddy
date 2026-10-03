import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEPOSIT_COLUMNS =
  "id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at, purpose, plan_id";

type DepositInput = { currency: string; amountUsd: number; planId?: string };
type MinimumInput = { currency: string };

export const getMinDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const { fetchSupportedDepositCurrencies } = await import("@/lib/deposits.server");
    if (!apiKey) return { currencies: [] };
    return { currencies: await fetchSupportedDepositCurrencies(apiKey) };
  });


export const getDepositMinimum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: MinimumInput) => input)
  .handler(async ({ data }) => {
    const currency = String(data.currency ?? "").toLowerCase();
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey) throw new Error("Deposit service is not configured");

    const { fetchMinDeposit, fetchSupportedDepositCurrencies } = await import("@/lib/deposits.server");
    const supported = await fetchSupportedDepositCurrencies(apiKey);
    if (!supported.some((item) => item.currency === currency)) {
      throw new Error("This currency or network is not currently supported by NOWPayments");
    }

    const minimum = await fetchMinDeposit(currency, apiKey);
    if (minimum.minUsd === null) {
      throw new Error("Could not retrieve the current NOWPayments minimum for this currency");
    }
    return { ...minimum, minUsd: Math.max(minimum.minUsd, 200) };
  });

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DepositInput) => input)
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
    if (!plan && amount < 200) {
      throw new Error("Minimum deposit is $200");
    }

    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const siteUrl = process.env["PUBLIC_SITE_URL"] || "https://teamgng.lovable.app";
    if (!apiKey) throw new Error("Deposit service is not configured");

    const { fetchMinDeposit, fetchSupportedDepositCurrencies } = await import("@/lib/deposits.server");
    const supported = await fetchSupportedDepositCurrencies(apiKey);
    if (!supported.some((item) => item.currency === currency)) {
      throw new Error("This currency or network is not currently supported by NOWPayments");
    }
    const { minUsd: minUsdRaw } = await fetchMinDeposit(currency, apiKey);
    const minUsd = Math.max(minUsdRaw ?? 0, 200);
    if (minUsdRaw === null) {
      throw new Error("Could not retrieve the current NOWPayments minimum for this currency");
    }
    if (amount < minUsd) {
      throw new Error(`Minimum deposit for ${currency.toUpperCase()} is $${minUsd}`);
    }


    const userId = context.userId;

    // Reuse an in-flight deposit for the same currency.
    const { data: active } = await context.supabase
      .from("crypto_deposits")
      .select(DEPOSIT_COLUMNS)
      .eq("user_id", userId)
      .eq("pay_currency", currency)
      .eq("purpose", purpose)
      .in("status", ["creating", "waiting", "confirming", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) return { deposit: active };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("crypto_deposits")
      .insert({
        user_id: userId,
        pay_currency: currency,
        price_amount: amount,
        purpose,
        plan_id: plan ? plan.id : null,
      })
      .select("id")
      .single();
    if (draftError || !draft) throw new Error("Could not start deposit");

    const callbackBase = siteUrl || process.env["VITE_PUBLIC_SITE_URL"] || "";
    const paymentResponse = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "usd",
        pay_currency: currency,
        order_id: draft.id,
        order_description: `GNG deposit ${draft.id}`,
        ...(callbackBase
          ? { ipn_callback_url: `${callbackBase.replace(/\/$/, "")}/api/public/nowpayments-webhook` }
          : {}),
      }),
    });

    if (!paymentResponse.ok) {
      await supabaseAdmin
        .from("crypto_deposits")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      throw new Error("NOWPayments rejected the deposit request");
    }

    const payment = (await paymentResponse.json()) as {
      payment_id?: string | number;
      pay_address?: string;
      pay_amount?: number | string;
      payment_status?: string;
    };

    if (!payment.payment_id || typeof payment.pay_address !== "string") {
      await supabaseAdmin
        .from("crypto_deposits")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
      throw new Error("NOWPayments returned an incomplete deposit");
    }

    const { data: deposit, error: updateError } = await supabaseAdmin
      .from("crypto_deposits")
      .update({
        payment_id: String(payment.payment_id),
        pay_address: payment.pay_address,
        pay_amount: Number(payment.pay_amount ?? 0),
        status: payment.payment_status || "waiting",
        updated_at: new Date().toISOString(),
      })
      .eq("id", draft.id)
      .select(DEPOSIT_COLUMNS)
      .single();
    if (updateError || !deposit) throw new Error("Could not save deposit details");

    return { deposit };
  });

// Poll NOWPayments directly for the user's open deposits and credit them.
// Works even when the provider's webhook can't reach the app.
export const syncMyDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    if (!apiKey) return { updated: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: open } = await supabaseAdmin
      .from("crypto_deposits")
      .select("payment_id, status")
      .eq("user_id", context.userId)
      .is("credited_at", null)
      .not("payment_id", "is", null)
      .not("status", "in", "(failed,expired,refunded)")
      .gte("created_at", new Date(Date.now() - 7 * 864e5).toISOString())
      .limit(10);
    let updated = 0;
    for (const row of open ?? []) {
      try {
        const res = await fetch(`https://api.nowpayments.io/v1/payment/${row.payment_id}`, {
          headers: { "x-api-key": apiKey },
        });
        if (!res.ok) continue;
        const p = (await res.json()) as { payment_status?: string; actually_paid?: number | string };
        const raw = p.payment_status ?? "";
        const status = raw === "sending" ? "confirming" : raw;
        if (!status || status === row.status) continue;
        await supabaseAdmin.rpc("credit_crypto_deposit", {
          p_payment_id: String(row.payment_id),
          p_status: status,
          p_actually_paid: Math.max(Number(p.actually_paid ?? 0) || 0, 0),
        });
        updated++;
      } catch {
        // ignore one failed lookup
      }
    }
    return { updated };
  });
