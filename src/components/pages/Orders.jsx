import { useEffect, useState, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useLivePrices } from '@/lib/useLivePrices';
import { MARKET_MAP, formatUsd, formatNum } from '@/lib/markets';
import { fetchOrders, cancelOrder } from '@/lib/api';

export default function Orders() {
  const { user } = useAuth();
  const prices = useLivePrices();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const data = await fetchOrders(user.id);
    setOrders(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id) {
    await cancelOrder(id);
    showToast('Order cancelled');
    await load();
  }

  function showToast(msg) {
    setToast({ msg });
    setTimeout(() => setToast(null), 3000);
  }

  const openOrders = orders.filter(o => o.status === 'open');
  const filledOrders = orders.filter(o => o.status === 'filled');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  function renderRow(o) {
    const market = MARKET_MAP[o.symbol];
    const currentPrice = prices[o.symbol]?.price ?? market?.price ?? 0;
    return (
      <div key={o.id} className="order-row">
        <span>
          <span className={`badge ${o.side === 'buy' ? 'badge-green' : 'badge-red'}`}>{o.side}</span>
        </span>
        <span>{o.symbol}</span>
        <span className="muted">{o.type}</span>
        <span>{formatNum(o.amount, 6)}</span>
        <span>{formatUsd(o.price)}</span>
        <span>
          {o.status === 'open' ? (
            <span className="badge badge-teal">open</span>
          ) : o.status === 'filled' ? (
            <span className="badge badge-green">filled</span>
          ) : (
            <span className="badge badge-muted">cancelled</span>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {o.status === 'open' && (
            <button className="btn small ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleCancel(o.id)}>Cancel</button>
          )}
          {o.status === 'open' && o.type === 'limit' && o.side === 'buy' && currentPrice <= o.price && (
            <span className="badge badge-green">ready</span>
          )}
          {o.status === 'open' && o.type === 'limit' && o.side === 'sell' && currentPrice >= o.price && (
            <span className="badge badge-green">ready</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <h1 className="page-title">Orders</h1>
      <p className="page-sub">Your open limit orders and trade history.</p>

      {/* Open orders */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Open orders</h3>
          <Link className="text-link" to="/app/markets">New order →</Link>
        </div>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : openOrders.length === 0 ? (
          <div className="empty-state">
            <span>⏱</span>
            <p>No open orders. Place a limit order from the Markets page.</p>
            <Link className="btn small" to="/app/markets" style={{ marginTop: 16 }}>Go to Markets</Link>
          </div>
        ) : (
          <>
            <div className="order-head">
              <span>Side</span><span>Asset</span><span>Type</span><span>Amount</span><span>Price</span><span>Status</span><span></span>
            </div>
            {openOrders.map(renderRow)}
          </>
        )}
      </div>

      {/* Trade history */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Trade history</h3>
        {filledOrders.length === 0 ? (
          <p className="muted-2" style={{ fontSize: 13, padding: '20px 0' }}>No completed trades yet.</p>
        ) : (
          <>
            <div className="order-head">
              <span>Side</span><span>Asset</span><span>Type</span><span>Amount</span><span>Price</span><span>Status</span><span></span>
            </div>
            {filledOrders.map(renderRow)}
          </>
        )}
      </div>

      {/* Cancelled */}
      {cancelledOrders.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Cancelled orders</h3>
          <div className="order-head">
            <span>Side</span><span>Asset</span><span>Type</span><span>Amount</span><span>Price</span><span>Status</span><span></span>
          </div>
          {cancelledOrders.map(renderRow)}
        </div>
      )}

      {toast && <div className="toast success">{toast.msg}</div>}
    </div>
  );
}
