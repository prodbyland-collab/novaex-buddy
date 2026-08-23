import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useLivePrices } from '@/lib/useLivePrices';
import { formatUsd } from '@/lib/markets';
import { MARKETS } from '@/lib/markets';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const prices = useLivePrices();

  return (
    <>
      <div className="grid-glow" />
      <header className="site-header">
        <Link className="brand" to="/"><span className="brand-mark"><span>N</span></span>NOVAX</Link>
        <button className="menu-button" onClick={() => setMenuOpen(o => !o)}>{menuOpen ? 'Close' : 'Menu'}</button>
        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#markets">Markets</a>
          <a href="#features">Why NOVAX</a>
          <a href="#security">Security</a>
        </nav>
        <div className="header-actions">
          {user ? (
            <button className="btn small" onClick={() => navigate({ to: '/app' })}>Go to dashboard →</button>
          ) : (
            <>
              <Link className="login" to="/auth">Log in</Link>
              <Link className="btn small" to="/auth">Create account</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">The calm way to trade</p>
            <h1>Move with the market.<br /><em>Stay in control.</em></h1>
            <p className="hero-text">A thoughtful home for digital assets, built for people who want a clear view and a faster next move.</p>
            <div className="hero-actions">
              <Link className="btn" to={user ? '/app' : '/auth'}>Start exploring <b>→</b></Link>
              <a className="text-link" href="#features">See how it works</a>
            </div>
            <div className="trust-row">
              <div><strong>24/7</strong><span>market access</span></div>
              <div><strong>0.1%</strong><span>spot fee from</span></div>
              <div><strong>150+</strong><span>trade pairs</span></div>
            </div>
          </div>
          <div className="hero-art" aria-label="Abstract trading dashboard illustration">
            <div className="orb orb-one"></div>
            <div className="orb orb-two"></div>
            <div className="dashboard-card">
              <div className="dash-head"><span className="tiny-logo">N</span><span>Portfolio value</span><i></i></div>
              <strong>$24,610.80</strong>
              <small>+ $1,284.42 <b>↗ 5.51%</b></small>
              <svg viewBox="0 0 360 120" role="img" aria-label="Rising price chart">
                <defs>
                  <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#2dd4bf" stopOpacity=".45" />
                    <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 105 L25 91 45 94 70 70 95 85 116 62 142 77 166 38 192 55 220 23 247 48 270 32 296 39 322 11 360 20 V120 H0Z" fill="url(#fade)" />
                <path d="M0 105 L25 91 45 94 70 70 95 85 116 62 142 77 166 38 192 55 220 23 247 48 270 32 296 39 322 11 360 20" fill="none" stroke="#2dd4bf" strokeWidth="3" />
              </svg>
              <div className="coins"><span>₿</span><span>Ξ</span><span>◈</span><span>+</span></div>
            </div>
            <div className="floating-stat">
              <span>BTC / USD</span>
              <strong>{formatUsd(prices.BTC?.price ?? 104820)}</strong>
              <b className={prices.BTC?.change >= 0 ? 'gain' : 'loss'}>{prices.BTC?.change >= 0 ? '+' : ''}{(prices.BTC?.change ?? 2.38).toFixed(2)}%</b>
            </div>
            <div className="coin coin-a">₿</div>
            <div className="coin coin-b">Ξ</div>
            <div className="coin coin-c">◈</div>
          </div>
        </section>

        <section className="ticker" aria-label="Live market highlights">
          <p><span className="pulse-dot"></span> Live market snapshot</p>
          <div className="ticker-items">
            {MARKETS.slice(0, 4).map(m => {
              const p = prices[m.symbol];
              return (
                <span key={m.symbol}>{m.symbol} <b>{formatUsd(p?.price ?? m.price)}</b> <i className={p?.change >= 0 ? 'gain' : 'loss'}>{p?.change >= 0 ? '+' : ''}{(p?.change ?? m.change).toFixed(2)}%</i></span>
              );
            })}
          </div>
        </section>

        <section className="section" id="markets">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Market overview</p>
              <h2>See what's moving.</h2>
            </div>
            <Link className="text-link" to={user ? '/app/markets' : '/auth'}>Trade now →</Link>
          </div>
          <div className="market-table">
            <div className="table-head">
              <span>Asset</span><span>Last price</span><span>24h change</span><span>Market cap</span><span></span>
            </div>
            {MARKETS.map(m => {
              const p = prices[m.symbol];
              return (
                <div key={m.symbol} className="table-row">
                  <span className="asset-cell">
                    <b className="asset-icon" style={{ background: m.color }}>{m.icon}</b>
                    <span><span className="asset-name">{m.name}</span><span className="asset-symbol">{m.symbol}</span></span>
                  </span>
                  <span>{formatUsd(p?.price ?? m.price)}</span>
                  <span className={p?.change >= 0 ? 'gain' : 'loss'}>{p?.change >= 0 ? '+' : ''}{(p?.change ?? m.change).toFixed(2)}%</span>
                  <span className="muted">{m.cap}</span>
                  <Link className="trade-btn" to={user ? '/app/markets' : '/auth'}>Trade</Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section features" id="features">
          <p className="eyebrow">Built around you</p>
          <h2>Everything you need.<br /><em>Nothing in your way.</em></h2>
          <div className="feature-grid">
            <article>
              <span>01</span>
              <h3>Simple by design</h3>
              <p>See balances, orders, and market movement at a glance without the clutter.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Trade your way</h3>
              <p>Spot, recurring buys, and advanced orders all live in one focused workspace.</p>
            </article>
            <article id="security">
              <span>03</span>
              <h3>Security first</h3>
              <p>Layered protection and transparent controls help keep your account in your hands.</p>
            </article>
          </div>
        </section>

        <section className="cta">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Your next move<br />starts <em>here.</em></h2>
          </div>
          <Link className="btn" to={user ? '/app' : '/auth'}>Open your account <b>→</b></Link>
        </section>
      </main>
      <footer className="footer">
        <Link className="brand" to="/"><span className="brand-mark"><span>N</span></span>NOVAX</Link>
        <p>Original exchange landing page concept.</p>
        <span>© 2026 NOVAX</span>
      </footer>
    </>
  );
}
