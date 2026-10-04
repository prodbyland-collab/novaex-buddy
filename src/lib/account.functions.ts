import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireVerifiedAuth } from "@/integrations/supabase/verified-auth";

export const assetSymbol = z.enum([
  "USD",
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "BNB",
  "LTC",
  "DOGE",
  "TRX",
  "USDT",
]);
const amount = z.number().finite().positive().max(1e12);

export const purchaseBalancePlan = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(z.object({ planId: z.enum(["pro", "elite"]), requestId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: purchase, error } = await supabaseAdmin.rpc("purchase_balance_plan", {
      p_user_id: context.userId,
      p_plan_id: data.planId,
      p_request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    if (!purchase) throw new Error("Could not purchase bot plan");
    return purchase;
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(
    z.object({
      symbol: assetSymbol,
      amount,
      address: z.string().trim().min(12).max(256).regex(/^\S+$/),
      requestId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { getMarketPrice } = await import("./markets.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const price = await getMarketPrice(data.symbol);
    const { data: row, error } = await supabaseAdmin.rpc("record_withdrawal", {
      p_user_id: context.userId,
      p_symbol: data.symbol,
      p_amount: data.amount,
      p_address: data.address,
      p_unit_price: price,
      p_request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Could not record withdrawal");
    return row;
  });

export const requestMarketOrder = createServerFn({ method: "POST" })
  .middleware([requireVerifiedAuth])
  .validator(
    z.object({
      symbol: assetSymbol.exclude(["USD"]),
      side: z.enum(["buy", "sell"]),
      amount,
      requestId: z.string().uuid(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { getMarketPrice } = await import("./markets.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const price = await getMarketPrice(data.symbol);
    const { data: row, error } = await supabaseAdmin.rpc("record_market_order", {
      p_user_id: context.userId,
      p_symbol: data.symbol,
      p_side: data.side,
      p_amount: data.amount,
      p_price: price,
      p_request_id: data.requestId,
    });
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Could not record order");
    return row;
  });
