import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { usePortfolio } from "@/lib/portfolio";
import { formatUsd } from "@/lib/markets";
import { profitPercentage } from "@/lib/portfolio-math";
import LanguageSwitch from "@/components/LanguageSwitch";
import LegalLinks from "@/components/LegalLinks";
import NotificationCenter from "@/components/NotificationCenter";
import {
  LayoutDashboard,
  Bot,
  MessagesSquare,
  Layers3,
  Users,
  ShieldCheck,
  Wallet,
  Settings2,
  LogOut,
} from "lucide-react";

export default function AppLayout({ children }) {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { total, changeUsd, changePct, flashDir, loading, error } = usePortfolio();
  const navigate = useNavigate();
  const location = useLocation();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsAdmin(!!data);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const navItems = [
    { to: "/app", label: t("nav.portfolio"), icon: LayoutDashboard, exact: true },

    { to: "/app/ai", label: t("nav.aiTrading"), icon: Bot },
    { to: "/app/group", label: t("nav.group"), icon: MessagesSquare },
    { to: "/app/orders", label: t("nav.botPlans"), icon: Layers3 },
    { to: "/app/recurring", label: t("nav.referrals"), icon: Users },
    { to: "/app/security", label: t("nav.security"), icon: ShieldCheck },
    { to: "/app/wallet", label: t("nav.wallet"), icon: Wallet },
    ...(isAdmin ? [{ to: "/app/admin", label: t("Admin"), icon: Settings2 }] : []),
  ];

  function isActive(item) {
    if (item.exact) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  const initials = (user?.email || "U").slice(0, 2).toUpperCase();
  const isGain = changeUsd >= 0;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#app-content">
        {t("common.skipContent")}
      </a>
      <header className="app-header">
        <Link className="brand" to="/app" aria-label="GNG">
          <span className="brand-mark">
            <span>G</span>
          </span>
          <span className="brand-name">GNG</span>
        </Link>
        <nav className="app-nav" aria-label={t("common.dashboard")}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive(item) ? "page" : undefined}
              className={isActive(item) ? "active" : ""}
            >
              <item.icon size={16} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-balance" data-flash={flashDir}>
          <div className="header-balance-label">{t("common.portfolio")}</div>
          <div
            className={`header-balance-value ${flashDir === "up" ? "flash-up" : flashDir === "down" ? "flash-down" : ""}`}
          >
            {loading ? "…" : error ? "—" : formatUsd(total)}
          </div>
          {!loading && !error && (
            <div className={`header-balance-change ${isGain ? "gain" : "loss"}`}>
              {isGain ? "+" : ""}
              {formatUsd(changeUsd)} ({profitPercentage(changePct)})
            </div>
          )}
        </div>
        <div className="user-area">
          <NotificationCenter key={user?.id ?? "signed-out"} />
          <LanguageSwitch />
          <span className="user-email">{user?.email}</span>
          <div className="user-avatar">{initials}</div>
          <button
            className="btn small ghost sign-out"
            onClick={handleSignOut}
            aria-label={t("common.signOut")}
            title={t("common.signOut")}
          >
            <LogOut size={15} aria-hidden="true" />
            <span>{t("common.signOut")}</span>
          </button>
        </div>
      </header>
      <main id="app-content" className="app-body" tabIndex={-1}>
        {children}
      </main>
      <footer className="legal-footer">
        <LegalLinks />
      </footer>
    </div>
  );
}
