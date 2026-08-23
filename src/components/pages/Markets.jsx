import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { usePortfolio } from '@/lib/portfolio';
import { MARKETS, formatUsd, formatNum } from '@/lib/markets';
import { executeMarketOrder, createLimitOrder, fetchHoldings, ensureUsdBalance } from '@/lib/api';
import Sparkline from '@/components/Sparkline';

export default function Markets() {
  const { user } = useAuth();
  const { prices, holdings, reload } = usePortfolio();
  const [selected, setSelected] = useState('BTC');
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const market = MARKETS.find(m => m.symbol === selected);
  const currentPrice = prices[selected]?.price ?? market?.price ?? 0;
  const usdHolding = holdings.find(h => h.symbol === 'USD')?.amount ?? 0;
  const assetHolding = holdings.find(h => h.symbol === selected)?.amount ?? 0;

  const total = orderType === 'market'
    ? (side === 'buy' ? parseFloat(amount) * currentPrice : 0)
    : (side === 'buy' ? parseFloat(amount) * (parseFloat(limitPrice) || 0) : 0);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }

    setLoading(true);
    try {
      if (orderType === 'market') {
        await executeMarketOrder(user.id, selected, side, amt, currentPrice);
        showToast(`${side === 'buy' ? 'Bought' : 'Sold'} ${formatNum(amt)} ${selected} at ${formatUsd(currentPrice)}`, 'success');
      } else {
        const lp = parseFloat(limitPrice);
        if (!lp || lp <= 0) { showToast('Enter a valid limit price', 'error'); setLoading(false); return; }
        await createLimitOrder(user.id, selected, side, amt, lp);
        showToast(`Limit ${side} order placed: ${formatNum(amt)} ${selected} @ ${formatUsd(lp)}`, 'success');
      }
      setAmount('');
      setLimitPrice('');
      await reload();
    } catch (err) {
      showToast(err.message || 'Trade failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up">
      <h1 className="page-title">Markets</h1>
      <p className="page-sub">Trade spot or set limit orders on live prices.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Markets table with sparklines */}
        <div className="card">
          <div className="market-table">
            <div className="table-head">
              <span>Asset</span><span>Price</span><span>Trend</span><span>24h</span><span></span>
            </div>
            {MARKETS.map(m => {
              const p = prices[m.symbol];
              const up = (p?.price ?? m.price) >= (p?.prevPrice ?? m.price);
              const isSelected = selected === m.symbol;
              return (
                <div
                  key={m.symbol}
                  className="table-row"
                  style={{
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(20,184,166,0.06)' : 'transparent',
                    borderRadius: isSelected ? 8 : 0,
                    transition: 'background 0.15s',
                  }}
                  onClick={() => { setSelected(m.symbol); setLimitPrice(''); }}
                >
                  <span className="asset-cell">
                    <b className="asset-icon" style={{ background: m.color }}>{m.icon}</b>
                    <span><span className="asset-name">{m.name}</span><span className="asset-symbol">{m.symbol}</span></span>
                  </span>
                  <span className={up ? 'gain' : 'loss'} style={{ transition: 'color 0.3s', fontWeight: 600 }}>{formatUsd(p?.price ?? m.price)}</span>
                  <span>{p?.history?.length > 2 && <Sparkline points={p.history} color={up ? '#34d399' : '#f87171'} width={70} height={24} />}</span>
                  <span className={p?.change >= 0 ? 'gain' : 'loss'}>{p?.change >= 0 ? '+' : ''}{(p?.change ?? m.change).toFixed(2)}%</span>
                  <span className="badge badge-teal" style={{ justifySelf: 'end' }}>{isSelected ? 'Selected' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade panel */}
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <b className="asset-icon" style={{ background: market?.color }}>{market?.icon}</b>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{selected} / USD</h3>
            </div>
            <div style={{ font: '24px var(--mono)', fontWeight: 700, transition: 'color 0.3s' }} className={currentPrice >= (prices[selected]?.prevPrice ?? currentPrice) ? 'gain' : 'loss'}>
              {formatUsd(currentPrice)}
            </div>
            {prices[selected]?.history?.length > 2 && (
              <div style={{ marginTop: 8 }}>
                <Sparkline points={prices[selected].history} color={currentPrice >= (prices[selected]?.prevPrice ?? currentPrice) ? '#34d399' : '#f87171'} width={300} height={50} />
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="trade-panel">
            <div className="trade-tabs">
              <button type="button" className={`trade-tab ${orderType === 'market' ? 'active' : ''}`} onClick={() => setOrderType('market')}>Market</button>
              <button type="button" className={`trade-tab ${orderType === 'limit' ? 'active' : ''}`} onClick={() => setOrderType('limit')}>Limit</button>
            </div>

            <div className="side-toggle">
              <button type="button" className={`side-btn buy ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>Buy</button>
              <button type="button" className={`side-btn sell ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')}>Sell</button>
            </div>

            {orderType === 'limit' && (
              <div className="field">
                <label>Limit price (USD)</label>
                <input type="number" step="0.01" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={currentPrice.toFixed(2)} />
              </div>
            )}

            <div className="field">
              <label>Amount ({selected})</label>
              <input type="number" step="0.0001" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div className="trade-summary">
              <div><span>Available</span><span>{side === 'buy' ? `${formatUsd(usdHolding)}` : `${formatNum(assetHolding, 6)} ${selected}`}</span></div>
              {orderType === 'market' && <div><span>Current price</span><span>{formatUsd(currentPrice)}</span></div>}
              <div><span>Total</span><span>{formatUsd(total || 0)}</span></div>
            </div>

            <button className={`btn ${side === 'sell' ? 'danger' : ''}`} style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Processing...' : `${side === 'buy' ? 'Buy' : 'Sell'} ${selected}`}
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}
