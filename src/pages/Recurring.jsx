import { useEffect, useState, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { MARKETS, formatUsd } from '@/lib/markets';
import { fetchRecurringBuys, createRecurringBuy, toggleRecurringBuy, deleteRecurringBuy } from '@/lib/api';

export default function Recurring() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const data = await fetchRecurringBuys(user.id);
    setPlans(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid USD amount', 'error'); return; }
    setSubmitting(true);
    try {
      await createRecurringBuy(user.id, symbol, amt, frequency);
      showToast(`Recurring buy created: ${formatUsd(amt)} of ${symbol} ${frequency}`);
      setAmount('');
      await load();
    } catch (err) {
      showToast(err.message || 'Failed to create plan', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id, active) {
    await toggleRecurringBuy(id, !active);
    await load();
  }

  async function handleDelete(id) {
    await deleteRecurringBuy(id);
    showToast('Recurring buy deleted');
    await load();
  }

  return (
    <div className="fade-up">
      <h1 className="page-title">Recurring Buys</h1>
      <p className="page-sub">Automate your investments on a schedule that works for you.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Active plans */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Your plans</h3>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : plans.length === 0 ? (
            <div className="empty-state">
              <span>↻</span>
              <p>No recurring buys yet. Set one up to automate your investing.</p>
              <Link className="btn small" to="/app/markets" style={{ marginTop: 16 }}>Or trade manually</Link>
            </div>
          ) : (
            plans.map(p => {
              const market = MARKETS.find(m => m.symbol === p.symbol);
              return (
                <div key={p.id} className="recurring-row">
                  <div className="recurring-info">
                    <b className="asset-icon" style={{ background: market?.color || '#c15df5' }}>{market?.icon || p.symbol[0]}</b>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="recurring-amount">{formatUsd(p.amount_usd)}</span>
                        <span className="muted-2" style={{ fontSize: 13 }}>of {p.symbol}</span>
                      </div>
                      <div className="muted-2" style={{ fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                        {p.frequency} {p.active ? '· active' : '· paused'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className={`toggle ${p.active ? 'on' : ''}`} onClick={() => handleToggle(p.id, p.active)} />
                    <button className="btn small ghost" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create form */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>New recurring buy</h3>
          <form onSubmit={handleSubmit} className="trade-panel">
            <div className="field">
              <label>Asset</label>
              <select value={symbol} onChange={e => setSymbol(e.target.value)}>
                {MARKETS.map(m => (
                  <option key={m.symbol} value={m.symbol}>{m.name} ({m.symbol})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount (USD per purchase)</label>
              <input type="number" step="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="100" />
            </div>
            <div className="field">
              <label>Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create plan →'}
            </button>
          </form>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <div style={{ height: 24 }} />
    </div>
  );
}
