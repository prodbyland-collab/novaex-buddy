import { supabase } from '@/integrations/supabase/client';
import { createDeposit, getMinDeposits, getDepositMinimum } from '@/lib/deposits.functions';
import { checkWithdrawalWhitelist } from '@/lib/withdrawal-whitelist';

// Ensure the current user has a USD cash row. New accounts start at $0 —
// balance only grows through confirmed crypto deposits.
export async function ensureUsdBalance(userId) {
  const { data: existing } = await supabase
    .from('holdings')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('symbol', 'USD')
    .maybeSingle();

  if (!existing) {
    await supabase.from('holdings').insert({ user_id: userId, symbol: 'USD', amount: 0 });
  }
}

// Ensure the user has a security_settings row.
export async function ensureSecuritySettings(userId) {
  const { data: existing } = await supabase
    .from('security_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('security_settings').insert({ user_id: userId });
  }
}

// Fetch all holdings for the current user.
export async function fetchHoldings(userId) {
  const { data, error } = await supabase
    .from('holdings')
    .select('symbol, amount')
    .eq('user_id', userId);
  if (error) throw error;
  return data;
}

// Execute a market order: immediately buy or sell at the current live price.
// Deducts/adds USD and the asset. Creates an order record with status 'filled'.
export async function executeMarketOrder(userId, symbol, side, amount, price) {
  const cost = side === 'buy' ? amount * price : 0;
  const proceeds = side === 'sell' ? amount * price : 0;

  // Fetch current holdings
  const { data: usdRow } = await supabase
    .from('holdings')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('symbol', 'USD')
    .maybeSingle();

  const { data: assetRow } = await supabase
    .from('holdings')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .maybeSingle();

  const usdAmount = usdRow?.amount ?? 0;
  const assetAmount = assetRow?.amount ?? 0;

  if (side === 'buy' && usdAmount < cost) {
    throw new Error('Insufficient USD balance');
  }
  if (side === 'sell' && assetAmount < amount) {
    throw new Error(`Insufficient ${symbol} balance`);
  }

  // Update USD
  const newUsd = side === 'buy' ? usdAmount - cost : usdAmount + proceeds;
  if (usdRow) {
    await supabase.from('holdings').update({ amount: newUsd }).eq('id', usdRow.id);
  } else {
    await supabase.from('holdings').insert({ user_id: userId, symbol: 'USD', amount: newUsd });
  }

  // Update asset
  const newAsset = side === 'buy' ? assetAmount + amount : assetAmount - amount;
  if (assetRow) {
    if (newAsset <= 0) {
      await supabase.from('holdings').delete().eq('id', assetRow.id);
    } else {
      await supabase.from('holdings').update({ amount: newAsset }).eq('id', assetRow.id);
    }
  } else if (newAsset > 0) {
    await supabase.from('holdings').insert({ user_id: userId, symbol, amount: newAsset });
  }

  // Record the order
  await supabase.from('orders').insert({
    user_id: userId,
    symbol,
    side,
    type: 'market',
    amount,
    price,
    status: 'filled',
    filled_at: new Date().toISOString(),
  });
}

// Create a limit order. Stays 'open' until the live price crosses the limit.
export async function createLimitOrder(userId, symbol, side, amount, limitPrice) {
  await supabase.from('orders').insert({
    user_id: userId,
    symbol,
    side,
    type: 'limit',
    amount,
    price: limitPrice,
    status: 'open',
  });
}

// Cancel an open limit order.
export async function cancelOrder(orderId) {
  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
}

