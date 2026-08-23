import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { usePortfolio } from '@/lib/portfolio';
import { formatUsd } from '@/lib/markets';

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const { total, changeUsd, changePct, flashDir } = usePortfolio();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/app', label: 'Portfolio', exact: true },
    { to: '/app/markets', label: 'Markets' },
    { to: '/app/orders', label: 'Orders' },
    { to: '/app/recurring', label: 'Recurring' },
    { to: '/app/security', label: 'Security' },
    { to: '/app/wallet', label: 'Wallet' }
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
          <span className="brand-mark"><span>N</span></span>NOVAX
        </Link>
        <nav className="app-nav">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className={isActive(item) ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-balance" data-flash={flashDir}>
          <div className="header-balance-label">Portfolio</div>
          <div className={`header-balance-value ${flashDir === 'up' ? 'flash-up' : flashDir === 'down' ? 'flash-down' : ''}`}>
            {formatUsd(total)}
          </div>
          <div className={`header-balance-change ${isGain ? 'gain' : 'loss'}`}>
            {isGain ? '+' : ''}{formatUsd(changeUsd)} ({isGain ? '+' : ''}{changePct.toFixed(2)}%)
          </div>
        </div>
        <div className="user-area">
          <span className="user-email">{user?.email}</span>
          <div className="user-avatar">{initials}</div>
          <button className="btn small ghost" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <div className="app-body">
        {children}
      </div>
    </div>
  );
}
