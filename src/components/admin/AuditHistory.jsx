import { formatDateTime } from "@/lib/locale";
import { useI18n } from "@/lib/i18n";
import { translateMessage } from "@/lib/ui-translations";
import { useCallback, useEffect, useState, useRef } from "react";

function localizeDetails(value, t) {
  if (Array.isArray(value)) return value.map((item) => localizeDetails(item, t));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [t(key), localizeDetails(item, t)]),
    );
  if (typeof value === "boolean") return t(String(value));
  return typeof value === "string" ? t(value) : value;
}

export default function AuditHistory({ service }) {
  const { t, lang } = useI18n();
  const sequence = useRef(0);
  const [page, setPage] = useState(0),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const next = await service({ data: { page } });
      if (request === sequence.current) setResult(next);
    } catch (e) {
      if (request !== sequence.current) return;
      setError(e.message || "Could not load audit history");
      setResult(null);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [service, page]);
  useEffect(() => {
    load();
    const pending = sequence;
    return () => {
      pending.current++;
    };
  }, [load]);
  const rows = (result?.rows ?? []).filter((r) =>
    [
      r.action,
      t(r.action),
      r.actor_label,
      r.target_label,
      r.target_id,
      r.outcome,
      t(r.outcome),
    ].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  return (
    <div className="audit-history">
      <div className="ac-toolbar">
        <input
          aria-label={t("Filter this audit page")}
          placeholder={t("Filter this page by admin, account or action…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={loading} onClick={load}>
          {loading ? t("Loading…") : t("Refresh audit")}
        </button>
      </div>
      {error && (
        <p className="ac-notice ac-error" role="alert">
          {translateMessage(error, lang)}
        </p>
      )}
      <div className="ac-table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("Time · Georgia")}</th>
              <th>{t("Administrator")}</th>
              <th>{t("Action / target")}</th>
              <th>{t("Outcome")}</th>
              <th>{t("Details")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.created_at, lang)}</td>
                <td>{r.actor_label}</td>
                <td>
                  {t(r.action)}
                  <small>{r.target_label ?? r.target_id ?? t("System-wide")}</small>
                </td>
                <td>
                  <span className="ac-tag">{t(r.outcome)}</span>
                  {r.error_message && <small>{translateMessage(r.error_message, lang)}</small>}
                </td>
                <td>
                  <details>
                    <summary>{t("View changes")}</summary>
                    <pre>{JSON.stringify(localizeDetails(r.details, t), null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!error && !loading && !rows.length && (
        <p className="ac-empty">{t("No audit entries match this page.")}</p>
      )}
      <footer className="ac-pagination">
        <small>
          {t("50 entries per page · Pending means the external outcome is not yet confirmed.")}
        </small>
        <div className="ac-actions">
          <button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>
            {t("Previous")}
          </button>
          <span>{page + 1}</span>
          <button disabled={loading || !result?.hasMore} onClick={() => setPage(page + 1)}>
            {t("Next")}
          </button>
        </div>
      </footer>
    </div>
  );
}
