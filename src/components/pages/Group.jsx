import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useI18n } from '@/lib/i18n';
import { getGroupFeed, publishGroupNews } from '@/lib/group.functions';
import { codeIsActive } from '@/lib/group';

export default function Group() {
  const { lang } = useI18n();
  const ka = lang === 'ka';
  const [posts, setPosts] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [now, setNow] = useState(Date.now);

  const load = useCallback(async () => {
    try {
      const feed = await getGroupFeed();
      setPosts(feed.posts); setAdmin(feed.isAdmin); setError('');
    } catch {
      setError(ka ? 'ჯგუფი ვერ ჩაიტვირთა. სცადეთ მოგვიანებით.' : 'Could not load the group. Please try again later.');
    } finally { setLoading(false); }
  }, [ka]);

  useEffect(() => {
    load();
    const timer = setInterval(() => { setNow(Date.now()); load(); }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function publish(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await publishGroupNews({ data: { body } }); setBody(''); await load(); }
    catch { setError(ka ? 'სიახლე ვერ გამოქვეყნდა. სცადეთ ხელახლა.' : 'Could not publish the news. Please try again.'); }
    finally { setBusy(false); }
  }

  async function copy(post) {
    try { await navigator.clipboard.writeText(post.code); setCopied(post.id); }
    catch { setError(ka ? 'კოპირება ვერ მოხერხდა. მონიშნეთ კოდი ხელით.' : 'Could not copy. Select the code manually.'); }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 800 }}>
      <h1 className="page-title">{ka ? 'ჩატის ჯგუფი' : 'Chat group'}</h1>
      <p className="page-sub">{ka ? 'ბოტის დღიური კოდები და ადმინისტრატორის სიახლეები. მომხმარებლებისთვის ჯგუფი მხოლოდ წაკითხვადია.' : 'Daily bot codes and administrator news. This group is read-only for members.'}</p>
      {error && <p role="alert" className="loss" style={{ marginBottom: 16 }}>{error}</p>}
      {admin && <form className="card" onSubmit={publish} style={{ marginBottom: 24 }}>
        <label htmlFor="group-news" style={{ display: 'block', marginBottom: 12 }}>{ka ? 'ადმინისტრატორის სიახლე' : 'Administrator news'}</label>
        <textarea id="group-news" value={body} onChange={event => setBody(event.target.value)} maxLength={3000} required rows={4} style={{ width: '100%', padding: 12, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, resize: 'vertical', font: 'inherit' }} />
        <button className="btn small" style={{ marginTop: 12 }} disabled={busy || !body.trim()}>{busy ? (ka ? 'ქვეყნდება…' : 'Publishing…') : (ka ? 'სიახლის გამოქვეყნება' : 'Publish news')}</button>
      </form>}
      {loading && <p className="muted">{ka ? 'იტვირთება…' : 'Loading…'}</p>}
      {!loading && !posts.length && !error && <p className="card muted">{ka ? 'შეტყობინებები ჯერ არ არის. ახალი კოდი აქ ავტომატურად გამოქვეყნდება.' : 'No posts yet. The next daily code will appear here automatically.'}</p>}
      {posts.map(post => {
        const active = codeIsActive(post, now);
        return <article className="card" key={post.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 12 }}>
            <strong>{post.kind === 'code' ? 'GNG Bot' : (ka ? 'ადმინისტრატორი' : 'Administrator')}</strong>
            <time className="muted-2" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(ka ? 'ka-GE' : 'en-US')}</time>
          </div>
          {post.kind === 'code' ? <>
            <p>{ka ? 'დღის ბონუს-კოდი: +1% დღიურ განაკვეთზე. მოქმედებს გამოქვეყნებიდან 1 საათი.' : 'Daily boost code: +1 percentage point on the daily rate. Valid for 1 hour after posting.'}</p>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 24, margin: '16px 0', overflowWrap: 'anywhere' }}>{post.code}</p>
            <p className={active ? 'gain' : 'muted-2'}>{active ? (ka ? 'მოქმედებს' : 'Active') : (ka ? 'ვადაგასულია' : 'Expired')} · {ka ? 'ვადა' : 'Expires'}: {new Date(post.expires_at).toLocaleString(ka ? 'ka-GE' : 'en-US')}</p>
            {active && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
              <button type="button" className="btn small ghost" onClick={() => copy(post)}>{copied === post.id ? (ka ? 'დაკოპირებულია' : 'Copied') : (ka ? 'კოდის კოპირება' : 'Copy code')}</button>
              <Link className="btn small" to="/app/ai">{ka ? 'კოდის გააქტიურება' : 'Redeem code'}</Link>
            </div>}
          </> : <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{post.body}</p>}
        </article>;
      })}
    </div>
  );
}
