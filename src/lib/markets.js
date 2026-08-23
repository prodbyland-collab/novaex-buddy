// Static market data for the exchange. Prices update with a simulated live feed
// in the frontend (see useLivePrices hook). Market cap is fixed for display.

export const MARKETS = [
  { symbol: 'BTC',  name: 'Bitcoin',  price: 104820.24, change: 2.38,  cap: '$2.08T', color: '#ed941e', icon: '₿' },
  { symbol: 'ETH',  name: 'Ethereum', price: 3842.10,   change: 1.08,  cap: '$463.5B', color: '#6179db', icon: 'Ξ' },
  { symbol: 'SOL',  name: 'Solana',   price: 181.42,    change: 3.72,  cap: '$98.4B',  color: '#58ecbc', icon: 'S' },
  { symbol: 'XRP', name: 'Ripple',   price: 2.34,      change: -0.85, cap: '$131.2B', color: '#3b82f6', icon: 'X' },
  { symbol: 'ADA', name: 'Cardano',  price: 0.72,      change: 1.42,  cap: '$25.3B',  color: '#0a6cf5', icon: 'A' },
  { symbol: 'AVAX',name: 'Avalanche',price: 38.91,     change: -2.14, cap: '$15.1B',  color: '#e84142', icon: 'V' },
  { symbol: 'DOT', name: 'Polkadot', price: 6.84,      change: 0.56,  cap: '$9.8B',   color: '#e6007a', icon: 'D' },
  { symbol: 'LINK',name: 'Chainlink',price: 14.52,     change: 4.11,  cap: '$8.9B',   color: '#2a5ada', icon: 'L' },
];

export const MARKET_MAP = Object.fromEntries(MARKETS.map(m => [m.symbol, m]));

export function formatUsd(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

export function formatNum(n, decimals = 4) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
}
