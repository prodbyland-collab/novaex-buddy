import { supabase } from '@/integrations/supabase/client';

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

export async function fetchCryptoDeposits(userId) {
  const { data, error } = await supabase
    .from('crypto_deposits')
    .select('id, payment_id, pay_currency, pay_address, price_amount, price_currency, pay_amount, status, actually_paid, credited_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCryptoDeposit(currency, amountUsd) {
  const { data, error } = await supabase.functions.invoke('nowpayments-create-deposit', {
    body: { currency, amountUsd },
  });
  if (error || !data?.deposit) throw new Error('Could not create a deposit address');
  return data.deposit;
}
