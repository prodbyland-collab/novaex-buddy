import { formatDateTime } from "@/lib/locale";
import { translateMessage } from "@/lib/ui-translations";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wallet as WalletIcon } from "lucide-react";
import RetryNotice from "@/components/RetryNotice";
import HistoryPagination from "@/components/HistoryPagination";
import PageHeading from "@/components/PageHeading";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  createCryptoDeposit,
  fetchCryptoDeposits,
  createWithdrawal,
  fetchWithdrawals,
  fetchMinDeposits,
  fetchDepositMinimum,
  WITHDRAWAL_FEE_PCT,
} from "@/lib/api";
import { syncMyDeposits } from "@/lib/deposits.functions";

import { usePortfolio } from "@/lib/portfolio";

function formatAmount(value, lang) {
  return Number(value).toLocaleString(lang === "ka" ? "ka-GE" : "en-US", {
    maximumFractionDigits: 8,
  });
}

function formatDate(value, lang) {
  return formatDateTime(value, lang);
}

export default function Wallet() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [depositError, setDepositError] = useState("");
  const [withdrawalError, setWithdrawalError] = useState("");
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [minimumAttempt, setMinimumAttempt] = useState(0);
  const [currencyAttempt, setCurrencyAttempt] = useState(0);
  const [depositPage, setDepositPage] = useState(0);
  const [withdrawalPage, setWithdrawalPage] = useState(0);
  const [currency, setCurrency] = useState("btc");
  const [amountUsd, setAmountUsd] = useState("");
  const [deposits, setDeposits] = useState([]);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [currencies, setCurrencies] = useState([]);
  const [minsLoading, setMinsLoading] = useState(true);
  const { holdings, prices, reload } = usePortfolio();
  const [withdrawals, setWithdrawals] = useState([]);
  const [wSymbol, setWSymbol] = useState("USD");
  const [wAmount, setWAmount] = useState("");
  const [wAddress, setWAddress] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const withdrawalRequest = useRef(null);

  const loadDeposits = useCallback(async () => {
    if (!user) return;
    try {
      const sync = await syncMyDeposits()
        .then((result) => {
          setSyncError("");
          return result;
        })
        .catch(() => {
          setSyncError(t("wallet.historyError"));
          return null;
        });
      if (sync?.updated) reload?.();
      const data = await fetchCryptoDeposits(user.id);
      setDeposits(data);
      setDepositError("");
      // Completed deposits live only in the history list; the instructions
      // card shows pending deposits only.
      const active = data.filter(
        (d) =>
          !d.credited_at &&
          ["creating", "waiting", "confirming", "partially_paid", "sending"].includes(d.status),
      );
      setSelectedDeposit((current) => {
        if (current) {
          const still = active.find((item) => item.id === current.id);
          if (still) return still;
        }
        return active[0] || null;
      });
    } catch {
      setDepositError(t("wallet.historyError"));
    } finally {
      setLoading(false);
    }
  }, [user, t, reload]);

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
          setCurrencyError("");
          setCurrency((current) =>
            result.length && !result.some((item) => item.currency === current)
              ? result[0].currency
              : current,
          );
        }
      } catch {
        if (alive) setCurrencyError(t("wallet.depositError"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [currencyAttempt, t]);

  const [minUsd, setMinUsd] = useState(null);
  const [minError, setMinError] = useState("");

  // Fetch the live NOWPayments minimum for the selected currency.
  useEffect(() => {
    if (!currency) return;
    let alive = true;
    setMinsLoading(true);
    setMinError("");
    setMinUsd(null);
    (async () => {
      try {
        const result = await fetchDepositMinimum(currency);
        if (!alive) return;
        setMinUsd(result?.minUsd ?? null);
      } catch (err) {
        if (alive) setMinError(err?.message || t("wallet.depositError"));
      } finally {
        if (alive) setMinsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [currency, t, minimumAttempt]);

  useEffect(() => {
    if (minsLoading || minUsd === null) return;
    setAmountUsd((prev) => (!prev || Number(prev) < minUsd ? String(minUsd) : prev));
  }, [minUsd, minsLoading]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (minUsd === null) {
      setError(minError || t("wallet.minLoading"));
      return;
    }
    if (Number(amountUsd) < minUsd) {
      setError(t("wallet.minNote", { cur: currency.toUpperCase(), min: minUsd }));
      return;
    }

    setCreating(true);
    try {
      const deposit = await createCryptoDeposit(currency, Number(amountUsd));
      setSelectedDeposit(deposit);
      await loadDeposits();
      setNotice(t("wallet.depositReady"));
    } catch {
      setError(t("wallet.depositError"));
    } finally {
      setCreating(false);
    }
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1800);
  }

  const loadWithdrawals = useCallback(async () => {
    if (!user) return;
    try {
      setWithdrawals(await fetchWithdrawals(user.id));
      setWithdrawalError("");
    } catch {
      setWithdrawalError("Could not load withdrawal history. Please retry.");
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const available = holdings.find((h) => h.symbol === wSymbol)?.amount ?? 0;
  const unitPrice = wSymbol === "USD" ? 1 : (prices?.[wSymbol]?.price ?? 0);
  const requested = Number(wAmount || 0);
  const feeAmount = requested * WITHDRAWAL_FEE_PCT;
  const netAmount = requested - feeAmount;

  async function handleWithdraw(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setWithdrawing(true);
    try {
      const amount = Number(wAmount);
      const fingerprint = JSON.stringify([wSymbol, amount, wAddress.trim()]);
      if (withdrawalRequest.current?.fingerprint !== fingerprint)
        withdrawalRequest.current = { fingerprint, id: crypto.randomUUID() };
      await createWithdrawal(
        user.id,
        wSymbol,
        amount,
        wAddress,
        amount * unitPrice,
        withdrawalRequest.current.id,
      );
      withdrawalRequest.current = null;
      setWAmount("");
      setWAddress("");
      await Promise.all([loadWithdrawals(), reload()]);
      setNotice(t("wallet.withdrawDone"));
    } catch (err) {
      setError(err?.message || t("wallet.withdrawError"));
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="fade-up wallet-page">
      <PageHeading icon={WalletIcon} title={t("wallet.title")}>
        {t("wallet.sub")}
      </PageHeading>
      <RetryNotice error={currencyError} onRetry={() => setCurrencyAttempt((v) => v + 1)} />
      <RetryNotice
        error={minError}
        onRetry={() => setMinimumAttempt((v) => v + 1)}
        busy={minsLoading}
      />
      <RetryNotice error={syncError} onRetry={loadDeposits} />

      <div className="wallet-grid">
        <div className="card">
          <p className="eyebrow">{t("wallet.newDeposit")}</p>
          <h2 className="wallet-card-title">{t("wallet.fund")}</h2>
          <p className="wallet-help">{t("wallet.fundHelp")}</p>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>{t("wallet.currency")}</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((item) => (
                  <option key={item.currency} value={item.currency}>
                    {item.currency.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("wallet.value")}</label>
              <input
                type="number"
                min={minUsd ?? 500}
                max="100000"
                step="1"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                onBlur={() => {
                  if (amountUsd !== "" && minUsd !== null && Number(amountUsd) < minUsd)
                    setAmountUsd(String(minUsd));
                }}
                required
              />
              <span
                className="field-hint"
                style={
                  amountUsd !== "" && minUsd !== null && Number(amountUsd) < minUsd
                    ? { color: "#f6465d" }
                    : undefined
                }
              >
                {minsLoading
                  ? t("wallet.minLoading")
                  : minError
                    ? minError
                    : minUsd === null
                      ? t("wallet.minLoading")
                      : t("wallet.minMax", { min: minUsd })}
              </span>
            </div>
            <button
              className="btn"
              disabled={
                creating ||
                minsLoading ||
                minUsd === null ||
                !currencies.length ||
                amountUsd === "" ||
                Number(amountUsd) < minUsd
              }
              style={{ width: "100%", justifyContent: "center" }}
            >
              {creating ? t("wallet.creating") : t("wallet.createAddress")}
            </button>
          </form>
        </div>

        <div className="card deposit-detail-card">
          <p className="eyebrow">{t("wallet.instructions")}</p>
          {selectedDeposit ? (
            <>
              <div className="deposit-status-row">
                <div>
                  <span className="muted-2">{t("wallet.status")}</span>
                  <strong className="deposit-status">{t(selectedDeposit.status)}</strong>
                </div>
                <div className="deposit-currency">{selectedDeposit.pay_currency.toUpperCase()}</div>
              </div>
              <div className="deposit-amount-box">
                <span>{t("wallet.sendExactly")}</span>
                <strong>
                  {formatAmount(selectedDeposit.pay_amount, lang)}{" "}
                  {selectedDeposit.pay_currency.toUpperCase()}
                </strong>
                <small>
                  {t("wallet.worth", { amount: Number(selectedDeposit.price_amount).toFixed(2) })}
                </small>
              </div>
              <label className="address-label">{t("wallet.address")}</label>
              <div className="address-box">
                <span>{selectedDeposit.pay_address || t("wallet.preparing")}</span>
                {selectedDeposit.pay_address && (
                  <button
                    className="btn small ghost"
                    onClick={() => copy(selectedDeposit.pay_address, "address")}
                  >
                    {copied === "address" ? t("common.copied") : t("common.copy")}
                  </button>
                )}
              </div>
              <p className="wallet-warning">
                {t("wallet.warning", { cur: selectedDeposit.pay_currency.toUpperCase() })}
              </p>
              <p className="deposit-created">
                {t("wallet.created", { date: formatDate(selectedDeposit.created_at, lang) })}
              </p>
            </>
          ) : (
            <div className="empty-state wallet-empty">
              <span>+</span>
              <p>{t("wallet.emptyDeposit")}</p>
            </div>
          )}
        </div>
      </div>

      {(error || notice) && (
        <div className={`toast ${error ? "error" : "success"}`}>
          {translateMessage(error || notice, lang)}
        </div>
      )}

      <div className="wallet-grid">
        <div className="card">
          <p className="eyebrow">{t("wallet.withdraw")}</p>
          <h2 className="wallet-card-title">{t("wallet.withdrawTitle")}</h2>
          <p className="wallet-help">{t("wallet.withdrawHelp")}</p>
          <form onSubmit={handleWithdraw}>
            <div className="field">
              <label>{t("wallet.assetLabel")}</label>
              <select value={wSymbol} onChange={(e) => setWSymbol(e.target.value)}>
                <option value="USD">USD</option>
                {holdings
                  .filter((h) => h.symbol !== "USD")
                  .map((h) => (
                    <option key={h.symbol} value={h.symbol}>
                      {h.symbol}
                    </option>
                  ))}
              </select>
              <span className="field-hint">
                {t("wallet.available", { amount: formatAmount(available, lang), sym: wSymbol })}
              </span>
            </div>
            <div className="field">
              <label>{t("wallet.amount")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={wAmount}
                onChange={(e) => setWAmount(e.target.value)}
                required
              />
              <span className="field-hint">
                {t("wallet.approx", { amount: (requested * unitPrice).toFixed(2) })}
              </span>
            </div>
            <div className="trade-summary" style={{ marginBottom: 16 }}>
              <div>
                <span>{t("wallet.commission")}</span>
                <span className="loss">
                  -{formatAmount(feeAmount, lang)} {wSymbol}
                </span>
              </div>
              <div>
                <span>{t("wallet.youReceive")}</span>
                <span>
                  {formatAmount(netAmount > 0 ? netAmount : 0, lang)} {wSymbol}
                </span>
              </div>
            </div>
            <div className="field">
              <label>{t("wallet.destination")}</label>
              <input
                type="text"
                value={wAddress}
                onChange={(e) => setWAddress(e.target.value)}
                placeholder={t("wallet.destinationPlaceholder")}
                required
              />
            </div>
            <button
              className="btn"
              disabled={withdrawing}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {withdrawing ? t("wallet.processing") : t("wallet.withdrawBtn")}
            </button>
          </form>
        </div>

        <div className="card">
          <p className="eyebrow">{t("wallet.activity")}</p>
          <h2 className="wallet-card-title">{t("wallet.withdrawHistory")}</h2>
          <RetryNotice error={withdrawalError} onRetry={loadWithdrawals} />
          {withdrawalsLoading ? (
            <p role="status">{t("wallet.processing")}</p>
          ) : withdrawalError ? null : withdrawals.length === 0 ? (
            <p className="muted-2">{t("wallet.noWithdrawals")}</p>
          ) : (
            <div className="deposit-history-list">
              {withdrawals.slice(withdrawalPage * 20, (withdrawalPage + 1) * 20).map((w) => (
                <div key={w.id} className="deposit-history-row">
                  <span>
                    <strong>{w.symbol}</strong>
                    <small>{formatDate(w.created_at, lang)}</small>
                  </span>
                  <span>
                    <strong>{formatAmount(w.amount, lang)}</strong>
                    <small>
                      {t("wallet.net")} {formatAmount(w.net_amount ?? w.amount, lang)} ·{" "}
                      {t("wallet.fee")} {formatAmount(w.fee_amount ?? 0, lang)}
                    </small>
                  </span>
                  <span className="badge badge-teal">{t(w.status)}</span>
                </div>
              ))}
            </div>
          )}
          <HistoryPagination
            page={withdrawalPage}
            setPage={setWithdrawalPage}
            count={withdrawals.length}
          />
        </div>
      </div>

      <div className="card deposit-history-card">
        <div className="wallet-section-heading">
          <div>
            <p className="eyebrow">{t("wallet.activity")}</p>
            <h2 className="wallet-card-title">{t("wallet.depositHistory")}</h2>
          </div>
          <span className="muted-2">{t("wallet.autoUpdates")}</span>
        </div>
        <RetryNotice error={depositError} onRetry={loadDeposits} busy={loading} />
        {loading ? (
          <p className="muted">{t("wallet.loadingDeposits")}</p>
        ) : depositError ? null : deposits.length === 0 ? (
          <p className="muted-2">{t("wallet.noDeposits")}</p>
        ) : (
          <div className="deposit-history-list">
            {deposits.slice(depositPage * 20, (depositPage + 1) * 20).map((deposit) => {
              const done =
                Boolean(deposit.credited_at) ||
                !["creating", "waiting", "confirming", "partially_paid", "sending"].includes(
                  deposit.status,
                );
              return (
                <button
                  key={deposit.id}
                  className={`deposit-history-row ${selectedDeposit?.id === deposit.id ? "selected" : ""}`}
                  onClick={() => !done && setSelectedDeposit(deposit)}
                >
                  <span>
                    <strong>{deposit.pay_currency.toUpperCase()}</strong>
                    <small>{formatDate(deposit.created_at, lang)}</small>
                  </span>
                  <span>
                    <strong>{formatAmount(deposit.pay_amount || 0, lang)}</strong>
                    <small>${Number(deposit.price_amount).toFixed(2)} USD</small>
                  </span>
                  <span className="badge badge-teal">{t(deposit.status)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <HistoryPagination page={depositPage} setPage={setDepositPage} count={deposits.length} />
    </div>
  );
}
