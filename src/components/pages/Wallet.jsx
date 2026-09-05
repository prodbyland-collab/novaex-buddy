import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { createCryptoDeposit, fetchCryptoDeposits, createWithdrawal, fetchWithdrawals, fetchMinDeposits, fetchDepositMinimum, WITHDRAWAL_FEE_PCT } from '@/lib/api';

import { usePortfolio } from '@/lib/portfolio';

function formatAmount(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function Wallet() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [currency, setCurrency] = useState('btc');
  const [amountUsd, setAmountUsd] = useState('');
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const [currencies, setCurrencies] = useState([]);
  const [minsLoading, setMinsLoading] = useState(true);
  const { holdings, prices, reload } = usePortfolio();
  const [withdrawals, setWithdrawals] = useState([]);
  const [wSymbol, setWSymbol] = useState('USD');
  const [wAmount, setWAmount] = useState('');
  const [wAddress, setWAddress] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadDeposits = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchCryptoDeposits(user.id);
      setDeposits(data);
      setSelectedDeposit(current => current ? data.find(item => item.id === current.id) || current : data[0] || null);
    } catch {
      setError(t('wallet.historyError'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    loadDeposits();
    const interval = setInterval(loadDeposits, 10000);
    return () => clearInterval(interval);
  }, [loadDeposits]);

  // Network minimums come straight from NOWPayments.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await fetchMinDeposits();
        if (alive) {
          setCurrencies(result);
          if (result.length && !result.some(item => item.currency === currency)) setCurrency(result[0].currency);
        }
      } catch {
        /* currency list unavailable */
      }

    })();
    return () => { alive = false; };
  }, []);

  const [minUsd, setMinUsd] = useState(null);
  const [minError, setMinError] = useState('');

  // Fetch the live NOWPayments minimum for the selected currency.
  useEffect(() => {
    if (!currency) return;
    let alive = true;
    setMinsLoading(true);
    setMinError('');
    setMinUsd(null);
    (async () => {
      try {
        const result = await fetchDepositMinimum(currency);
        if (!alive) return;
        setMinUsd(result?.minUsd ?? null);
      } catch (err) {
        if (alive) setMinError(err?.message || t('wallet.depositError'));
      } finally {
        if (alive) setMinsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [currency, t]);

  useEffect(() => {
    if (minsLoading || minUsd === null) return;
    setAmountUsd(prev => (!prev || Number(prev) < minUsd ? String(minUsd) : prev));
  }, [minUsd, minsLoading]);


  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (Number(amountUsd) < minUsd) {
      setError(t('wallet.minNote', { cur: currency.toUpperCase(), min: minUsd }));
      return;
    }
    setCreating(true);
    try {
      const deposit = await createCryptoDeposit(currency, Number(amountUsd));
      setSelectedDeposit(deposit);
      await loadDeposits();
      setNotice(t('wallet.depositReady'));
    } catch {
      setError(t('wallet.depositError'));
    } finally {
      setCreating(false);
    }
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  }

  const loadWithdrawals = useCallback(async () => {
    if (!user) return;
    try {
      setWithdrawals(await fetchWithdrawals(user.id));
    } catch {
      /* history is non-critical */
    }
  }, [user]);

  useEffect(() => { loadWithdrawals(); }, [loadWithdrawals]);

  const available = holdings.find(h => h.symbol === wSymbol)?.amount ?? 0;
  const unitPrice = wSymbol === 'USD' ? 1 : (prices?.[wSymbol] ?? 0);
  const requested = Number(wAmount || 0);
  const feeAmount = requested * WITHDRAWAL_FEE_PCT;
  const netAmount = requested - feeAmount;

  async function handleWithdraw(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setWithdrawing(true);
    try {
      const amount = Number(wAmount);
      await createWithdrawal(user.id, wSymbol, amount, wAddress, amount * unitPrice);
      setWAmount('');
      setWAddress('');
      await Promise.all([loadWithdrawals(), reload()]);
      setNotice(t('wallet.withdrawDone'));
    } catch (err) {
      setError(err?.message || t('wallet.withdrawError'));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="fade-up wallet-page">
      <h1 className="page-title">{t('wallet.title')}</h1>
      <p className="page-sub">{t('wallet.sub')}</p>

      <div className="wallet-grid">
        <div className="card">
          <p className="eyebrow">{t('wallet.newDeposit')}</p>
          <h2 className="wallet-card-title">{t('wallet.fund')}</h2>
          <p className="wallet-help">{t('wallet.fundHelp')}</p>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>{t('wallet.currency')}</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                {currencies.map(item => <option key={item.currency} value={item.currency}>{item.currency.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('wallet.value')}</label>
              <input type="number" min={minUsd} max="100000" step="1" value={amountUsd} onChange={e => setAmountUsd(e.target.value)} required />
              <span className="field-hint">
                {minsLoading ? t('wallet.minLoading') : t('wallet.minMax', { min: minUsd })}
              </span>
            </div>
            <button className="btn" disabled={creating || minsLoading || !currencies.length} style={{ width: '100%', justifyContent: 'center' }}>
              {creating ? t('wallet.creating') : t('wallet.createAddress')}
            </button>
          </form>
        </div>

        <div className="card deposit-detail-card">
          <p className="eyebrow">{t('wallet.instructions')}</p>
          {selectedDeposit ? (
            <>
              <div className="deposit-status-row">
                <div>
                  <span className="muted-2">{t('wallet.status')}</span>
                  <strong className="deposit-status">{selectedDeposit.status.replace('_', ' ')}</strong>
                </div>
                <div className="deposit-currency">{selectedDeposit.pay_currency.toUpperCase()}</div>
              </div>
              <div className="deposit-amount-box">
                <span>{t('wallet.sendExactly')}</span>
                <strong>{formatAmount(selectedDeposit.pay_amount)} {selectedDeposit.pay_currency.toUpperCase()}</strong>
                <small>{t('wallet.worth', { amount: Number(selectedDeposit.price_amount).toFixed(2) })}</small>
              </div>
              <label className="address-label">{t('wallet.address')}</label>
              <div className="address-box">
                <span>{selectedDeposit.pay_address || t('wallet.preparing')}</span>
                {selectedDeposit.pay_address && <button className="btn small ghost" onClick={() => copy(selectedDeposit.pay_address, 'address')}>{copied === 'address' ? t('common.copied') : t('common.copy')}</button>}
              </div>
              <p className="wallet-warning">{t('wallet.warning', { cur: selectedDeposit.pay_currency.toUpperCase() })}</p>
              <p className="deposit-created">{t('wallet.created', { date: formatDate(selectedDeposit.created_at) })}</p>
            </>
          ) : (
            <div className="empty-state wallet-empty">
              <span>+</span>
              <p>{t('wallet.emptyDeposit')}</p>
            </div>
          )}
        </div>
      </div>

      {(error || notice) && <div className={`toast ${error ? 'error' : 'success'}`}>{error || notice}</div>}

      <div className="wallet-grid">
        <div className="card">
          <p className="eyebrow">{t('wallet.withdraw')}</p>
          <h2 className="wallet-card-title">{t('wallet.withdrawTitle')}</h2>
          <p className="wallet-help">{t('wallet.withdrawHelp')}</p>
          <form onSubmit={handleWithdraw}>
            <div className="field">
              <label>{t('wallet.assetLabel')}</label>
              <select value={wSymbol} onChange={e => setWSymbol(e.target.value)}>
                <option value="USD">USD</option>
                {holdings.filter(h => h.symbol !== 'USD').map(h => (
                  <option key={h.symbol} value={h.symbol}>{h.symbol}</option>
                ))}
              </select>
              <span className="field-hint">{t('wallet.available', { amount: formatAmount(available), sym: wSymbol })}</span>
            </div>
            <div className="field">
              <label>{t('wallet.amount')}</label>
              <input type="number" min="0" step="any" value={wAmount} onChange={e => setWAmount(e.target.value)} required />
              <span className="field-hint">{t('wallet.approx', { amount: (requested * unitPrice).toFixed(2) })}</span>
            </div>
            <div className="trade-summary" style={{ marginBottom: 16 }}>
              <div><span>{t('wallet.commission')}</span><span className="loss">-{formatAmount(feeAmount)} {wSymbol}</span></div>
              <div><span>{t('wallet.youReceive')}</span><span>{formatAmount(netAmount > 0 ? netAmount : 0)} {wSymbol}</span></div>
            </div>
            <div className="field">
              <label>{t('wallet.destination')}</label>
              <input type="text" value={wAddress} onChange={e => setWAddress(e.target.value)} placeholder={t('wallet.destinationPlaceholder')} required />
            </div>
            <button className="btn" disabled={withdrawing} style={{ width: '100%', justifyContent: 'center' }}>
              {withdrawing ? t('wallet.processing') : t('wallet.withdrawBtn')}
            </button>
          </form>
        </div>

        <div className="card">
          <p className="eyebrow">{t('wallet.activity')}</p>
          <h2 className="wallet-card-title">{t('wallet.withdrawHistory')}</h2>
          {withdrawals.length === 0 ? <p className="muted-2">{t('wallet.noWithdrawals')}</p> : (
            <div className="deposit-history-list">
              {withdrawals.map(w => (
                <div key={w.id} className="deposit-history-row">
                  <span><strong>{w.symbol}</strong><small>{formatDate(w.created_at)}</small></span>
                  <span>
                    <strong>{formatAmount(w.amount)}</strong>
                    <small>{t('wallet.net')} {formatAmount(w.net_amount ?? w.amount)} · {t('wallet.fee')} {formatAmount(w.fee_amount ?? 0)}</small>
                  </span>
                  <span className="badge badge-teal">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card deposit-history-card">
        <div className="wallet-section-heading">
          <div>
            <p className="eyebrow">{t('wallet.activity')}</p>
            <h2 className="wallet-card-title">{t('wallet.depositHistory')}</h2>
          </div>
          <span className="muted-2">{t('wallet.autoUpdates')}</span>
        </div>
        {loading ? <p className="muted">{t('wallet.loadingDeposits')}</p> : deposits.length === 0 ? <p className="muted-2">{t('wallet.noDeposits')}</p> : (
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
