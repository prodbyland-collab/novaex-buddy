import { formatDateTime } from "@/lib/locale";
import { translateMessage } from "@/lib/ui-translations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers3 } from "lucide-react";
import RetryNotice from "@/components/RetryNotice";
import PageHeading from "@/components/PageHeading";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { usePortfolio } from "@/lib/portfolio";
import { BOT_PLANS } from "@/lib/plans";
import { syncMyDeposits } from "@/lib/deposits.functions";
import {
  fetchAiSettings,
  fetchMinDeposits,
  createPlanPurchase,
  fetchCryptoDeposits,
  fetchBalancePlanPurchases,
  buyPlanWithBalance,
} from "@/lib/api";

const PENDING = ["creating", "waiting", "confirming", "confirmed", "sending", "partially_paid"];

function formatDate(value, lang) {
  return formatDateTime(value, lang);
}

export default function BotPlans() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const ka = lang === "ka";
  const portfolio = usePortfolio();
  const [balancePlan, setBalancePlan] = useState(null);
  const [success, setSuccess] = useState("");
  const purchaseRequests = useRef({});
  const purchasing = useRef(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [currencyError, setCurrencyError] = useState("");
  const [currencyAttempt, setCurrencyAttempt] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [settings, setSettings] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [currency, setCurrency] = useState("btc");
  const [payments, setPayments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      await syncMyDeposits()
        .then(() => setSyncError(""))
        .catch(() =>
          setSyncError(
            ka
              ? "გადახდის სტატუსის განახლება ვერ მოხერხდა."
              : "Payment status could not be refreshed from the provider.",
          ),
        );
      const [s, cryptoPayments, balancePayments] = await Promise.all([
        fetchAiSettings(user.id),
        fetchCryptoDeposits(user.id, "plan"),
        fetchBalancePlanPurchases(user.id),
      ]);
      const p = [
        ...cryptoPayments,
        ...balancePayments.map((payment) => ({
          ...payment,
          pay_currency: "USD",
          status: "finished",
          credited_at: payment.created_at,
          balance_payment: true,
        })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setSettings(s);
      setLoadError("");
      setPayments(p || []);
      setSelected((current) => {
        const open = (p || []).filter(
          (payment) => !payment.credited_at && PENDING.includes(payment.status),
        );
        return open.find((payment) => payment.id === current?.id) || open[0] || null;
      });
    } catch {
      setLoadError(ka ? "მონაცემების ჩატვირთვა ვერ მოხერხდა." : "Could not load your plan.");
    } finally {
      setLoading(false);
    }
  }, [user, ka]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    let alive = true;
    fetchMinDeposits()
      .then((list) => {
        if (alive) setCurrencyError("");
        if (alive && list.length) {
          setCurrencies(list);
          if (!list.some((i) => i.currency === "btc")) setCurrency(list[0].currency);
        }
      })
      .catch(() => {
        if (alive)
          setCurrencyError(ka ? "ვალუტები ვერ ჩაიტვირთა." : "Could not load supported currencies.");
      });
    return () => {
      alive = false;
    };
  }, [currencyAttempt, ka]);

  const activeId = settings?.plan_id ?? "free";
  const activeRate = Number(settings?.plan_rate ?? 0.01);
  const pending = useMemo(() => payments.filter((p) => PENDING.includes(p.status)), [payments]);

  const names = {
    free: ka ? "უფასო AI ტრეიდერი" : "Free AI Trader",
    pro: ka ? "Pro AI ტრეიდერი" : "Pro AI Trader",
    elite: ka ? "Elite AI ტრეიდერი" : "Elite AI Trader",
  };

  async function buy(plan) {
    if (purchasing.current) return;
    purchasing.current = true;
    setError("");
    setSuccess("");
    setBusy(plan.id);
    try {
      const deposit = await createPlanPurchase(currency, plan.id);
      setSelected(deposit);
      await load();
    } catch (err) {
      setError(
        err?.message || (ka ? "გადახდის შექმნა ვერ მოხერხდა." : "Could not start the payment."),
      );
    } finally {
      setBusy("");
      purchasing.current = false;
    }
  }

  async function buyFromBalance() {
    if (!balancePlan || purchasing.current) return;
    purchasing.current = true;
    const plan = balancePlan;
    setBusy(plan.id);
    setError("");
    setSuccess("");
    purchaseRequests.current[plan.id] ??= crypto.randomUUID();
    try {
      await buyPlanWithBalance(plan.id, purchaseRequests.current[plan.id]);
      delete purchaseRequests.current[plan.id];
      setSettings((current) => ({
        ...current,
        plan_id: plan.id,
        plan_rate: plan.rate,
        enabled: true,
      }));
      setBalancePlan(null);
      setSuccess(t("Plan purchased with balance and activated."));
      await Promise.all([load(), portfolio.reload()]);
    } catch (err) {
      setError(err?.message || "Could not purchase bot plan");
      await Promise.all([load(), portfolio.reload()]);
    } finally {
      purchasing.current = false;
      setBusy("");
    }
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div className="fade-up plans-page">
      <PageHeading icon={Layers3} title={ka ? "ბოტ-გეგმები" : "Bot Plans"}>
        {ka
          ? "აირჩიე AI ბოტის დონე და გადაიხადე USD ბალანსით ან კრიპტოთი. ბალანსით შეძენისას გეგმა მაშინვე აქტიურდება."
          : "Choose your AI bot tier and pay with your USD balance or crypto. Balance purchases activate immediately."}
      </PageHeading>
      <RetryNotice error={loadError} onRetry={load} busy={loading} />
      <RetryNotice error={syncError} onRetry={load} />
      <RetryNotice error={currencyError} onRetry={() => setCurrencyAttempt((v) => v + 1)} />
      {loading && <p role="status">{ka ? "იტვირთება…" : "Loading your plan…"}</p>}
      {!loading && !loadError && (
        <>
          <div className="card" style={{ marginTop: 24 }}>
            <p className="eyebrow">{ka ? "აქტიური გეგმა" : "Active plan"}</p>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{names[activeId] || names.free}</div>
            <p className="muted-2">
              {(activeRate * 100).toFixed(0)}% {ka ? "დღეში" : "per day"}
            </p>
            <p className="muted-2">
              {t("Available USD balance")}:{" "}
              {portfolio.loading || portfolio.error
                ? "—"
                : `$${Number(portfolio.usdBalance).toFixed(2)}`}
            </p>
          </div>

          <div className="field" style={{ maxWidth: 320, marginTop: 24 }}>
            <label>{ka ? "გადახდის ვალუტა" : "Pay with"}</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(currencies.length ? currencies : [{ currency: "btc" }]).map((item) => (
                <option key={item.currency} value={item.currency}>
                  {item.currency.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="plan-grid">
            {BOT_PLANS.map((plan) => {
              const current = plan.id === activeId;
              const owned = activeRate >= plan.rate;
              return (
                <div
                  className={`card plan-card ${current ? "plan-current" : ""}`}
                  key={plan.id}
                  style={{ border: current ? "1px solid var(--teal)" : undefined }}
                >
                  <h2 style={{ fontSize: 18 }}>{names[plan.id]}</h2>
                  <div className="gain" style={{ fontSize: 28, fontWeight: 800, margin: "14px 0" }}>
                    {(plan.rate * 100).toFixed(0)}% <small>{ka ? "დღეში" : "per day"}</small>
                  </div>
                  <p className="muted-2">
                    {ka ? "ყოველდღიური მოგება ბალანსზე" : "Daily profit on your balance"}
                  </p>
                  <p style={{ margin: "16px 0", fontWeight: 700 }}>
                    {plan.price ? `$${plan.price}` : ka ? "უფასო" : "Free"}
                  </p>
                  <button
                    className={current || owned ? "btn ghost" : "btn"}
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={
                      !plan.price ||
                      owned ||
                      !!busy ||
                      loading ||
                      !!loadError ||
                      !!currencyError ||
                      !currencies.length
                    }
                    onClick={() => buy(plan)}
                  >
                    {owned
                      ? ka
                        ? "აქტიური"
                        : "Active"
                      : busy === plan.id
                        ? ka
                          ? "მიმდინარეობს..."
                          : "Starting..."
                        : ka
                          ? "ყიდვა კრიპტოთი"
                          : "Buy with crypto"}
                  </button>
                  {!owned && !!plan.price && (
                    <button
                      className="btn ghost"
                      style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                      disabled={
                        !!busy ||
                        portfolio.loading ||
                        !!portfolio.error ||
                        portfolio.usdBalance < plan.price
                      }
                      onClick={() => {
                        setBalancePlan(plan);
                        setError("");
                        setSuccess("");
                      }}
                    >
                      {t("Buy with balance")}
                    </button>
                  )}
                  {!owned &&
                    !!plan.price &&
                    !portfolio.loading &&
                    !portfolio.error &&
                    portfolio.usdBalance < plan.price && (
                      <p className="muted-2">{t("Insufficient USD balance")}</p>
                    )}
                </div>
              );
            })}
          </div>

          {balancePlan && (
            <div className="card" style={{ marginTop: 18 }}>
              <h2>{t("Confirm balance purchase")}</h2>
              <p>
                {names[balancePlan.id]} · ${balancePlan.price}
              </p>
              <p className="muted-2">{t("This amount will be deducted from your USD balance.")}</p>
              <button
                className="btn"
                disabled={
                  !!busy ||
                  portfolio.loading ||
                  !!portfolio.error ||
                  portfolio.usdBalance < balancePlan.price
                }
                onClick={buyFromBalance}
              >
                {busy ? t("Processing...") : t("Confirm purchase")}
              </button>
              <button className="btn ghost" disabled={!!busy} onClick={() => setBalancePlan(null)}>
                {t("Cancel")}
              </button>
            </div>
          )}
          {success && (
            <p role="status" className="gain">
              {success}
            </p>
          )}

          {error && (
            <div className="toast error" style={{ marginTop: 18 }}>
              {translateMessage(error, lang)}
            </div>
          )}

          {selected && (
            <div className="card" style={{ marginTop: 24 }}>
              <p className="eyebrow">{ka ? "გადაიხადე ამ მისამართზე" : "Send payment to"}</p>
              <h2 style={{ fontSize: 18 }}>
                {names[selected.plan_id] || ""} · {selected.pay_currency?.toUpperCase()}
              </h2>
              <p className="muted-2" style={{ wordBreak: "break-all", marginTop: 12 }}>
                {selected.pay_address}
              </p>
              <p style={{ fontWeight: 700, marginTop: 8 }}>
                {selected.pay_amount} {selected.pay_currency?.toUpperCase()} ($
                {Number(selected.price_amount).toFixed(2)})
              </p>
              <button
                className="btn ghost"
                style={{ marginTop: 12 }}
                onClick={() => copy(selected.pay_address, "addr")}
              >
                {copied === "addr"
                  ? ka
                    ? "დაკოპირდა"
                    : "Copied"
                  : ka
                    ? "მისამართის კოპირება"
                    : "Copy address"}
              </button>
              <p className="muted-2" style={{ marginTop: 12 }}>
                {ka
                  ? "გადახდის დადასტურების შემდეგ გეგმა ავტომატურად გააქტიურდება."
                  : "Your plan activates automatically once the payment is confirmed."}
              </p>
            </div>
          )}

          {pending.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <p className="eyebrow">
                {ka ? "მოლოდინში მყოფი გადახდები" : "Pending plan payments"}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
                {pending.map((p) => (
                  <li
                    key={p.id}
                    className="muted-2"
                    style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}
                  >
                    {names[p.plan_id] || p.plan_id} · {p.pay_currency?.toUpperCase()} · $
                    {Number(p.price_amount).toFixed(2)} · {t(p.status)} ·{" "}
                    {formatDate(p.created_at, lang)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card member-activity">
            <p className="eyebrow">
              {ka ? "გეგმების გადახდის სრული ისტორია" : "Full plan payment history"}
            </p>
            {payments.slice(historyPage * 20, (historyPage + 1) * 20).map((p) => (
              <div className="member-activity-row" key={p.id}>
                <span>
                  {names[p.plan_id] || p.plan_id}
                  <small>
                    {formatDate(p.created_at, lang)} ·{" "}
                    {p.balance_payment ? t("USD balance") : p.pay_currency?.toUpperCase()}
                  </small>
                </span>
                <span>
                  ${Number(p.price_amount).toFixed(2)}
                  <small>{p.credited_at ? (ka ? "გააქტიურდა" : "Activated") : t(p.status)}</small>
                </span>
              </div>
            ))}
            {!payments.length && (
              <p className="muted">{ka ? "გადახდები ჯერ არ არის." : "No plan payments yet."}</p>
            )}
            <div className="history-pagination">
              <button
                className="btn small ghost"
                aria-label={ka ? "წინა გვერდი" : "Previous page"}
                disabled={!historyPage}
                onClick={() => setHistoryPage((v) => v - 1)}
              >
                ←
              </button>
              <span>
                {historyPage + 1} / {Math.max(1, Math.ceil(payments.length / 20))}
              </span>
              <button
                className="btn small ghost"
                aria-label={ka ? "შემდეგი გვერდი" : "Next page"}
                disabled={(historyPage + 1) * 20 >= payments.length}
                onClick={() => setHistoryPage((v) => v + 1)}
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
