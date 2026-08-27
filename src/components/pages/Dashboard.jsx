import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { usePortfolio } from '@/lib/portfolio';
import { MARKETS, MARKET_MAP, formatUsd, formatNum } from '@/lib/markets';
import Sparkline from '@/components/Sparkline';
import ActivityTicker from '@/components/ActivityTicker';
import { useI18n } from '@/lib/i18n';


export default function Dashboard() {
  const { holdings, total, usdBalance, loading, flashDir, changeUsd, changePct, prices } = usePortfolio();
  const { t } = useI18n();
  const [animTotal, setAnimTotal] = useState(total);

  // Smooth number animation
  useEffect(() => {
    if (Math.abs(animTotal - total) < 0.01) return;
    const diff = total - animTotal;
    const step = diff / 10;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      if (frame >= 10) {
        setAnimTotal(total);
        clearInterval(id);
      } else {
        setAnimTotal(prev => prev + step);
      }
    }, 30);
    return () => clearInterval(id);
  }, [total]); // eslint-disable-line

  const portfolio = holdings.map(h => {
    const market = MARKET_MAP[h.symbol];
    const price = h.symbol === 'USD' ? 1 : (prices[h.symbol]?.price ?? market?.price ?? 0);
    return { ...h, price, value: h.amount * price };
  });
  const cryptoValue = total - usdBalance;

  const nonZero = portfolio.filter(h => h.value > 0.01);
  const allocColors = { USD: '#34d399', BTC: '#ed941e', ETH: '#6179db', SOL: '#58ecbc', XRP: '#3b82f6', ADA: '#0a6cf5', AVAX: '#e84142', DOT: '#e6007a', LINK: '#2a5ada' };

  const isGain = changeUsd >= 0;

  return (
    <div className="fade-up">
      <ActivityTicker />

      <h1 className="page-title">{t('dashboard.title')}</h1>
      <p className="page-sub">{t('dashboard.subtitle')}</p>

      <div className="dash-grid">

        <div className="dash-main">
          {/* Portfolio value card with live animation */}
          <div className="portfolio-card">
            <p className="eyebrow">{t('dashboard.totalValue')}</p>
            <div className={`portfolio-value ${flashDir === 'up' ? 'flash-up' : flashDir === 'down' ? 'flash-down' : ''}`} style={{ borderRadius: 8, padding: '2px 6px', display: 'inline-block' }}>
              {formatUsd(animTotal)}
            </div>
            <div className={`portfolio-change ${isGain ? 'gain' : 'loss'}`} style={{ fontSize: 15, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{isGain ? '▲' : '▼'} {isGain ? '+' : ''}{formatUsd(Math.abs(changeUsd))} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)</span>
              <span className="muted-2" style={{ fontSize: 12 }}>{t('dashboard.sinceStart')}</span>
            </div>
            <div className="muted-2" style={{ fontSize: 12, marginTop: 4 }}>
              {formatUsd(usdBalance)} {t('dashboard.cash')} · {formatUsd(cryptoValue)} {t('dashboard.inCrypto')}
            </div>

            {/* Allocation bar */}
            {nonZero.length > 0 && (
              <div className="alloc-chart">
                <div className="alloc-bar">
                  {nonZero.map(h => (
                    <div
                      key={h.symbol}
                      style={{
                        width: `${(h.value / total) * 100}%`,
                        background: allocColors[h.symbol] || '#14b8a6',
                      }}
                    />
                  ))}
                </div>
                <div className="alloc-legend">
                  {nonZero.map(h => (
                    <div key={h.symbol}>
                      <i style={{ background: allocColors[h.symbol] || '#14b8a6' }}></i>
                      {h.symbol} — {((h.value / total) * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Holdings table with live values */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('dashboard.holdings')}</h3>
              <Link className="text-link" to="/app/markets">{t('dashboard.trade')}</Link>
            </div>
            {loading ? (
              <p className="muted">{t('dashboard.loading')}</p>
            ) : nonZero.length === 0 ? (
              <div className="empty-state">
                <span>📊</span>
                <p>{t('dashboard.noHoldings')}</p>
                <Link className="btn small" to="/app/markets" style={{ marginTop: 16 }}>{t('dashboard.goMarkets')}</Link>
              </div>
            ) : (
              nonZero.map(h => {
                const p = prices[h.symbol];
                const up = p ? p.price >= p.prevPrice : true;
                const sparkColor = h.symbol === 'USD' ? '#34d399' : (up ? '#34d399' : '#f87171');
                return (
                  <div key={h.symbol} className="holding-row">
                    <div className="holding-left">
                      <b className="asset-icon" style={{ background: allocColors[h.symbol] || '#14b8a6', fontSize: h.symbol === 'USD' ? 11 : 16 }}>
                        {h.symbol === 'USD' ? '$' : (MARKET_MAP[h.symbol]?.icon || h.symbol[0])}
                      </b>
                      <div>
                        <strong style={{ fontSize: 14 }}>{MARKET_MAP[h.symbol]?.name || t('dashboard.usDollar')}</strong>
                        <div className="muted-2" style={{ fontSize: 11 }}>{h.symbol}</div>
                      </div>
                      {h.symbol !== 'USD' && p?.history?.length > 2 && (
                        <Sparkline points={p.history} color={sparkColor} width={60} height={22} />
                      )}
                    </div>
                    <div className="holding-amount">
                      <strong className={h.symbol !== 'USD' && up ? 'gain' : h.symbol !== 'USD' && !up ? 'loss' : ''}>
                        {formatNum(h.amount, h.symbol === 'USD' ? 2 : 6)} {h.symbol}
                      </strong>
                      <small>{formatUsd(h.value)}</small>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="dash-side">
          <div className="card-2">
            <p className="eyebrow" style={{ marginBottom: 14 }}>{t('dashboard.availableCash')}</p>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px' }}>{formatUsd(usdBalance)}</div>
            <Link className="btn small" to="/app/markets" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>{t('dashboard.tradeNow')}</Link>
          </div>

          <div className="card-2">
            <p className="eyebrow" style={{ marginBottom: 14 }}>{t('dashboard.quickActions')}</p>
            <div className="quick-actions">
              <Link className="quick-action" to="/app/markets">
                <span>↗</span>
                <strong>{t('dashboard.spotTrade')}</strong>
                <small>{t('dashboard.spotDesc')}</small>
              </Link>
              <Link className="quick-action" to="/app/orders">
                <span>⏱</span>
                <strong>{t('dashboard.limitOrder')}</strong>
                <small>{t('dashboard.limitDesc')}</small>
              </Link>
              <Link className="quick-action" to="/app/recurring">
                <span>↻</span>
                <strong>{t('dashboard.recurring')}</strong>
                <small>{t('dashboard.recurringDesc')}</small>
              </Link>
              <Link className="quick-action" to="/app/security">
                <span>🛡</span>
                <strong>{t('dashboard.security')}</strong>
                <small>{t('dashboard.securityDesc')}</small>
              </Link>
            </div>
          </div>

          {/* {t('dashboard.watchlist')} with sparklines */}
          <div className="card-2">
            <p className="eyebrow" style={{ marginBottom: 14 }}>{t('dashboard.watchlist')}</p>
            {MARKETS.slice(0, 5).map(m => {
              const p = prices[m.symbol];
              const up = (p?.price ?? m.price) >= (p?.prevPrice ?? m.price);
              return (
                <div key={m.symbol} className="holding-row">
                  <div className="holding-left">
                    <b className="asset-icon" style={{ background: m.color, fontSize: 14 }}>{m.icon}</b>
                    <strong style={{ fontSize: 13 }}>{m.symbol}</strong>
                    {p?.history?.length > 2 && (
                      <Sparkline points={p.history} color={up ? '#34d399' : '#f87171'} width={50} height={20} />
                    )}
                  </div>
                  <div className="holding-amount">
                    <strong className={up ? 'gain' : 'loss'} style={{ transition: 'color 0.3s' }}>{formatUsd(p?.price ?? m.price)}</strong>
                    <small className={p?.change >= 0 ? 'gain' : 'loss'}>{p?.change >= 0 ? '+' : ''}{(p?.change ?? m.change).toFixed(2)}%</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
