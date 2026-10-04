import { formatDateTime } from "@/lib/locale";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getNotifications, markNotificationsRead } from "@/lib/member.functions";
import { useI18n } from "@/lib/i18n";
import RetryNotice from "./RetryNotice";

export default function NotificationCenter() {
  const { lang, t } = useI18n();
  const ka = lang === "ka";
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getNotifications());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const visible = rows.filter((r) => !r.expires_at || Date.parse(r.expires_at) > now);
  const unread = visible.filter((r) => !r.notification_reads?.length).length;
  async function markRead() {
    setBusy(true);
    try {
      await markNotificationsRead();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const labels = ka
    ? {
        deposit: "დეპოზიტი ჩაირიცხა",
        plan: "გეგმა გააქტიურდა",
        code: "დღიური კოდი გამოქვეყნდა",
        payout: "მოგება ჩაირიცხა",
      }
    : {
        deposit: "Deposit credited",
        plan: "Plan activated",
        code: "Daily code published",
        payout: "Daily profit credited",
      };
  return (
    <div className="notification-center">
      <button
        className="notification-toggle"
        aria-label={`${ka ? "შეტყობინებები" : "Notifications"}${unread ? ` (${unread})` : ""}`}
        aria-expanded={open}
        aria-controls="notification-inbox"
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
        {error && !unread && <span>!</span>}
      </button>
      {open && (
        <section
          id="notification-inbox"
          className="notification-inbox"
          aria-label={ka ? "შეტყობინებები" : "Notifications"}
        >
          <div className="member-inbox-heading">
            <strong>{ka ? "შეტყობინებები" : "Notifications"}</strong>
            <button
              className="btn small ghost"
              onClick={() => setOpen(false)}
              aria-label={ka ? "დახურვა" : "Close notifications"}
            >
              ×
            </button>
          </div>
          <RetryNotice error={error} onRetry={load} busy={loading} />
          {loading && !rows.length && !error && (
            <p role="status">{ka ? "იტვირთება…" : "Loading…"}</p>
          )}
          {!loading && !error && !visible.length && (
            <p className="muted">{ka ? "შეტყობინებები ჯერ არ არის." : "No notifications yet."}</p>
          )}
          {visible.map((r) => (
            <Link
              key={r.id}
              to={
                r.kind === "code" ? "/app/group" : r.kind === "plan" ? "/app/orders" : "/app/wallet"
              }
              className={`notification-item ${r.notification_reads?.length ? "" : "unread"}`}
              onClick={() => setOpen(false)}
            >
              <strong>{labels[r.kind]}</strong>
              <span>
                {r.kind === "code"
                  ? `${ka ? "კოდი" : "Code"}: ${r.details.code}`
                  : r.kind === "plan"
                    ? t(String(r.details.plan ?? ""))
                    : `${Number(r.details.amount ?? 0).toFixed(2)} USD`}
              </span>
              <small>{formatDateTime(r.created_at, lang)}</small>
            </Link>
          ))}
          <div className="member-inbox-heading">
            <small>{ka ? "ბოლო 50 შეტყობინება" : "Latest 50 notifications"}</small>
            <button
              className="btn small ghost"
              disabled={busy || loading || !unread}
              onClick={markRead}
            >
              {ka ? "ყველას წაკითხვა" : "Mark all read"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
