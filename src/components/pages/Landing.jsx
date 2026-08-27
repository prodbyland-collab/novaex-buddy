import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { useLivePrices } from '@/lib/useLivePrices';
import { formatUsd } from '@/lib/markets';
import { MARKETS } from '@/lib/markets';
import LanguageSwitch from '@/components/LanguageSwitch';

function LocalizedTitle({ value }) {
  const [first, second] = value.split('|');
  return <>{first}<br /><em>{second}</em></>;
}

export default function Landing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const prices = useLivePrices();

  return (
    <>
      <div className="grid-glow" />
      <header className="site-header">
        <Link className="brand" to="/"><span className="brand-mark"><span>N</span></span>NOVAX</Link>
        <button className="menu-button" onClick={() => setMenuOpen(o => !o)}>{menuOpen ? t('common.close') : t('common.menu')}</button>
        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#markets">{t('nav.markets')}</a>
          <a href="#features">{t('nav.whyNovax')}</a>
          <a href="#security">{t('nav.security')}</a>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          {user ? (
            <button className="btn small" onClick={() => navigate({ to: '/app' })}>{t('common.dashboard')}</button>
          ) : (
            <>
              <Link className="login" to="/auth">{t('common.login')}</Link>
              <Link className="btn small" to="/auth">{t('common.signUp')}</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{t('landing.heroEyebrow')}</p>
            <h1><LocalizedTitle value={t('landing.heroTitle')} /></h1>
            <p className="hero-text">{t('landing.heroText')}</p>
            <div className="hero-actions">
              <Link className="btn" to={user ? '/app' : '/auth'}>{t('landing.startExploring')} <b>→</b></Link>
              <a className="text-link" href="#features">{t('landing.seeHow')}</a>
            </div>
            <div className="trust-row">
              <div><strong>24/7</strong><span>{t('landing.marketAccess')}</span></div>
              <div><strong>0.1%</strong><span>{t('landing.spotFee')}</span></div>
              <div><strong>150+</strong><span>{t('landing.tradePairs')}</span></div>
            </div>
          </div>
          <div className="hero-art" aria-label="Abstract trading dashboard illustration">
            <div className="orb orb-one"></div>
            <div className="orb orb-two"></div>
            <div className="dashboard-card">
              <div className="dash-head"><span className="tiny-logo">N</span><span>{t('landing.portfolioValue')}</span><i></i></div>
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

        <section className="ticker" aria-label={t('landing.liveSnapshot')}>
          <p><span className="pulse-dot"></span> {t('landing.liveSnapshot')}</p>
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
              <p className="eyebrow">{t('landing.marketOverview')}</p>
              <h2>{t('landing.whatsMoving')}</h2>
            </div>
            <Link className="text-link" to={user ? '/app/markets' : '/auth'}>{t('landing.tradeNow')}</Link>
          </div>
          <div className="market-table">
            <div className="table-head">
              <span>{t('landing.asset')}</span><span>{t('landing.lastPrice')}</span><span>{t('landing.change24h')}</span><span>{t('landing.marketCap')}</span><span></span>
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
                  <Link className="trade-btn" to={user ? '/app/markets' : '/auth'}>{t('landing.trade')}</Link>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section features" id="features">
          <p className="eyebrow">{t('landing.builtAroundYou')}</p>
          <h2><LocalizedTitle value={t('landing.everythingTitle')} /></h2>
          <div className="feature-grid">
            <article>
              <span>01</span>
              <h3>{t('landing.simpleTitle')}</h3>
              <p>{t('landing.simpleText')}</p>
            </article>
            <article>
              <span>02</span>
              <h3>{t('landing.yourWayTitle')}</h3>
              <p>{t('landing.yourWayText')}</p>
            </article>
            <article id="security">
              <span>03</span>
              <h3>{t('landing.securityTitle')}</h3>
              <p>{t('landing.securityText')}</p>
            </article>
          </div>
        </section>

        <section className="cta">
          <div>
            <p className="eyebrow">{t('landing.ready')}</p>
            <h2><LocalizedTitle value={t('landing.ctaTitle')} /></h2>
          </div>
          <Link className="btn" to={user ? '/app' : '/auth'}>{t('landing.openAccount')} <b>→</b></Link>
        </section>
      </main>
      <footer className="footer">
        <Link className="brand" to="/"><span className="brand-mark"><span>N</span></span>NOVAX</Link>
        <p>{t('landing.footer')}</p>
        <span>© 2026 NOVAX</span>
      </footer>
    </>
  );
}
