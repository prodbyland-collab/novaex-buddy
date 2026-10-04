import { useCallback, useEffect, useState, useRef } from "react";

export default function AuditHistory({ service }) {
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
    [r.action, r.actor_label, r.target_label, r.target_id, r.outcome].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  return (
    <div className="audit-history">
      <div className="ac-toolbar">
        <input
          aria-label="Filter this audit page"
          placeholder="Filter this page by admin, account or action…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={loading} onClick={load}>
          {loading ? "Loading…" : "Refresh audit"}
        </button>
      </div>
      {error && (
        <p className="ac-notice ac-error" role="alert">
          {error}
        </p>
      )}
      <div className="ac-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Time · Georgia</th>
              <th>Administrator</th>
              <th>Action / target</th>
              <th>Outcome</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Tbilisi" })}
                </td>
                <td>{r.actor_label}</td>
                <td>
                  {r.action}
                  <small>{r.target_label ?? r.target_id ?? "System-wide"}</small>
                </td>
                <td>
                  <span className="ac-tag">{r.outcome}</span>
                  {r.error_message && <small>{r.error_message}</small>}
                </td>
                <td>
                  <details>
                    <summary>View changes</summary>
                    <pre>{JSON.stringify(r.details, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!error && !loading && !rows.length && (
        <p className="ac-empty">No audit entries match this page.</p>
      )}
      <footer className="ac-pagination">
        <small>
          50 entries per page · Pending means the external outcome is not yet confirmed.
        </small>
        <div className="ac-actions">
          <button disabled={loading || page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>{page + 1}</span>
          <button disabled={loading || !result?.hasMore} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
