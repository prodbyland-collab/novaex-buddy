import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useLivePrices } from "@/lib/useLivePrices";
import { MARKET_MAP } from "@/lib/markets";
import { ensureUsdBalance, fetchHoldings, fetchCostBasis } from "@/lib/api";
import { portfolioProfit } from "@/lib/portfolio-math";

// Keep one context instance across hot reloads so provider and consumers always match.
const PortfolioContext =
  globalThis.__gngPortfolioContext ?? (globalThis.__gngPortfolioContext = createContext(null));

export function PortfolioProvider({ user, children }) {
  const prices = useLivePrices();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const pendingRequests = useRef(0);
  const [prevTotal, setPrevTotal] = useState(null);
  const [basis, setBasis] = useState({ deposited: 0, withdrawn: 0, netInvested: 0 });

  const load = useCallback(
    async (background = false) => {
      background = background === true;
      if (background && pendingRequests.current) return false;
      const request = ++sequence.current;
      if (!user) {
        setLoading(false);
        return false;
      }
      pendingRequests.current++;
      if (!background) {
        setLoading(true);
        setError("");
      }
      try {
        await ensureUsdBalance(user.id);
        const [data, costBasis] = await Promise.all([
          fetchHoldings(user.id),
          fetchCostBasis(user.id),
        ]);
        if (request !== sequence.current) return false;
        setHoldings(data);
        setBasis(costBasis);
        setError("");
        return true;
      } catch (e) {
        if (request === sequence.current) setError(e.message || "Could not load portfolio");
        return false;
      } finally {
        pendingRequests.current--;
        if (request === sequence.current) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    setHoldings([]);
    setBasis({ deposited: 0, withdrawn: 0, netInvested: 0 });
    setPrevTotal(null);
    load();
    const pending = sequence;
    return () => {
      pending.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, user]);

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

  const { netInvested, changeUsd, changePct } = portfolioProfit(
    total,
    basis.deposited,
    basis.withdrawn,
  );

  return (
    <PortfolioContext.Provider
      value={{
        holdings,
        total,
        usdBalance,
        loading,
        error,
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