// Fetch orders for the current user.
export async function fetchOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Recurring buys
export async function fetchRecurringBuys(userId) {
  const { data, error } = await supabase
    .from('recurring_buys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createRecurringBuy(userId, symbol, amountUsd, frequency) {
  await supabase.from('recurring_buys').insert({
    user_id: userId,
    symbol,
    amount_usd: amountUsd,
    frequency,
    active: true,
  });
}

export async function toggleRecurringBuy(id, active) {
  await supabase.from('recurring_buys').update({ active }).eq('id', id);
}

export async function deleteRecurringBuy(id) {
  await supabase.from('recurring_buys').delete().eq('id', id);
}

// Security settings
export async function fetchSecuritySettings(userId) {
  const { data, error } = await supabase
    .from('security_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSecuritySettings(id, fields) {
  const { data, error } = await supabase
    .from('security_settings')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchCryptoDeposits(userId, purpose = 'balance') {
  const { data, error } = await supabase
    .from('crypto_deposits')
    .select('id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at, purpose, plan_id')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCryptoDeposit(currency, amountUsd) {
  const result = await createDeposit({ data: { currency, amountUsd: Number(amountUsd) } });
  if (!result?.deposit) throw new Error('Could not create a deposit address');
  return result.deposit;
}

export async function createPlanPurchase(currency, planId) {
  const result = await createDeposit({ data: { currency, amountUsd: 0, planId } });
  if (!result?.deposit) throw new Error('Could not create a payment address');
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

export const WITHDRAWAL_FEE_PCT = 0.20;

export async function fetchWithdrawals(userId) {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id, symbol, amount, usd_value, fee_amount, net_amount, address, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createWithdrawal(userId, symbol, amount, address, usdValue) {
  if (!address || address.trim().length < 12) throw new Error('Enter a valid destination address');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero');

  const [{ data: authData, error: authError }, security] = await Promise.all([
    supabase.auth.getUser(),
    fetchSecuritySettings(userId),
  ]);
  if (authError || authData.user?.id !== userId) throw new Error('Sign in again before requesting a withdrawal.');
  checkWithdrawalWhitelist(security?.withdrawal_whitelist, authData.user.user_metadata?.withdrawal_addresses, address);

  const { data: row } = await supabase
    .from('holdings')
    .select('id, amount')
    .eq('user_id', userId)
    .eq('symbol', symbol)
    .maybeSingle();

  const available = row?.amount ?? 0;
  if (available < amount) throw new Error(`Insufficient ${symbol} balance`);

  // A 20% commission is taken from the requested amount; the user receives the rest.
  const fee = amount * WITHDRAWAL_FEE_PCT;
  const net = amount - fee;

  const remaining = available - amount;
  if (symbol !== 'USD' && remaining <= 0) {
    await supabase.from('holdings').delete().eq('id', row.id);
  } else {
    await supabase.from('holdings').update({ amount: remaining }).eq('id', row.id);
  }

  const { data, error } = await supabase
    .from('withdrawals')
    .insert({
      user_id: userId,
      symbol,
      amount,
      address: address.trim(),
      usd_value: usdValue,
      fee_amount: fee,
      net_amount: net,
      fee_pct: WITHDRAWAL_FEE_PCT,
      status: 'completed',
    })
    .select('id, symbol, amount, usd_value, fee_amount, net_amount, address, status, created_at')
    .single();
  if (error) throw error;
  return data;
}

// ---- AI trading mode ----

export async function fetchAiSettings(userId) {
  const { data, error } = await supabase
    .from('ai_trading_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created } = await supabase
    .from('ai_trading_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('*')
    .maybeSingle();
  if (created) return created;

  const { data: existing, error: reErr } = await supabase
    .from('ai_trading_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (reErr) throw reErr;
  return existing;
}

export async function setTradingMode(userId, mode) {
  const enabled = mode === 'ai';
  const settings = await fetchAiSettings(userId);
  const fields = enabled
    ? { enabled: true, started_at: new Date().toISOString(), last_accrued_at: new Date().toISOString() }
    : { enabled: false };
  const { data, error } = await supabase
    .from('ai_trading_settings')
    .update(fields)
    .eq('id', settings.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function redeemAiCode(code) {
  const { data, error } = await supabase.rpc('redeem_ai_code', { p_code: code });
  if (error) throw error;
  return data;
}


export async function fetchAiTrades(userId, limit = 20) {
  const { data, error } = await supabase
    .from('ai_trades')
    .select('id, symbol, side, amount, price, profit, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---- Referrals ----

export async function fetchReferralInfo() {
  const { data, error } = await supabase.rpc('get_my_referral_info');
  if (error) throw error;
  return data;
}

export async function claimReferral(code) {
  const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
  if (error) throw error;
  return data;
}

// ---- Cost basis: what the user actually put in vs what they hold now ----
export async function fetchCostBasis(userId) {
  const [deposits, withdrawals] = await Promise.all([
    supabase
      .from('crypto_deposits')
      .select('price_amount, credited_at, purpose')
      .eq('user_id', userId)
      .eq('purpose', 'balance')
      .not('credited_at', 'is', null),
    supabase
      .from('withdrawals')
      .select('usd_value')
      .eq('user_id', userId)
      .neq('status', 'failed'),
  ]);
  if (deposits.error) throw deposits.error;
  if (withdrawals.error) throw withdrawals.error;

  const deposited = (deposits.data ?? []).reduce((sum, d) => sum + Number(d.price_amount || 0), 0);
  const withdrawn = (withdrawals.data ?? []).reduce((sum, w) => sum + Number(w.usd_value || 0), 0);
  return { deposited, withdrawn, netInvested: deposited - withdrawn };
}
