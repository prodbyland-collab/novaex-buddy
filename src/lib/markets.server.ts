const SYMBOLS = new Set(["USD", "BTC", "ETH", "SOL", "XRP", "BNB", "LTC", "DOGE", "TRX", "USDT"]);

export async function getMarketPrice(symbol: string): Promise<number> {
  if (!SYMBOLS.has(symbol)) throw new Error("Unsupported asset");
  if (symbol === "USD" || symbol === "USDT") return 1;
  const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Current price is unavailable. Please try again.");
  const body = (await response.json()) as { price?: string };
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0)
    throw new Error("Current price is unavailable. Please try again.");
  return price;
}
