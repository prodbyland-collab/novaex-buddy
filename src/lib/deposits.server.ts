export const DEPOSIT_CURRENCIES = ["btc", "eth", "sol", "usdttrc20"] as const;

export const FALLBACK_MIN_USD = 10;

export type MinDeposit = { currency: string; minUsd: number; minAmount: number | null };

// Ask NOWPayments for the network minimum for a currency and express it in USD.
export async function fetchMinDeposit(currency: string, apiKey: string): Promise<MinDeposit> {
  try {
    const url = new URL("https://api.nowpayments.io/v1/min-amount");
    url.searchParams.set("currency_from", currency);
    url.searchParams.set("currency_to", currency);
    url.searchParams.set("fiat_equivalent", "usd");
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!res.ok) return { currency, minUsd: FALLBACK_MIN_USD, minAmount: null };
    const body = (await res.json()) as { min_amount?: number | string; fiat_equivalent?: number | string };
    const fiat = Number(body.fiat_equivalent);
    const minAmount = Number(body.min_amount);
    const minUsd = Number.isFinite(fiat) && fiat > 0 ? Math.ceil(fiat * 100) / 100 : FALLBACK_MIN_USD;
    return { currency, minUsd, minAmount: Number.isFinite(minAmount) ? minAmount : null };
  } catch {
    return { currency, minUsd: FALLBACK_MIN_USD, minAmount: null };
  }
}

export async function fetchAllMinDeposits(apiKey: string): Promise<MinDeposit[]> {
  return Promise.all(DEPOSIT_CURRENCIES.map((c) => fetchMinDeposit(c, apiKey)));
}
