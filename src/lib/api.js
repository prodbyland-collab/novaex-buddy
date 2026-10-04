import { supabase } from "@/integrations/supabase/client";
import { createDeposit, getMinDeposits, getDepositMinimum } from "@/lib/deposits.functions";
import { requestWithdrawal, requestMarketOrder } from "@/lib/account.functions";

// Ensure the current user has a USD cash row. New accounts start at $0 —
// balance only grows through confirmed crypto deposits.
export async function ensureUsdBalance() {
  const { error } = await supabase.rpc("ensure_my_account");
  if (error) throw error;
}
export const ensureSecuritySettings = ensureUsdBalance;

// Fetch all holdings for the current user.
export async function fetchHoldings(userId) {
  const { data, error } = await supabase
    .from("holdings")
    .select("symbol, amount")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

// Execute a market order: immediately buy or sell at the current live price.
// Deducts/adds USD and the asset. Creates an order record with status 'filled'.
export async function executeMarketOrder(
  _userId,
  symbol,
  side,
  amount,
  _price,
  requestId = crypto.randomUUID(),
) {
  return requestMarketOrder({ data: { symbol, side, amount, requestId } });
}

// Legacy order entry points are unavailable until matching/reservations exist.
export async function createLimitOrder() {
  throw new Error("Limit orders are not available.");
}
export async function cancelOrder() {
  throw new Error("Limit orders are not available.");
}

// Fetch orders for the current user.
export async function fetchOrders(userId) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Recurring buys
export async function fetchRecurringBuys(userId) {
  const { data, error } = await supabase
    .from("recurring_buys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createRecurringBuy() {
  throw new Error("Recurring buys are not available.");
}
export async function toggleRecurringBuy() {
  throw new Error("Recurring buys are not available.");
}
export async function deleteRecurringBuy() {
  throw new Error("Recurring buys are not available.");
}

// Security settings
export async function fetchSecuritySettings(userId) {
  const { data, error } = await supabase
    .from("security_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSecuritySettings(_id, fields) {
  const { data, error } = await supabase.rpc("configure_my_security", {
    p_whitelist: fields.withdrawal_whitelist,
    p_addresses: fields.approved_addresses,
  });
  if (error) throw error;
  return data;
}

export async function fetchCryptoDeposits(userId, purpose = "balance") {
  const { data, error } = await supabase
    .from("crypto_deposits")
    .select(
      "id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at, purpose, plan_id",
    )
    .eq("user_id", userId)
    .eq("purpose", purpose)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCryptoDeposit(currency, amountUsd) {
  const result = await createDeposit({ data: { currency, amountUsd: Number(amountUsd) } });
  if (!result?.deposit) throw new Error("Could not create a deposit address");
  return result.deposit;
}

export async function createPlanPurchase(currency, planId) {
  const result = await createDeposit({ data: { currency, amountUsd: 0, planId } });
  if (!result?.deposit) throw new Error("Could not create a payment address");
  return result.deposit;
}

export async function fetchMinDeposits() {
  const result = await getMinDeposits();
  return result?.currencies ?? [];
}

// Live NOWPayments minimum for one currency (USD equivalent).
export async function fetchDepositMinimum(currency) {
  return await getDepositMinimum({ data: { currency } });
}

// ---- Withdrawals (simulated: balances change, no funds ever leave) ----

export const WITHDRAWAL_FEE_PCT = 0.2;

export async function fetchWithdrawals(userId) {
  const { data, error } = await supabase
    .from("withdrawals")
    .select("id, symbol, amount, usd_value, fee_amount, net_amount, address, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createWithdrawal(
  _userId,
  symbol,
  amount,
  address,
  _usdValue,
  requestId = crypto.randomUUID(),
) {
  return requestWithdrawal({ data: { symbol, amount, address, requestId } });
}

// ---- AI trading mode ----

export async function fetchAiSettings(userId) {
  const { data, error } = await supabase
    .from("ai_trading_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  await ensureUsdBalance();
  const { data: existing, error: reError } = await supabase
    .from("ai_trading_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (reError) throw reError;
  return existing;
}

export async function setTradingMode(_userId, mode) {
  if (!["ai", "manual"].includes(mode)) throw new Error("Invalid trading mode");
  const { data, error } = await supabase.rpc("set_my_trading_mode", { p_enabled: mode === "ai" });
  if (error) throw error;
  return data;
}

export async function redeemAiCode(code) {
  const { data, error } = await supabase.rpc("redeem_ai_code", { p_code: code });
  if (error) throw error;
  return data;
}

export async function fetchAiTrades(userId, limit = 20) {
  const { data, error } = await supabase
    .from("ai_trades")
    .select("id, symbol, side, amount, price, profit, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---- Referrals ----

export async function fetchReferralInfo() {
  const { data, error } = await supabase.rpc("get_my_referral_info");
  if (error) throw error;
  return data;
}

export async function claimReferral(code) {
  const { data, error } = await supabase.rpc("claim_referral", { p_code: code });
  if (error) throw error;
  return data;
}

// ---- Cost basis: what the user actually put in vs what they hold now ----
export async function fetchCostBasis(userId) {
  const [deposits, withdrawals] = await Promise.all([
    supabase
      .from("crypto_deposits")
      .select("price_amount, pay_amount, actually_paid, credited_at, purpose")
      .eq("user_id", userId)
      .eq("purpose", "balance")
      .not("credited_at", "is", null),
    supabase.from("withdrawals").select("usd_value").eq("user_id", userId).neq("status", "failed"),
  ]);
  if (deposits.error) throw deposits.error;
  if (withdrawals.error) throw withdrawals.error;

  const deposited = (deposits.data ?? []).reduce(
    (sum, d) =>
      sum +
      Number(d.price_amount || 0) *
        Math.min(Number(d.actually_paid || 0) / Number(d.pay_amount || 1), 1),
    0,
  );
  const withdrawn = (withdrawals.data ?? []).reduce((sum, w) => sum + Number(w.usd_value || 0), 0);
  return { deposited, withdrawn, netInvested: deposited - withdrawn };
}
