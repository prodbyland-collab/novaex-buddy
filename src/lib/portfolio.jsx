import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLivePrices } from "@/lib/useLivePrices";
import { MARKET_MAP } from "@/lib/markets";
import { ensureUsdBalance, fetchHoldings, fetchCostBasis } from "@/lib/api";

// Keep one context instance across hot reloads so provider and consumers always match.
const PortfolioContext =
  globalThis.__gngPortfolioContext ?? (globalThis.__gngPortfolioContext = createContext(null));

export function PortfolioProvider({ user, children }) {
  const prices = useLivePrices();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prevTotal, setPrevTotal] = useState(null);
  const [basis, setBasis] = useState({ deposited: 0, withdrawn: 0, netInvested: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    await ensureUsdBalance(user.id);
    const [data, costBasis] = await Promise.all([
      fetchHoldings(user.id),
      fetchCostBasis(user.id).catch(() => ({ deposited: 0, withdrawn: 0, netInvested: 0 })),
    ]);
    setHoldings(data);
    setBasis(costBasis);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const total = holdings.reduce((sum, h) => {
    const price =
      h.symbol === "USD" ? 1 : (prices[h.symbol]?.price ?? MARKET_MAP[h.symbol]?.price ?? 0);
    return sum + h.amount * price;
  }, 0);

  useEffect(() => {
    setPrevTotal((prev) => {
      if (prev === null) return total;
      return prev;
    });
    const id = setTimeout(() => setPrevTotal(total), 50);
    return () => clearTimeout(id);
  }, [total]);

  const flashDir =
    prevTotal !== null && total > prevTotal ? "up" : total < (prevTotal ?? total) ? "down" : null;

  const usdBalance = holdings.find((h) => h.symbol === "USD")?.amount ?? 0;

  // Profit since start = what you hold now minus what you actually put in
  // (credited deposits less withdrawn value). With no deposits yet, anything
  // in the account (e.g. AI trading payouts) counts fully as profit.
  const netInvested = Number(basis.netInvested) || 0;
  const changeUsd = total - netInvested;
  const changePct = netInvested > 0 ? (changeUsd / netInvested) * 100 : total > 0 ? 100 : 0;

  return (
    <PortfolioContext.Provider
      value={{
        holdings,
        total,
        usdBalance,
        loading,
        flashDir,
        changeUsd,
        changePct,
        netInvested,
        deposited: basis.deposited,
        withdrawn: basis.withdrawn,
        reload: load,
        prices,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
