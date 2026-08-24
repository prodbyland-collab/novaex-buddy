import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePortfolio } from '@/lib/portfolio';
import { formatUsd, formatNum } from '@/lib/markets';
import { fetchAiSettings, setTradingMode, accrueAiProfit, fetchAiTrades } from '@/lib/api';

export default function AiTrading() {
  const { user } = useAuth();
  const { usdBalance, reload } = usePortfolio();
  const [settings, setSettings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, t] = await Promise.all([fetchAiSettings(user.id), fetchAiTrades(user.id)]);
    setSettings(s);
    setTrades(t);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // While AI trading is on, credit accrued profit periodically.
  useEffect(() => {
    if (!settings?.enabled) return;
    let cancelled = false;
    async function tick() {
      try {
        const gained = await accrueAiProfit();
        if (cancelled) return;
        if (gained > 0) {
          await reload();
          await load();
        }
      } catch { /* ignore transient errors */ }
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [settings?.enabled, reload, load]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function choose(mode) {
    if (!user) return;
    setBusy(true);
    try {
      const next = await setTradingMode(user.id, mode);
      setSettings(next);
      showToast(mode === 'ai' ? 'AI trading activated' : 'Manual trading activated');
    } catch (err) {
      showToast(err.message || 'Could not update trading mode', 'error');
    } finally {
      setBusy(false);
    }
  }

  const aiOn = !!settings?.enabled;
  const dailyPct = ((settings?.daily_rate ?? 0.01) * 100).toFixed(2);
  const projectedDaily = usdBalance * (settings?.daily_rate ?? 0.01);

  return (
    <div className="fade-up">
      <h1 className="page-title">Trading mode</h1>
      <p className="page-sub">Let the AI trade your cash balance for you, or trade everything yourself.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        <div className="card" style={{ border: aiOn ? '1px solid rgba(20,184,166,0.55)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>AI trading</h3>
            {aiOn && <span className="badge badge-teal">Active</span>}
          </div>
          <p className="muted-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
            The AI places trades for you around the clock and targets a steady
            <b> {dailyPct}% per day</b> on your cash balance. Profit is credited continuously
            while it is switched on.
          </p>
          <div className="trade-summary" style={{ marginTop: 16 }}>
            <div><span>Cash under management</span><span>{formatUsd(usdBalance)}</span></div>
            <div><span>Target profit / day</span><span className="gain">+{formatUsd(projectedDaily)}</span></div>
            <div><span>Earned so far</span><span className="gain">+{formatUsd(settings?.total_profit ?? 0)}</span></div>
          </div>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            disabled={busy || aiOn}
            onClick={() => choose('ai')}
          >
            {aiOn ? 'AI trading is on' : 'Enable AI trading'}
          </button>
        </div>

        <div className="card" style={{ border: !aiOn ? '1px solid rgba(20,184,166,0.55)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>Manual trading</h3>
            {!aiOn && <span className="badge badge-teal">Active</span>}
          </div>
          <p className="muted-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
            You stay in full control: place your own market and limit orders on the
            Markets page, and manage recurring buys yourself. No automated trades are made.
          </p>
          <button
            className="btn ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            disabled={busy || !aiOn}
            onClick={() => choose('manual')}
          >
            {!aiOn ? 'Manual trading is on' : 'Switch to manual trading'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>AI trade activity</h3>
        {trades.length === 0 ? (
          <p className="muted-2" style={{ fontSize: 13 }}>No AI trades yet. Enable AI trading to get started.</p>
        ) : (
          <div className="market-table">
            <div className="table-head">
              <span>Asset</span><span>Side</span><span>Size</span><span>Price</span><span>Profit</span>
            </div>
            {trades.map(t => (
              <div className="table-row" key={t.id}>
                <span>{t.symbol}</span>
                <span className={t.side === 'buy' ? 'gain' : 'loss'}>{t.side.toUpperCase()}</span>
                <span>{formatNum(t.amount, 6)}</span>
                <span>{formatUsd(t.price)}</span>
                <span className="gain">+{formatUsd(t.profit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div style={{ height: 24 }} />
    </div>
  );
}
