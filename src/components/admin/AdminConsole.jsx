import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toCsv } from "@/lib/admin-tools";
import AuditHistory from "./AuditHistory";

const assets = ["USD", "BTC", "ETH", "SOL", "XRP", "BNB", "LTC", "DOGE", "TRX", "USDT"];
const money = (v) => Number(v ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
const date = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        timeZone: "Asia/Tbilisi",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
function Tag({ children }) {
  return <span className="ac-tag">{children}</span>;
}

function AccountPanel({ account: a, viewerId, disabled, services, run, close, payments, copy }) {
  const [symbol, setSymbol] = useState("USD");
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState(a.planId);
  const [enabled, setEnabled] = useState(a.aiEnabled);
  useEffect(() => {
    setPlan(a.planId);
    setEnabled(a.aiEnabled);
  }, [a.planId, a.aiEnabled]);
  const own = a.id === viewerId;
  const boost = a.boostDate === new Date().toISOString().slice(0, 10);
  const balance =
    symbol === "USD" ? a.usd : (a.assets.find((asset) => asset.symbol === symbol)?.amount ?? 0);
  return (
    <aside className="ac-panel" aria-label="Account details">
      <div className="ac-heading">
        <div>
          <span className="ac-eyebrow">ACCOUNT DETAILS</span>
          <h2>{a.email || a.id}</h2>
        </div>
        <button onClick={close} aria-label="Close account details">
          ×
        </button>
      </div>
      <div className="ac-tags">
        <Tag>{a.suspended ? "Suspended" : "Active"}</Tag>
        <Tag>{a.isAdmin ? "Admin" : "Member"}</Tag>
        <Tag>{a.mfaEnabled ? "MFA on" : "MFA off"}</Tag>
      </div>
      <button className="ac-id" onClick={() => copy(a.id)} title="Copy account ID">
        {a.id} · Copy
      </button>
      <dl className="ac-facts">
        <dt>Joined</dt>
        <dd>{date(a.createdAt)}</dd>
        <dt>Last sign-in</dt>
        <dd>{date(a.lastSignInAt)}</dd>
        <dt>Email</dt>
        <dd>{a.emailConfirmed ? "Verified" : "Unverified"}</dd>
        <dt>Profit / referrals</dt>
        <dd>
          {money(a.totalProfit)} / {a.referrals}
        </dd>
        <dt>Last payout</dt>
        <dd>{a.lastPayout ?? "—"}</dd>
      </dl>
      <button onClick={() => payments(a.id)}>View payments</button>
      <fieldset disabled={disabled}>
        <legend>Balance adjustment</legend>
        <div className="ac-form-row">
          <label>
            Asset
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {assets.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
              <option value="set">Set balance</option>
            </select>
          </label>
        </div>
        <small>
          Current: {Number(balance).toLocaleString("en-US", { maximumFractionDigits: 8 })} {symbol}
        </small>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(amount);
            if (
              !amount.trim() ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > 1e12 ||
              (mode !== "set" && value === 0)
            )
              return;
            if (!window.confirm(`${mode} ${value} ${symbol} for ${a.email}?`)) return;
            run(
              () =>
                mode === "set"
                  ? services.setBalance({ data: { userId: a.id, symbol, amount: value } })
                  : services.adjustBalance({
                      data: { userId: a.id, symbol, delta: mode === "remove" ? -value : value },
                    }),
              "Balance updated",
            ).then((ok) => {
              if (ok) setAmount("");
            });
          }}
        >
          <label>
            Amount
            <input
              type="number"
              min="0"
              max="1000000000000"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button className="ac-primary" type="submit">
            Apply adjustment
          </button>
        </form>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>AI trading</legend>
        <label>
          Plan
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {["free", "pro", "elite"].map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Trading enabled
        </label>
        <div className="ac-actions">
          <button
            onClick={() =>
              run(
                () => services.setPlan({ data: { userId: a.id, planId: plan, enabled } }),
                "Trading settings saved",
              )
            }
          >
            Save settings
          </button>
          <button
            onClick={() =>
              run(
                () => services.setBoost({ data: { userId: a.id, grant: !boost } }),
                "Boost updated",
              )
            }
          >
            {boost ? "Remove boost" : "Grant today's boost"}
          </button>
        </div>
      </fieldset>
      <fieldset disabled={disabled || own}>
        <legend>Account access{own ? " · Your account" : ""}</legend>
        <div className="ac-actions">
          <button
            onClick={() => {
              if (window.confirm(`${a.suspended ? "Restore" : "Suspend"} sign-in for ${a.email}?`))
                run(
                  () =>
                    services.setAccountAccess({ data: { userId: a.id, suspended: !a.suspended } }),
                  "Sign-in access updated",
                );
            }}
          >
            {a.suspended ? "Restore sign-in" : "Suspend sign-in"}
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  `${a.isAdmin ? "Remove" : "Grant"} administrator access for ${a.email}?`,
                )
              )
                run(
                  () => services.setAdminRole({ data: { userId: a.id, makeAdmin: !a.isAdmin } }),
                  "Role updated",
                );
            }}
          >
            {a.isAdmin ? "Remove admin" : "Make admin"}
          </button>
        </div>
        <small>
          Suspension blocks new sign-ins. Existing sessions may remain active until their token
          expires.
        </small>
      </fieldset>
      <details className="ac-danger">
        <summary>Delete account</summary>
        <p>Permanently deletes this account and its associated records.</p>
        <button
          disabled={disabled || own}
          onClick={() => {
            if (window.confirm(`Permanently delete ${a.email}? This cannot be undone.`))
              run(() => services.deleteUser({ data: { userId: a.id } }), "Account deleted").then(
                (ok) => {
                  if (ok) close();
                },
              );
          }}
        >
          Delete permanently
        </button>
      </details>
    </aside>
  );
}

