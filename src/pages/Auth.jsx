import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { ensureUsdBalance, ensureSecuritySettings } from '@/lib/api';

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.error) throw result.error;

      // After sign-up, seed demo balance + security settings
      const userId = result.data.user?.id;
      if (userId && mode === 'signup') {
        await ensureUsdBalance(userId);
        await ensureSecuritySettings(userId);
      }
      navigate({ to: '/app' });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '20px' }}>
      <div className="grid-glow" />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        <Link className="brand" to="/" style={{ justifyContent: 'center', marginBottom: 32 }}>
          <span className="brand-mark"><span>N</span></span>NOVAX
        </Link>
        <div className="card fade-up">
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 28 }}>
            {mode === 'login' ? 'Sign in to access your portfolio.' : 'Start trading in under a minute.'}
          </p>

          <div className="trade-tabs" style={{ marginBottom: 24 }}>
            <button className={`trade-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Log in</button>
            <button className={`trade-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')}>Sign up</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
            </div>
            {error && (
              <div style={{ background: 'rgba(240,97,109,0.1)', border: '1px solid rgba(240,97,109,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in →' : 'Create account →'}
            </button>
          </form>

          <p className="muted-2" style={{ fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            New accounts start with $25,000 in demo funds.
          </p>
        </div>
        <Link className="muted-2" to="/" style={{ display: 'block', textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
