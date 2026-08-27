import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { usePortfolio } from '@/lib/portfolio';
import { formatUsd } from '@/lib/markets';
import LanguageSwitch from '@/components/LanguageSwitch';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { total, changeUsd, changePct, flashDir } = usePortfolio();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/app', label: t('nav.portfolio'), exact: true },
    { to: '/app/markets', label: t('nav.markets') },
    { to: '/app/ai', label: t('nav.aiTrading') },
    { to: '/app/orders', label: t('nav.botPlans') },
    { to: '/app/recurring', label: t('nav.referrals') },
    { to: '/app/security', label: t('nav.security') },
    { to: '/app/wallet', label: t('nav.wallet') }
  ];

  function isActive(item) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: '/' });
  }

  const initials = (user?.email || 'U').slice(0, 2).toUpperCase();
  const isGain = changeUsd >= 0;

  return (
    <div>
      <header className="app-header">
        <Link className="brand" to="/app">
          <span className="brand-mark"><span>G</span></span>GNG
        </Link>
        <nav className="app-nav">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className={isActive(item) ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-balance" data-flash={flashDir}>
          <div className="header-balance-label">{t('common.portfolio')}</div>
          <div className={`header-balance-value ${flashDir === 'up' ? 'flash-up' : flashDir === 'down' ? 'flash-down' : ''}`}>
            {formatUsd(total)}
          </div>
          <div className={`header-balance-change ${isGain ? 'gain' : 'loss'}`}>
            {isGain ? '+' : ''}{formatUsd(changeUsd)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
          </div>
        </div>
        <div className="user-area">
          <LanguageSwitch />
          <span className="user-email">{user?.email}</span>
          <div className="user-avatar">{initials}</div>
          <button className="btn small ghost" onClick={handleSignOut}>{t('common.signOut')}</button>
        </div>
      </header>
      <div className="app-body">
        {children}
      </div>
    </div>
  );
}
