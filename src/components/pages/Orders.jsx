import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { BOT_PLANS } from "@/lib/plans";
import { syncMyDeposits } from "@/lib/deposits.functions";
import {
  fetchAiSettings,
  fetchMinDeposits,
  createPlanPurchase,
  fetchCryptoDeposits,
} from "@/lib/api";

const PENDING = ["creating", "waiting", "confirming", "confirmed", "sending", "partially_paid"];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export default function BotPlans() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const ka = lang === "ka";

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
      await syncMyDeposits().catch(() => null);
      const [s, p] = await Promise.all([
        fetchAiSettings(user.id),
        fetchCryptoDeposits(user.id, "plan"),
      ]);
      setSettings(s);
      setPayments(p || []);
      setSelected((current) => {
        const open = (p || []).filter(
          (payment) => !payment.credited_at && PENDING.includes(payment.status),
        );
        return open.find((payment) => payment.id === current?.id) || open[0] || null;
      });
    } catch {
      setError(ka ? "მონაცემების ჩატვირთვა ვერ მოხერხდა." : "Could not load your plan.");
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
        if (alive && list.length) {
          setCurrencies(list);
          if (!list.some((i) => i.currency === "btc")) setCurrency(list[0].currency);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const activeId = settings?.plan_id ?? "free";
  const activeRate = Number(settings?.plan_rate ?? 0.01);
  const pending = useMemo(() => payments.filter((p) => PENDING.includes(p.status)), [payments]);

  const names = {
    free: ka ? "უფასო AI ტრეიდერი" : "Free AI Trader",
    pro: ka ? "Pro AI ტრეიდერი" : "Pro AI Trader",
    elite: ka ? "Elite AI ტრეიდერი" : "Elite AI Trader",
  };

  async function buy(plan) {
    setError("");
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
    }
  }

  async function copy(value, label) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1800);
  }

  return (
    <div className="fade-up" style={{ maxWidth: 1040 }}>
      <h1 className="page-title">{ka ? "ბოტ-გეგმები" : "Bot Plans"}</h1>
      <p className="page-sub">
        {ka
          ? "აირჩიე AI ბოტის დონე. გადახდა ხდება კრიპტოთი ცალკე — ბალანსიდან თანხა არ ჩამოიჭრება."
          : "Pick your AI bot tier. Plans are paid in crypto separately — nothing is taken from your trading balance."}
      </p>

      <div className="card" style={{ marginTop: 24 }}>
        <p className="eyebrow">{ka ? "აქტიური გეგმა" : "Active plan"}</p>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{names[activeId] || names.free}</div>
        <p className="muted-2">
          {(activeRate * 100).toFixed(0)}% {ka ? "დღეში" : "per day"}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 18,
          marginTop: 18,
        }}
      >
        {BOT_PLANS.map((plan) => {
          const current = plan.id === activeId;
          const owned = activeRate >= plan.rate;
          return (
            <div
              className="card"
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
                {plan.price
                  ? `$${plan.price} ${ka ? "კრიპტოთი" : "in crypto"}`
                  : ka
                    ? "უფასო"
                    : "Free"}
              </p>
              <button
                className={current || owned ? "btn ghost" : "btn"}
                style={{ width: "100%", justifyContent: "center" }}
                disabled={!plan.price || owned || busy === plan.id}
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
            </div>
          );
        })}
      </div>

      {error && (
        <div className="toast error" style={{ marginTop: 18 }}>
          {error}
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
          <p className="eyebrow">{ka ? "მოლოდინში მყოფი გადახდები" : "Pending plan payments"}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {pending.map((p) => (
              <li
                key={p.id}
                className="muted-2"
                style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}
              >
                {names[p.plan_id] || p.plan_id} · {p.pay_currency?.toUpperCase()} · $
                {Number(p.price_amount).toFixed(2)} · {p.status} · {formatDate(p.created_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
