import { formatDateTime } from "@/lib/locale";
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getMemberOverview } from "@/lib/member.functions";
import { codeIsActive } from "@/lib/group";
import { nextDailyTime, countdown } from "@/lib/member-time";
import { useI18n } from "@/lib/i18n";
import RetryNotice from "./RetryNotice";

export default function AccountOverview() {
  const { lang, t } = useI18n();
  const ka = lang === "ka";
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMemberOverview());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [load]);
  const active = data?.code && codeIsActive(data.code, now);
  const activity = [
    ...(data?.deposits ?? []).map((d) => ({
      ...d,
      type: d.purpose === "plan" ? "Plan payment" : "Deposit",
    })),
    ...(data?.withdrawals ?? []).map((w) => ({ ...w, type: "Withdrawal" })),
  ]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);
  return (
    <section
      className="account-overview"
      aria-label={ka ? "ანგარიშის მიმოხილვა" : "Account overview"}
    >
      <RetryNotice error={error} onRetry={load} busy={loading} />
      {!data && loading && <p role="status">{ka ? "იტვირთება…" : "Loading account activity…"}</p>}
      {data && (
        <>
          <div className="member-summary-grid">
            <div className="card">
              <p className="eyebrow">{ka ? "შემდეგი დარიცხვა" : "Next payout run"}</p>
              <strong className="member-countdown">
                {countdown(nextDailyTime(now, 23, 55), now)}
              </strong>
              <p className="muted">
                {ka ? "03:55 საქართველოს დროით · ყოველდღე" : "03:55 Tbilisi time · daily"}
              </p>
              <small>
                {data.settings?.enabled
                  ? ka
                    ? "AI ჩართულია. დარიცხვა დამოკიდებულია უფლებამოსილებასა და დამუშავებაზე."
                    : "AI enabled. Payment depends on eligibility and processing."
                  : ka
                    ? "AI გამორთულია — ჩართე დარიცხვისთვის."
                    : "AI is off. Enable it to qualify for payouts."}
              </small>
            </div>
            <Link to="/app/group" className="card member-code-link">
              <p className="eyebrow">
                {active
                  ? ka
                    ? "კოდი მოქმედებს"
                    : "Code is active"
                  : ka
                    ? "შემდეგი დღიური კოდი"
                    : "Next daily code"}
              </p>
              <strong className="member-countdown">
                {countdown(active ? Date.parse(data.code.expires_at) : nextDailyTime(now, 16), now)}
              </strong>
              <p className="muted">
                {active
                  ? ka
                    ? "ვადის ამოწურვამდე · გახსენი ჩატი"
                    : "Until expiry · open chat"
                  : ka
                    ? "20:00 საქართველოს დროით · 10 წუთი"
                    : "20:00 Tbilisi time · 10 minute window"}
              </p>
            </Link>
          </div>
          <div className="card member-activity">
            <p className="eyebrow">{ka ? "ბოლო აქტივობა" : "Recent account activity"}</p>
            {activity.length ? (
              activity.map((item) => (
                <div key={item.type + item.id} className="member-activity-row">
                  <span>
                    {ka
                      ? {
                          Deposit: "დეპოზიტი",
                          Withdrawal: "გატანა",
                          "Plan payment": "გეგმის გადახდა",
                        }[item.type]
                      : item.type}
                    <small>{formatDateTime(item.created_at, lang)}</small>
                  </span>
                  <span>
                    {item.amount ?? item.price_amount} {item.symbol ?? "USD"}
                    <small>
                      {item.credited_at ? (ka ? "ჩარიცხულია" : "Credited") : t(item.status)}
                    </small>
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">{ka ? "აქტივობა ჯერ არ არის." : "No account activity yet."}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