export default function AdminConsole({ services, viewerId, initialData = null }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("users");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [auto, setAuto] = useState(false);
  const [notice, setNotice] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [news, setNews] = useState("");
  const lock = useRef(false);
  const refreshing = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    try {
      const result = await services.overview();
      if (mounted.current) {
        setData(result);
        setUpdated(Date.now());
        setStale(false);
      }
      return true;
    } catch (error) {
      if (mounted.current) {
        setStale(true);
        setNotice({ error: true, text: error.message || "Could not load administrator data" });
      }
      return false;
    } finally {
      refreshing.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [services]);
  useEffect(() => {
    mounted.current = true;
    if (!initialData) load();
    return () => {
      mounted.current = false;
    };
  }, [initialData, load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (!lock.current) load();
    }, 30000);
    return () => clearInterval(timer);
  }, [auto, load]);
  const run = async (operation, message) => {
    if (lock.current || refreshing.current || stale) return false;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await operation();
      setNotice({
        text: typeof result?.paid === "number" ? `${result.paid} accounts paid` : message,
      });
      const refreshed = await load();
      if (!refreshed)
        setNotice({
          error: true,
          text: `${message}. Refresh failed; refresh before making another change.`,
        });
      return true;
    } catch (error) {
      setNotice({ error: true, text: error.message || "Action failed" });
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ text: "Copied to clipboard" });
    } catch {
      setNotice({
        error: true,
        text: "Clipboard unavailable. Select and copy the value manually.",
      });
    }
  };
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...(data?.[tab] ?? [])]
      .filter((r) => {
        const matches = [r.email, r.id, r.user_id, r.payment_id, r.address, r.body, r.tx_hash].some(
          (v) =>
            String(v ?? "")
              .toLowerCase()
              .includes(search),
        );
        if (!matches) return false;
        if (filter === "all") return true;
        if (tab !== "users") return r.status === filter;
        return filter === "admin"
          ? r.isAdmin
          : filter === "suspended"
            ? r.suspended
            : filter === "ai"
              ? r.aiEnabled
              : r.usd > 0;
      })
      .sort((a, b) =>
        sort === "amount"
          ? Number(b.usd ?? b.usd_value ?? b.price_amount ?? 0) -
            Number(a.usd ?? a.usd_value ?? a.price_amount ?? 0)
          : sort === "email"
            ? String(a.email ?? "").localeCompare(String(b.email ?? ""))
            : Date.parse(b.createdAt ?? b.created_at) - Date.parse(a.createdAt ?? a.created_at),
      );
  }, [data, tab, query, filter, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * 20, currentPage * 20);
  const account = data?.users.find((u) => u.id === selected);
  const switchTab = (value) => {
    setTab(value);
    setQuery("");
    setFilter("all");
    setPage(1);
  };
  const exportRows = () => {
    const records = rows.map((r) =>
      tab === "users"
        ? {
            id: r.id,
            email: r.email,
            balance_usd: r.usd,
            plan: r.planId,
            trading_enabled: r.aiEnabled,
            admin: r.isAdmin,
            suspended: r.suspended,
            joined: r.createdAt,
          }
        : tab === "announcements"
          ? { id: r.id, body: r.body, created_at: r.created_at }
          : {
              id: r.id,
              email: r.email,
              user_id: r.user_id,
              status: r.status,
              amount: r.amount ?? r.price_amount,
              currency: r.symbol ?? r.price_currency ?? "USD",
              created_at: r.created_at,
            },
    );
    const url = URL.createObjectURL(new Blob([toCsv(records)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `admin-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const code = data?.dailyCode;
  const remaining =
    code && code.code_date === new Date(now).toISOString().slice(0, 10)
      ? Math.max(0, Date.parse(code.sent_at ?? code.created_at) + 600000 - now)
      : 0;
  if (!data)
    return (
      <div className="admin-page admin-compact">
        <h1>Administration</h1>
        {notice && <p role="alert">{notice.text}</p>}
        <button disabled={loading} onClick={load}>
          {loading ? "Loading accounts…" : "Retry loading"}
        </button>
      </div>
    );
  return (
    <div className="admin-page admin-compact">
      <header className="ac-top">
        <div>
          <span className="ac-eyebrow">CONTROL CENTER</span>
          <h1>Administration</h1>
          <p>Accounts, payments and announcements in one place.</p>
        </div>
        <div className="ac-actions">
          <label className="ac-check">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-refresh
          </label>
          <button disabled={busy || loading} onClick={load}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>
      {notice && (
        <div
          className={`ac-notice ${notice.error ? "ac-error" : ""}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.text}
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      <div className="ac-stats">
        {[
          ["Accounts", data.totals.users],
          ["USD balances", money(data.totals.usd)],
          ["Deposited", money(data.totals.depositedUsd)],
          ["Withdrawn", money(data.totals.withdrawnUsd)],
          ["AI enabled", data.totals.aiOn],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <section className="ac-codebar" aria-label="Daily code controls">
        <div>
          <span className="ac-eyebrow">DAILY GROUP CODE</span>
          <strong>{code?.code ?? "No code"}</strong>
          <small>
            {remaining > 0
              ? `Expires in ${Math.floor(remaining / 60000)}:${String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}`
              : "Inactive"}{" "}
            · Daily at 20:00 Georgia · Valid for 10 minutes
          </small>
        </div>
        <div className="ac-actions">
          <button disabled={!code || !remaining} onClick={() => copy(code.code)}>
            Copy
          </button>
          <button
            disabled={busy || loading || stale}
            onClick={() => {
              if (
                window.confirm("Replace the daily code? The new code will be valid for 10 minutes.")
              )
                run(() => services.rotateCode(), "Daily code replaced");
            }}
          >
            Replace code
          </button>
          <button
            disabled={busy || loading || stale}
            onClick={() => {
              if (
                window.confirm(
                  "Run today's payouts now? Accounts already paid today will be skipped.",
                )
              )
                run(() => services.runPayout(), "Payout finished");
            }}
          >
            Run payout
          </button>
        </div>
      </section>
      <div className={`ac-workspace ${account ? "ac-has-panel" : ""}`}>
        <section className="ac-main">
          <nav className="ac-tabs" aria-label="Administrator sections">
            {[
              ["users", "Accounts"],
              ["deposits", "Deposits"],
              ["withdrawals", "Withdrawals"],
              ["announcements", "Announcements"],
              ["audit", "Audit log"],
            ].map(([key, title]) => (
              <button key={key} aria-pressed={tab === key} onClick={() => switchTab(key)}>
                {title}
                {key !== "audit" && <span>{data[key]?.length ?? 0}</span>}
              </button>
            ))}
          </nav>
          {tab === "audit" ? (
            <AuditHistory service={services.auditHistory} />
          ) : (
            <>
              <div className="ac-toolbar">
                <input
                  aria-label="Search records"
                  placeholder={
                    tab === "announcements"
                      ? "Search announcements…"
                      : "Search email, ID or reference…"
                  }
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
                {tab !== "announcements" && (
                  <select
                    aria-label="Filter records"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All {tab === "users" ? "accounts" : "statuses"}</option>
                    {(tab === "users"
                      ? ["admin", "suspended", "ai", "funded"]
                      : [...new Set(data[tab].map((r) => r.status))]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {value === "ai" ? "AI enabled" : value}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label="Sort records"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="newest">Newest first</option>
                  {tab !== "announcements" && <option value="email">Email A–Z</option>}
                  {tab !== "announcements" && <option value="amount">Highest USD value</option>}
                </select>
                <button disabled={!rows.length} onClick={exportRows}>
                  Export CSV
                </button>
              </div>
              {tab === "announcements" ? (
                <div className="ac-news">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        () => services.publishNews({ data: { body: news.trim() } }),
                        "Announcement published",
                      ).then((ok) => {
                        if (ok) setNews("");
                      });
                    }}
                  >
                    <label>
                      New group announcement
                      <textarea
                        required
                        minLength={1}
                        maxLength={2000}
                        value={news}
                        onChange={(e) => setNews(e.target.value)}
                        placeholder="Write a message for your members…"
                      />
                    </label>
                    <div className="ac-actions">
                      <small>{news.length}/2000</small>
                      <button
                        className="ac-primary"
                        disabled={busy || loading || stale || !news.trim()}
                      >
                        Publish announcement
                      </button>
                    </div>
                  </form>
                  {visible.map((r) => (
                    <article key={r.id}>
                      <p>{r.body}</p>
                      <div className="ac-actions">
                        <small>{date(r.created_at)}</small>
                        <button
                          disabled={busy || loading || stale}
                          onClick={() => {
                            if (window.confirm("Delete this announcement?"))
                              run(
                                () =>
                                  services.deleteAnnouncement({ data: { announcementId: r.id } }),
                                "Announcement deleted",
                              );
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ac-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {(tab === "users"
                          ? ["Account", "USD balance", "Trading", "Access", "Joined", ""]
                          : ["Account / reference", "Amount", "Status", "Created", "Actions"]
                        ).map((label, i) => (
                          <th key={i}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) =>
                        tab === "users" ? (
                          <tr key={r.id} className={r.id === selected ? "ac-selected" : ""}>
                            <td>
                              <strong>{r.email || "No email"}</strong>
                              <small>
                                {r.id.slice(0, 8)} · {r.referrals} referrals
                              </small>
                            </td>
                            <td>{money(r.usd)}</td>
                            <td>
                              <Tag>{r.planId}</Tag>
                              <small>AI {r.aiEnabled ? "on" : "off"}</small>
                            </td>
                            <td>
                              <Tag>
                                {r.suspended ? "Suspended" : r.isAdmin ? "Admin" : "Member"}
                              </Tag>
                            </td>
                            <td>{date(r.createdAt)}</td>
                            <td>
                              <button
                                aria-label={`Manage ${r.email || r.id}`}
                                onClick={() => setSelected(r.id)}
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="ac-text-button"
                                onClick={() => setSelected(r.user_id)}
                              >
                                {r.email}
                              </button>
                              <button
                                className="ac-id"
                                title="Copy payment reference"
                                onClick={() => copy(String(r.payment_id ?? r.id))}
                              >
                                {String(r.payment_id ?? r.id).slice(0, 16)} · Copy
                              </button>
                              {r.address && (
                                <small title={r.address}>{r.address.slice(0, 18)}…</small>
                              )}
                            </td>
                            <td>
                              {tab === "deposits"
                                ? money(r.price_amount)
                                : `${Number(r.amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${r.symbol}`}
                              <small>
                                {tab === "deposits"
                                  ? `${r.pay_amount ?? "—"} ${r.pay_currency ?? ""}`
                                  : `Fee ${r.fee_amount ?? 0} ${r.symbol} · Net ${r.net_amount ?? 0}`}
                              </small>
                            </td>
                            <td>
                              <Tag>{r.status}</Tag>
                              {r.credited_at && <small>Credited</small>}
                            </td>
                            <td>{date(r.created_at)}</td>
                            <td>
                              <div className="ac-actions">
                                {tab === "deposits" ? (
                                  !r.credited_at && (
                                    <>
                                      <button
                                        disabled={busy || loading || stale}
                                        onClick={() => {
                                          if (window.confirm("Verify and credit this deposit?"))
                                            run(
                                              () =>
                                                services.updateDeposit({
                                                  data: { depositId: r.id, action: "approve" },
                                                }),
                                              "Deposit credited",
                                            );
                                        }}
                                      >
                                        Verify & credit
                                      </button>
                                      <button
                                        disabled={busy || loading || stale || r.status === "failed"}
                                        onClick={() => {
                                          if (window.confirm("Reject this uncredited deposit?"))
                                            run(
                                              () =>
                                                services.updateDeposit({
                                                  data: { depositId: r.id, action: "reject" },
                                                }),
                                              "Deposit rejected",
                                            );
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )
                                ) : r.refunded_at ? (
                                  <small>Refunded · locked</small>
                                ) : (
                                  ["pending", "completed", "failed"]
                                    .filter((s) => s !== r.status)
                                    .map((status) => (
                                      <button
                                        key={status}
                                        disabled={busy || loading || stale}
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              status === "failed"
                                                ? "Mark failed and refund this withdrawal once?"
                                                : `Mark withdrawal ${status}?`,
                                            )
                                          )
                                            run(
                                              () =>
                                                services.updateWithdrawal({
                                                  data: { withdrawalId: r.id, status },
                                                }),
                                              "Withdrawal updated",
                                            );
                                        }}
                                      >
                                        {status === "failed"
                                          ? "Fail & refund"
                                          : status === "completed"
                                            ? "Complete"
                                            : "Pending"}
                                      </button>
                                    ))
                                )}
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {!rows.length && <p className="ac-empty">No records match your filters.</p>}
              <footer className="ac-pagination">
                <small>
                  {rows.length} matching records
                  {tab === "deposits" || tab === "withdrawals"
                    ? " · Full payment history"
                    : tab === "announcements"
                      ? " · Latest 20 loaded"
                      : ""}
                  {updated ? ` · Updated ${date(updated)}` : ""}
                </small>
                <div className="ac-actions">
                  <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                    Previous
                  </button>
                  <span>
                    {currentPage} / {pages}
                  </span>
                  <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>
                    Next
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
        {account && (
          <AccountPanel
            key={account.id}
            account={account}
            viewerId={viewerId}
            disabled={busy || loading || stale}
            services={services}
            run={run}
            close={() => setSelected(null)}
            copy={copy}
            payments={(id) => {
              switchTab("deposits");
              setQuery(id);
            }}
          />
        )}
      </div>
    </div>
  );
}
