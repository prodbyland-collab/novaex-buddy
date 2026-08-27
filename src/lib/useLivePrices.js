import { useEffect, useState } from 'react';
import { MARKETS } from '@/lib/markets';

const PAIRS = Object.fromEntries(MARKETS.map(m => [`${m.symbol}USDT`, m.symbol]));

function initialPrices() {
  return Object.fromEntries(MARKETS.map(m => [m.symbol, {
    price: m.price, change: m.change, prevPrice: m.price, history: [m.price],
  }]));
}

export function useLivePrices() {
  const [prices, setPrices] = useState(initialPrices);

  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!response.ok) throw new Error('Price feed unavailable');
        const tickers = await response.json();
        if (!active) return;

        setPrices(previous => {
          const next = { ...previous };
          for (const ticker of tickers) {
            const symbol = PAIRS[ticker.symbol];
            if (!symbol) continue;
            const price = Number(ticker.lastPrice);
            if (!Number.isFinite(price) || price <= 0) continue;
            const prior = previous[symbol]?.price ?? price;
            next[symbol] = {
              price,
              prevPrice: prior,
              change: Number(ticker.priceChangePercent) || 0,
              history: [...(previous[symbol]?.history ?? [prior]), price].slice(-30),
            };
          }
          return next;
        });
      } catch {
        // Keep the last verified values visible if the public price feed is unavailable.
      }
    };

    update();
    const id = window.setInterval(update, 15000);
    return () => { active = false; window.clearInterval(id); };
  }, []);

  return prices;
}
