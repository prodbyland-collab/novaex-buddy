import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLivePrices } from '@/lib/useLivePrices';
import { MARKET_MAP } from '@/lib/markets';
import { ensureUsdBalance, fetchHoldings } from '@/lib/api';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ user, children }) {
  const prices = useLivePrices();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prevTotal, setPrevTotal] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    await ensureUsdBalance(user.id);
    const data = await fetchHoldings(user.id);
    setHoldings(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const total = holdings.reduce((sum, h) => {
    const price = h.symbol === 'USD' ? 1 : (prices[h.symbol]?.price ?? MARKET_MAP[h.symbol]?.price ?? 0);
    return sum + h.amount * price;
  }, 0);

  useEffect(() => {
    setPrevTotal(prev => {
      if (prev === null) return total;
      return prev;
    });
    const id = setTimeout(() => setPrevTotal(total), 50);
    return () => clearTimeout(id);
  }, [total]);

  const flashDir = prevTotal !== null && total > prevTotal ? 'up' : total < (prevTotal ?? total) ? 'down' : null;

  const usdBalance = holdings.find(h => h.symbol === 'USD')?.amount ?? 0;

  const baseTotal = holdings.reduce((sum, h) => {
    const price = h.symbol === 'USD' ? 1 : (MARKET_MAP[h.symbol]?.price ?? 0);
    return sum + h.amount * price;
  }, 0);
  const changeUsd = total - baseTotal;
  const changePct = baseTotal > 0 ? (changeUsd / baseTotal) * 100 : 0;

  return (
    <PortfolioContext.Provider value={{
      holdings, total, usdBalance, loading, flashDir,
      changeUsd, changePct, reload: load, prices,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
