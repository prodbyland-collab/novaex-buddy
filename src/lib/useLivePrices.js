import { useEffect, useState, useRef } from 'react';
import { MARKETS } from '@/lib/markets';

// Simulated live price feed: every 2 seconds each asset's price drifts by a
// small random percentage. Returns a map of symbol -> { price, change, prevPrice, history }.
export function useLivePrices() {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(
      MARKETS.map(m => [m.symbol, { price: m.price, change: m.change, prevPrice: m.price, history: [m.price] }])
    )
  );
  const ref = useRef(prices);
  ref.current = prices;

  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => {
        const next = {};
        for (const m of MARKETS) {
          const cur = prev[m.symbol] ?? { price: m.price, change: m.change, history: [m.price] };
          const drift = (Math.random() - 0.48) * 0.004; // slight upward bias
          const newPrice = Math.max(0.01, cur.price * (1 + drift));
          const history = [...(cur.history ?? []), newPrice].slice(-30);
          next[m.symbol] = {
            price: newPrice,
            prevPrice: cur.price,
            change: cur.change + drift * 100,
            history,
          };
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return prices;
}
