import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { getGroupFeed, publishGroupNews } from "@/lib/group.functions";
import { codeIsActive } from "@/lib/group";

export default function Group() {
  const { lang } = useI18n();
  const ka = lang === "ka";
  const [feed, setFeed] = useState({ posts: [], isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [news, setNews] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    try {
      setFeed(await getGroupFeed());
      setError("");
    } catch (err) {
      setError(err?.message || "Could not load the group. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      setNow(Date.now());
      load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function publish(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await publishGroupNews({ data: { body: news } });
      setNews("");
      await load();
    } catch (err) {
      setError(err?.message || "Could not publish news. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 800 }}>
      <h1 className="page-title">{ka ? "ჩატის ჯგუფი" : "Chat group"}</h1>
      <p className="page-sub">
        {ka
          ? "დღიური კოდი ქვეყნდება 20:00-ზე საქართველოს დროით და მოქმედებს ერთი საათი."
          : "The daily code is posted at 20:00 Tbilisi time and expires after one hour."}
      </p>
      {error && (
        <p role="alert" className="loss">
          {error}
        </p>
      )}
      <button className="btn small ghost" onClick={load}>
        {ka ? "განახლება" : "Refresh"}
      </button>
      {feed.isAdmin && (
        <form className="card" onSubmit={publish} style={{ marginTop: 20 }}>
          <label htmlFor="group-news">{ka ? "სიახლის გამოქვეყნება" : "Publish news"}</label>
          <textarea
            id="group-news"
            value={news}
            onChange={(event) => setNews(event.target.value)}
            maxLength={3000}
            required
            rows={4}
            style={{
              width: "100%",
              margin: "12px 0",
              padding: 12,
              color: "var(--text)",
              background: "var(--bg)",
            }}
          />
          <button className="btn small" disabled={busy || !news.trim()}>
            {ka ? "გამოქვეყნება" : "Publish"}
          </button>
        </form>
      )}
      {loading && <p>{ka ? "იტვირთება…" : "Loading…"}</p>}
      {!loading && !feed.posts.length && (
        <p className="muted" style={{ marginTop: 20 }}>
          {ka ? "განცხადებები ჯერ არ არის." : "No announcements yet."}
        </p>
      )}
      {feed.posts.map((post) => (
        <article key={post.id} className="card" style={{ marginTop: 20 }}>
          <time dateTime={post.created_at} className="muted-2">
            {new Date(post.created_at).toLocaleString(ka ? "ka-GE" : "en-US", {
              timeZone: "Asia/Tbilisi",
            })}
          </time>
          {post.kind === "code" ? (
            <>
              <h2 style={{ margin: "12px 0", overflowWrap: "anywhere" }}>{post.code}</h2>
              <p className={codeIsActive(post, now) ? "gain" : "muted"}>
                {codeIsActive(post, now)
                  ? ka
                    ? "აქტიურია · +1%"
                    : "Active · +1%"
                  : ka
                    ? "ვადაგასულია"
                    : "Expired"}
              </p>
              {codeIsActive(post, now) && (
                <Link className="btn small" to="/app/ai" style={{ marginTop: 12 }}>
                  {ka ? "კოდის გააქტიურება" : "Redeem code"}
                </Link>
              )}
            </>
          ) : (
            <p style={{ marginTop: 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {post.body}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
