import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useI18n } from '@/lib/i18n';
import { getGroupFeed, publishGroupNews } from '@/lib/group.functions';
import { codeIsActive } from '@/lib/group';

const text = {
  en: {
    title: 'Chat group',
    subtitle: 'Official news and the daily boost code from the GNG team.',
    empty: 'No announcements yet. Check back soon.',
    code: 'Daily code',
    codeHint: 'Redeem it on the Trading mode page before it expires.',
    expired: 'Expired',
    news: 'News',
    postPlaceholder: 'Write an announcement…',
    post: 'Publish',
    posting: 'Publishing…',
    posted: 'Published.',
    error: 'Could not load the group. Please try again later.',
  },
  ka: {
    title: 'ჩატის ჯგუფი',
    subtitle: 'ოფიციალური სიახლეები და დღიური ბონუს კოდი GNG-ის გუნდისგან.',
    empty: 'ჯერ არაფერი გამოქვეყნებულა. მალე შეამოწმეთ.',
    code: 'დღიური კოდი',
    codeHint: 'გაააქტიურეთ ვაჭრობის რეჟიმის გვერდზე ვადის ამოწურვამდე.',
    expired: 'ვადაგასული',
    news: 'სიახლე',
    postPlaceholder: 'დაწერეთ განცხადება…',
    post: 'გამოქვეყნება',
    posting: 'ქვეყნდება…',
    posted: 'გამოქვეყნდა.',
    error: 'ჯგუფის ჩატვირთვა ვერ მოხერხდა. სცადეთ მოგვიანებით.',
  },
};

function formatDate(value, ka) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(ka ? 'ka-GE' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Group() {
  const { lang } = useI18n();
  const ka = lang === 'ka';
  const t = ka ? text.ka : text.en;
  const fetchFeed = useServerFn(getGroupFeed);
  const publish = useServerFn(publishGroupNews);

  const [posts, setPosts] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await fetchFeed();
      setPosts(result.posts ?? []);
      setIsAdmin(Boolean(result.isAdmin));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [fetchFeed]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setNotice('');
    try {
      await publish({ data: { body } });
      setDraft('');
      setNotice(t.posted);
      await load();
    } catch (err) {
      setNotice(err?.message || t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 800 }}>
      <h1 className="page-title">{t.title}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>{t.subtitle}</p>

      {isAdmin && (
        <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={t.postPlaceholder}
            maxLength={3000}
            rows={3}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn small" type="submit" disabled={busy || !draft.trim()}>
              {busy ? t.posting : t.post}
            </button>
            {notice && <span className="muted">{notice}</span>}
          </div>
        </form>
      )}

      {loadError && <div className="card"><p className="muted">{t.error}</p></div>}
      {!loadError && posts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p className="muted">{t.empty}</p>
        </div>
      )}

      {posts.map(post => {
        const activeCode = codeIsActive(post);
        return (
          <article key={post.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <strong>{post.kind === 'code' ? t.code : t.news}</strong>
              <span className="muted" style={{ fontSize: 13 }}>{formatDate(post.created_at, ka)}</span>
            </div>
            {post.kind === 'code' && post.code && (
              <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, margin: '8px 0' }}>
                {activeCode ? post.code : `${post.code} · ${t.expired}`}
              </p>
            )}
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginTop: 8 }}>{post.body}</p>
            {post.kind === 'code' && activeCode && <p className="muted" style={{ fontSize: 13 }}>{t.codeHint}</p>}
          </article>
        );
      })}
    </div>
  );
}
