import { useCallback, useEffect, useState } from "react";
import { Bot } from "lucide-react";
import RetryNotice from "@/components/RetryNotice";
import PageHeading from "@/components/PageHeading";
import { useAuth } from "@/lib/auth";
import { usePortfolio } from "@/lib/portfolio";
import { useI18n } from "@/lib/i18n";
import { formatUsd, formatNum } from "@/lib/markets";
import {
  fetchAiSettings,
  setTradingMode,
  fetchAiTrades,
  redeemAiCode,
  fetchReferralInfo,
} from "@/lib/api";

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function AiTrading() {
  const { user } = useAuth();
  const { usdBalance, reload } = usePortfolio();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(null);
  const [trades, setTrades] = useState([]);
  const [referral, setReferral] = useState(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [s, tr, r] = await Promise.all([
        fetchAiSettings(user.id),
        fetchAiTrades(user.id),
        fetchReferralInfo(),
      ]);
      setSettings(s);
      setTrades(tr);
      setReferral(r);
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Could not load trading settings.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function choose(mode) {
    if (!user) return;
    setBusy(true);
    try {
      const next = await setTradingMode(user.id, mode);
      setSettings(next);
      showToast(mode === "ai" ? t("ai.aiActivated") : t("ai.manualActivated"));
    } catch (err) {
      showToast(err.message || t("ai.modeError"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const result = await redeemAiCode(code.trim());
      if (result?.ok) {
        setCode("");
        await load();
        await reload();
        showToast(result.message || t("ai.codeUnlocked"));
      } else {
        showToast(result?.message || t("ai.codeInvalid"), "error");
      }
    } catch (err) {
      showToast(err.message || t("ai.codeInvalid"), "error");
    } finally {
      setRedeeming(false);
    }
  }

  const aiOn = !!settings?.enabled;
  const boosted = settings?.boost_date === utcToday();
  const planRate = Number(settings?.plan_rate ?? settings?.daily_rate ?? 0.01);
  const boostRate = boosted ? 0.01 : 0;
  const bonusRate = Number(referral?.bonus_rate ?? 0);
  const rate = planRate + boostRate + bonusRate;
  const dailyPct = (rate * 100).toFixed(2);
  const projectedDaily = usdBalance * rate;
  const refCount = Number(referral?.referrals ?? 0);
  const inviteLink = referral?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth?ref=${referral.code}`
    : "";

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fade-up ai-page">
      <PageHeading icon={Bot} title={t("ai.title")}>
        {t("ai.sub")}
      </PageHeading>
      <RetryNotice error={loadError} onRetry={load} busy={loading} />
      {loading && <p role="status">{t("wallet.processing")}</p>}
      {!loading && !loadError && (
        <>
          <div className="ai-workspace">
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
              <div
                className="card"
                style={{ border: aiOn ? "1px solid rgba(20,184,166,0.55)" : undefined }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{t("ai.aiTitle")}</h3>
                  {aiOn && (
                    <span className="badge badge-teal">
                      {boosted ? t("ai.boosted") : t("ai.active")}
                    </span>
                  )}
                </div>
                <p className="muted-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {t("ai.aiDesc", { pct: dailyPct })}
                </p>
                <div className="trade-summary" style={{ marginTop: 16 }}>
                  <div>
                    <span>{t("ai.cash")}</span>
                    <span>{formatUsd(usdBalance)}</span>
                  </div>
                  <div>
                    <span>{t("ai.target")}</span>
                    <span className="gain">+{formatUsd(projectedDaily)}</span>
                  </div>
                  <div>
                    <span>{t("ref.bonus")}</span>
                    <span className="gain">+{(bonusRate * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span>{t("ai.earned")}</span>
                    <span className="gain">+{formatUsd(settings?.total_profit ?? 0)}</span>
                  </div>
                  <div>
                    <span>{t("ai.lastPayout")}</span>
                    <span>{settings?.last_payout_date ?? "—"}</span>
                  </div>
                </div>

                {!aiOn && (
                  <button
                    className="btn"
                    style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
                    disabled={busy || loading || !!loadError}
                    onClick={() => choose("ai")}
                  >
                    {t("ai.enableAi")}
                  </button>
                )}
              </div>
            </div>

            <div
              className="card"
              style={{
                marginTop: 24,
                border: boosted ? "1px solid rgba(20,184,166,0.55)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t("ai.boostTitle")}</h3>
                {boosted && <span className="badge badge-teal">{t("ai.boostBadge")}</span>}
              </div>
              <p className="muted-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {t("ai.boostDesc")}
              </p>
              <a className="btn small ghost" href="/app/group" style={{ marginTop: 14 }}>
                {t("ai.openGroup")}
              </a>
              <form
                onSubmit={submitCode}
                style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}
              >
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="GNG-XXXXXXXX"
                  style={{ flex: "1 1 200px", minWidth: 0 }}
                  disabled={redeeming || boosted}
                />
                <button className="btn" disabled={redeeming || boosted || !code.trim()}>
                  {boosted
                    ? t("ai.boostApplied")
                    : redeeming
                      ? t("ai.checking")
                      : t("ai.applyCode")}
                </button>
              </form>
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t("ref.title")}</h3>
                {bonusRate >= 0.01 && <span className="badge badge-teal">{t("ref.max")}</span>}
              </div>
              <p className="muted-2" style={{ fontSize: 13, lineHeight: 1.6 }}>
                {t("ref.desc")}
              </p>

              <label className="address-label" style={{ marginTop: 14, display: "block" }}>
                {t("ref.link")}
              </label>
              <div className="address-box">
                <span>{inviteLink || "—"}</span>
                {inviteLink && (
                  <button className="btn small ghost" type="button" onClick={copyLink}>
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                )}
              </div>

              <div className="trade-summary" style={{ marginTop: 16 }}>
                <div>
                  <span>{t("ref.code")}</span>
                  <span>{referral?.code ?? "—"}</span>
                </div>
                <div>
                  <span>{t("ref.invited")}</span>
                  <span>{refCount}</span>
                </div>
                <div>
                  <span>{t("ref.bonus")}</span>
                  <span className="gain">+{(bonusRate * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span>{t("ref.effective")}</span>
                  <span className="gain">{dailyPct}%</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
                {t("ai.activity")}
              </h3>
              {trades.length === 0 ? (
                <p className="muted-2" style={{ fontSize: 13 }}>
                  {t("ai.noTrades")}
                </p>
              ) : (
                <div className="market-table">
                  <div className="table-head">
                    <span>{t("ai.asset")}</span>
                    <span>{t("ai.side")}</span>
                    <span>{t("ai.size")}</span>
                    <span>{t("ai.price")}</span>
                    <span>{t("ai.profit")}</span>
                  </div>
                  {trades.map((tr) => (
                    <div className="table-row" key={tr.id}>
                      <span>{tr.symbol}</span>
                      <span className={tr.side === "sell" ? "loss" : "gain"}>
                        {tr.side === "credit" ? t("ai.credit") : tr.side.toUpperCase()}
                      </span>
                      <span>{formatNum(tr.amount, 6)}</span>
                      <span>{formatUsd(tr.price)}</span>
                      <span className="gain">+{formatUsd(tr.profit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
          </div>
        </>
      )}
    </div>
  );
}
