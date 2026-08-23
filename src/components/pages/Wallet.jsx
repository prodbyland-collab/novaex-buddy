import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { createCryptoDeposit, fetchCryptoDeposits } from '@/lib/api';

const currencies = [
  { value: 'btc', label: 'Bitcoin', symbol: 'BTC' },
  { value: 'eth', label: 'Ethereum', symbol: 'ETH' },
  { value: 'sol', label: 'Solana', symbol: 'SOL' },
  { value: 'usdttrc20', label: 'Tether', symbol: 'USDT TRC20' },
];

function formatAmount(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Wallet() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('btc');
  const [amountUsd, setAmountUsd] = useState('100');
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [testWithdrawal, setTestWithdrawal] = useState(false);

  const loadDeposits = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchCryptoDeposits(user.id);
      setDeposits(data);
      setSelectedDeposit(current => current ? data.find(item => item.id === current.id) || current : data[0] || null);
    } catch {
      setError('Could not load your deposit history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDeposits();
    const interval = setInterval(loadDeposits, 10000);
    return () => clearInterval(interval);
  }, [loadDeposits]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setCreating(true);
    try {
      const deposit = await createCryptoDeposit(currency, Number(amountUsd));
      setSelectedDeposit(deposit);
      await loadDeposits();
      setNotice('Your deposit address is ready. Send the exact crypto amount shown below.');
    } catch {
      setError('Could not create a deposit address. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  }

  function handleTestWithdrawal() {
    setTestWithdrawal(true);
    setNotice('Test withdrawal complete. No funds were moved and no payout was sent.');
  }

  return (
    <div className="fade-up wallet-page">
      <h1 className="page-title">Wallet</h1>
      <p className="page-sub">Deposit crypto through a secure NOWPayments payment address.</p>

      <div className="wallet-grid">
        <div className="card">
          <p className="eyebrow">New deposit</p>
          <h2 className="wallet-card-title">Fund your account</h2>
          <p className="wallet-help">Each deposit creates a private payment address for your account. Your balance is updated only after the payment is confirmed by NOWPayments.</p>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Cryptocurrency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                {currencies.map(item => <option key={item.value} value={item.value}>{item.label} ({item.symbol})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Deposit value (USD)</label>
              <input type="number" min="10" max="100000" step="1" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} required />
              <span className="field-hint">Minimum $10 · Maximum $100,000</span>
            </div>
            <button className="btn" disabled={creating} style={{ width: '100%', justifyContent: 'center' }}>
              {creating ? 'Creating address...' : 'Create deposit address'}
            </button>
          </form>

          <div className="test-withdraw-card">
            <div>
              <strong>Test withdrawal</strong>
              <p>Simulation only. This does not send crypto or change your balance.</p>
            </div>
            <button className="btn small ghost" onClick={handleTestWithdrawal}>{testWithdrawal ? 'Tested' : 'Run test'}</button>
          </div>
        </div>

        <div className="card deposit-detail-card">
          <p className="eyebrow">Deposit instructions</p>
          {selectedDeposit ? (
            <>
              <div className="deposit-status-row">
                <div>
                  <span className="muted-2">Status</span>
                  <strong className="deposit-status">{selectedDeposit.status.replace('_', ' ')}</strong>
                </div>
                <div className="deposit-currency">{selectedDeposit.pay_currency.toUpperCase()}</div>
              </div>
              <div className="deposit-amount-box">
                <span>Send exactly</span>
                <strong>{formatAmount(selectedDeposit.pay_amount)} {selectedDeposit.pay_currency.toUpperCase()}</strong>
                <small>Worth ${Number(selectedDeposit.price_amount).toFixed(2)} USD</small>
              </div>
              <label className="address-label">Deposit address</label>
              <div className="address-box">
                <span>{selectedDeposit.pay_address || 'Address is being prepared...'}</span>
                {selectedDeposit.pay_address && <button className="btn small ghost" onClick={() => copy(selectedDeposit.pay_address, 'address')}>{copied === 'address' ? 'Copied' : 'Copy'}</button>}
              </div>
              <p className="wallet-warning">Send only {selectedDeposit.pay_currency.toUpperCase()} to this address. Sending another asset or network can permanently lose funds.</p>
              <p className="deposit-created">Created {formatDate(selectedDeposit.created_at)}</p>
            </>
          ) : (
            <div className="empty-state wallet-empty">
              <span>+</span>
              <p>Create a deposit to receive a unique payment address.</p>
            </div>
          )}
        </div>
      </div>

      {(error || notice) && <div className={`toast ${error ? 'error' : 'success'}`}>{error || notice}</div>}

      <div className="card deposit-history-card">
        <div className="wallet-section-heading">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 className="wallet-card-title">Deposit history</h2>
          </div>
          <span className="muted-2">Updates automatically</span>
        </div>
        {loading ? <p className="muted">Loading deposits...</p> : deposits.length === 0 ? <p className="muted-2">No deposits yet.</p> : (
          <div className="deposit-history-list">
            {deposits.map(deposit => (
              <button key={deposit.id} className={`deposit-history-row ${selectedDeposit?.id === deposit.id ? 'selected' : ''}`} onClick={() => setSelectedDeposit(deposit)}>
                <span><strong>{deposit.pay_currency.toUpperCase()}</strong><small>{formatDate(deposit.created_at)}</small></span>
                <span><strong>{formatAmount(deposit.pay_amount || 0)}</strong><small>${Number(deposit.price_amount).toFixed(2)} USD</small></span>
                <span className="badge badge-teal">{deposit.status.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
