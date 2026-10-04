// Static market data for the exchange. Prices update with a simulated live feed
// in the frontend (see useLivePrices hook). Market cap is fixed for display.

export const MARKETS = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 104820.24,
    change: 2.38,
    cap: "$2.08T",
    color: "#ed941e",
    icon: "₿",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 3842.1,
    change: 1.08,
    cap: "$463.5B",
    color: "#6179db",
    icon: "Ξ",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: 181.42,
    change: 3.72,
    cap: "$98.4B",
    color: "#58ecbc",
    icon: "S",
  },
  {
    symbol: "XRP",
    name: "Ripple",
    price: 2.34,
    change: -0.85,
    cap: "$131.2B",
    color: "#3b82f6",
    icon: "X",
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: 632.18,
    change: 0.94,
    cap: "$92.1B",
    color: "#f3ba2f",
    icon: "B",
  },
  {
    symbol: "LTC",
    name: "Litecoin",
    price: 92.44,
    change: 1.21,
    cap: "$7.0B",
    color: "#94a3b8",
    icon: "Ł",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    price: 0.164,
    change: -1.35,
    cap: "$24.2B",
    color: "#c2a633",
    icon: "Ð",
  },
  {
    symbol: "TRX",
    name: "Tron",
    price: 0.271,
    change: 0.62,
    cap: "$23.4B",
    color: "#e5342b",
    icon: "T",
  },
  {
    symbol: "USDT",
    name: "Tether",
    price: 1.0,
    change: 0.01,
    cap: "$140.6B",
    color: "#26a17b",
    icon: "₮",
  },
];

export const MARKET_MAP = Object.fromEntries(MARKETS.map((m) => [m.symbol, m]));

export function formatUsd(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatNum(n, decimals = 4) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(n);
}
