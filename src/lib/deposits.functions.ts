import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEPOSIT_COLUMNS =
  "id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at";

const ALLOWED = new Set(["btc", "eth", "sol", "usdttrc20"]);

type DepositInput = { currency: string; amountUsd: number };

export const getMinDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const { fetchAllMinDeposits, FALLBACK_MIN_USD, DEPOSIT_CURRENCIES } = await import("@/lib/deposits.server");
    if (!apiKey) {
      return { minimums: DEPOSIT_CURRENCIES.map((c) => ({ currency: c, minUsd: FALLBACK_MIN_USD, minAmount: null })) };
    }
    return { minimums: await fetchAllMinDeposits(apiKey) };
  });

export const createDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DepositInput) => input)
  .handler(async ({ data, context }) => {
    const currency = String(data.currency ?? "").toLowerCase();
    const amount = Number(data.amountUsd);
    if (!ALLOWED.has(currency) || !Number.isFinite(amount) || amount > 100000) {
      throw new Error("Choose a supported currency and a deposit up to $100,000");
    }

    const apiKey = process.env["NOWPAYMENTS_API_KEY"];
    const siteUrl = process.env["PUBLIC_SITE_URL"] ?? "";
    if (!apiKey) throw new Error("Deposit service is not configured");

    const { fetchMinDeposit } = await import("@/lib/deposits.server");
    const { minUsd } = await fetchMinDeposit(currency, apiKey);
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
      .in("status", ["creating", "waiting", "confirming", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) return { deposit: active };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("crypto_deposits")
      .insert({ user_id: userId, pay_currency: currency, price_amount: amount })
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
        order_description: `NOVAX deposit ${draft.id}`,
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
