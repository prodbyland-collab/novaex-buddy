import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  adminOverview,
  adminSetBalance,
  adminSetPlan,
  adminUpdateDeposit,
  adminUpdateWithdrawal,
  adminRotateDailyCode,
  adminRunPayout,
} from '@/lib/admin.functions';
import { BOT_PLANS } from '@/lib/plans';

function usd(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
}
function when(v) {
  return v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
}

export default function Admin() {
  const overview = useServerFn(adminOverview);
  const setBalance = useServerFn(adminSetBalance);
  const setPlan = useServerFn(adminSetPlan);
  const updateDeposit = useServerFn(adminUpdateDeposit);
  const updateWithdrawal = useServerFn(adminUpdateWithdrawal);
  const rotateCode = useServerFn(adminRotateDailyCode);
  const runPayout = useServerFn(adminRunPayout);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    try {
      setData(await overview({}));
      setError('');
    } catch (e) {
      setError(e?.message === 'Forbidden' ? 'You do not have admin access.' : 'Could not load admin data.');
    }
  }, [overview]);

  useEffect(() => { load(); }, [load]);

  async function run(key, fn, message) {
    setBusy(key);
    setNote('');
    setError('');
    try {
      await fn();
      if (message) setNote(message);
      await load();
    } catch (e) {
      setError(e?.message || 'Action failed');
    } finally {
      setBusy('');
    }
  }

  if (error && !data) return <main className="page"><div className="card"><p className="error">{error}</p></div></main>;
  if (!data) return <main className="page"><div className="card"><p className="muted">Loading admin console…</p></div></main>;

  const users = data.users.filter(u => !query || u.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <main className="page admin-page">
      <div className="page-head">
        <div>
          <h1>Admin console</h1>
          <p className="muted">Full control over users, balances, plans, deposits and payouts.</p>
        </div>
        <div className="row-actions">
          <button className="btn small ghost" onClick={load} disabled={!!busy}>Refresh</button>
          <button
            className="btn small"
            disabled={busy === 'payout'}
            onClick={() => run('payout', () => runPayout({}), 'Daily payout executed.')}
          >
            {busy === 'payout' ? 'Running…' : 'Run daily payout'}
          </button>
        </div>
      </div>

      {note && <div className="card success-note">{note}</div>}
      {error && <div className="card"><p className="error">{error}</p></div>}

      <section className="stat-grid">
        <div className="card stat"><span className="muted">Users</span><strong>{data.totals.users}</strong></div>
        <div className="card stat"><span className="muted">Total USD held</span><strong>{usd(data.totals.usd)}</strong></div>
        <div className="card stat"><span className="muted">Credited deposits</span><strong>{data.totals.deposits}</strong></div>
        <div className="card stat"><span className="muted">Withdrawals</span><strong>{data.totals.withdrawals}</strong></div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Today&apos;s boost code</h2>
          <button
            className="btn small ghost"
            disabled={busy === 'code'}
            onClick={() => run('code', () => rotateCode({}), 'New boost code generated.')}
          >
            {busy === 'code' ? 'Rotating…' : 'Rotate code'}
          </button>
        </div>
        <p className="code-value">{data.dailyCode?.code ?? 'Not generated yet'}</p>
        <p className="muted">Date: {data.dailyCode?.code_date ?? '—'} · Sent to Telegram: {when(data.dailyCode?.sent_at)}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Users</h2>
          <input
            className="input"
            placeholder="Search email"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th><th>USD</th><th>Assets</th><th>Plan</th><th>AI</th>
                <th>Profit</th><th>Refs</th><th>Last payout</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const draft = drafts[u.id] ?? {};
                return (
                  <tr key={u.id}>
                    <td>{u.email}<div className="muted tiny">{when(u.createdAt)}</div></td>
                    <td>{usd(u.usd)}</td>
                    <td className="tiny">{u.assets.length ? u.assets.map(a => `${a.amount} ${a.symbol}`).join(', ') : '—'}</td>
                    <td>{u.planId} ({(u.planRate * 100).toFixed(0)}%)</td>
                    <td>{u.aiEnabled ? 'on' : 'off'}</td>
                    <td>{usd(u.totalProfit)}</td>
                    <td>{u.referrals}</td>
                    <td className="tiny">{u.lastPayout ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        <input
                          className="input tiny-input"
                          type="number"
                          min="0"
                          placeholder="USD"
                          value={draft.amount ?? ''}
                          onChange={e => setDrafts(d => ({ ...d, [u.id]: { ...draft, amount: e.target.value } }))}
                        />
                        <button
                          className="btn small ghost"
                          disabled={busy === `bal-${u.id}` || draft.amount === undefined || draft.amount === ''}
                          onClick={() => run(`bal-${u.id}`, () => setBalance({ data: { userId: u.id, symbol: 'USD', amount: Number(draft.amount) } }), `Balance updated for ${u.email}.`)}
                        >
                          Set
                        </button>
                        <select
                          className="input tiny-input"
                          value={u.planId}
                          onChange={e => run(`plan-${u.id}`, () => setPlan({ data: { userId: u.id, planId: e.target.value, enabled: u.aiEnabled } }), `Plan updated for ${u.email}.`)}
                        >
                          {BOT_PLANS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                        </select>
                        <button
                          className="btn small ghost"
                          disabled={busy === `ai-${u.id}`}
                          onClick={() => run(`ai-${u.id}`, () => setPlan({ data: { userId: u.id, planId: u.planId, enabled: !u.aiEnabled } }), `AI ${u.aiEnabled ? 'disabled' : 'enabled'} for ${u.email}.`)}
                        >
                          {u.aiEnabled ? 'Disable AI' : 'Enable AI'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Deposits</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Purpose</th><th>Amount</th><th>Currency</th><th>Status</th><th>Credited</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.deposits.map(d => (
                <tr key={d.id}>
                  <td>{d.email}</td>
                  <td>{d.purpose}{d.plan_id ? ` · ${d.plan_id}` : ''}</td>
                  <td>{usd(d.price_amount)}</td>
                  <td>{String(d.pay_currency).toUpperCase()}</td>
                  <td>{d.status}</td>
                  <td className="tiny">{when(d.credited_at)}</td>
                  <td className="tiny">{when(d.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn small"
                        disabled={!!d.credited_at || busy === `dep-${d.id}`}
                        onClick={() => run(`dep-${d.id}`, () => updateDeposit({ data: { depositId: d.id, action: 'approve' } }), 'Deposit credited.')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn small ghost"
                        disabled={!!d.credited_at || busy === `dep-${d.id}`}
                        onClick={() => run(`dep-${d.id}`, () => updateDeposit({ data: { depositId: d.id, action: 'reject' } }), 'Deposit rejected.')}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.deposits.length && <tr><td colSpan={8} className="muted">No deposits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Withdrawals</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Asset</th><th>Amount</th><th>Fee</th><th>Net</th><th>Address</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {data.withdrawals.map(w => (
                <tr key={w.id}>
                  <td>{w.email}</td>
                  <td>{w.symbol}</td>
                  <td>{w.amount}</td>
                  <td>{usd(w.fee_amount)}</td>
                  <td>{w.net_amount}</td>
                  <td className="tiny truncate">{w.address}</td>
                  <td>{w.status}</td>
                  <td className="tiny">{when(w.created_at)}</td>
                  <td>
                    <select
                      className="input tiny-input"
                      value={w.status}
                      onChange={e => run(`wd-${w.id}`, () => updateWithdrawal({ data: { withdrawalId: w.id, status: e.target.value } }), 'Withdrawal updated.')}
                    >
                      {['pending', 'completed', 'failed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!data.withdrawals.length && <tr><td colSpan={9} className="muted">No withdrawals yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
