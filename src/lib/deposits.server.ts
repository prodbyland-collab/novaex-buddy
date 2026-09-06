// Coins we offer. Every entry is supported by NOWPayments; anything the
// provider does not return live is filtered out.
export const DEPOSIT_CURRENCIES = [
  "btc",
  "eth",
  "sol",
  "xrp",
  "ltc",
  "doge",
  "trx",
  "bnbbsc",
  "usdttrc20",
  "usdcsol",
] as const;

const ALLOWED = new Set<string>(DEPOSIT_CURRENCIES as readonly string[]);


export type DepositCurrency = { currency: string };
export type MinDeposit = { currency: string; minUsd: number | null; minAmount: number | null };

function getCurrencyCode(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  for (const key of ["currency", "code", "ticker", "id"]) {
    if (typeof item[key] === "string") return item[key] as string;
  }
  return null;
}

function normalizeCurrencies(body: unknown): DepositCurrency[] {
  const root = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const values = Array.isArray(body)
    ? body
    : Array.isArray(root["currencies"])
      ? root["currencies"]
      : Array.isArray(root["data"])
        ? root["data"]
        : Array.isArray(root["result"])
          ? root["result"]
          : [];

  const currencies = values
    .map(getCurrencyCode)
    .filter((value): value is string => typeof value === "string" && /^[a-z0-9_:-]+$/i.test(value))
    .map((currency) => ({ currency: currency.toLowerCase() }));

  return [...new Map(currencies.map((item) => [item.currency, item])).values()]
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function fetchSupportedDepositCurrencies(apiKey: string): Promise<DepositCurrency[]> {
  try {
    const response = await fetch("https://api.nowpayments.io/v1/full-currencies", {
      headers: { "x-api-key": apiKey },
    });
    if (!response.ok) throw new Error("Currency list unavailable");

    const currencies = normalizeCurrencies(await response.json());
    if (!currencies.length) throw new Error("Currency list was empty");
    return currencies;
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
    if (!response.ok) return { currency, minUsd: null, minAmount: null };

    const body = await response.json() as { min_amount?: number | string; fiat_equivalent?: number | string };
    const fiat = Number(body.fiat_equivalent);
    const minAmount = Number(body.min_amount);

    return {
      currency,
      minUsd: Number.isFinite(fiat) && fiat > 0 ? Math.ceil(fiat * 100) / 100 : null,
      minAmount: Number.isFinite(minAmount) && minAmount > 0 ? minAmount : null,
    };
  } catch {
    return { currency, minUsd: null, minAmount: null };
  }
}
