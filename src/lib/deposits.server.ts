export const DEPOSIT_CURRENCIES = ["btc", "eth", "sol", "usdttrc20"] as const;
export const FALLBACK_MIN_USD = 10;

export type DepositCurrency = { currency: string };
export type MinDeposit = { currency: string; minUsd: number; minAmount: number | null };

function normalizeCurrencies(body: unknown): DepositCurrency[] {
  const values = Array.isArray(body)
    ? body
    : Array.isArray((body as { currencies?: unknown[] })?.currencies)
      ? (body as { currencies: unknown[] }).currencies
      : [];

  const currencies = values
    .map((value) => typeof value === "string" ? value : (value as { currency?: unknown })?.currency)
    .filter((value): value is string => typeof value === "string" && /^[a-z0-9_:-]+$/i.test(value))
    .map((currency) => ({ currency: currency.toLowerCase() }));

  return [...new Map(currencies.map((item) => [item.currency, item])).values()]
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// NOWPayments maintains the available asset/network codes. Refresh them at request time
// so newly supported networks appear without a frontend release.
export async function fetchSupportedDepositCurrencies(apiKey: string): Promise<DepositCurrency[]> {
  try {
    const response = await fetch("https://api.nowpayments.io/v1/full-currencies", {
      headers: { "x-api-key": apiKey },
    });
    if (!response.ok) throw new Error("Currency list unavailable");
    const currencies = normalizeCurrencies(await response.json());
    return currencies.length ? currencies : DEPOSIT_CURRENCIES.map((currency) => ({ currency }));
  } catch {
    return DEPOSIT_CURRENCIES.map((currency) => ({ currency }));
  }
}

export async function fetchMinDeposit(currency: string, apiKey: string): Promise<MinDeposit> {
  try {
    const url = new URL("https://api.nowpayments.io/v1/min-amount");
    url.searchParams.set("currency_from", currency);
    url.searchParams.set("currency_to", currency);
    url.searchParams.set("fiat_equivalent", "usd");
    const response = await fetch(url, { headers: { "x-api-key": apiKey } });
    if (!response.ok) return { currency, minUsd: FALLBACK_MIN_USD, minAmount: null };
    const body = await response.json() as { min_amount?: number | string; fiat_equivalent?: number | string };
    const fiat = Number(body.fiat_equivalent);
    const minAmount = Number(body.min_amount);
    return {
      currency,
      minUsd: Number.isFinite(fiat) && fiat > 0 ? Math.ceil(fiat * 100) / 100 : FALLBACK_MIN_USD,
      minAmount: Number.isFinite(minAmount) ? minAmount : null,
    };
  } catch {
    return { currency, minUsd: FALLBACK_MIN_USD, minAmount: null };
  }
}
