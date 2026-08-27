import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '@/lib/translations';


const supplementalTranslations = {
  en: {
    'dashboard.title': 'Portfolio', 'dashboard.subtitle': 'Your balances and market value, updating live.',
    'dashboard.totalValue': 'Total portfolio value', 'dashboard.sinceStart': 'since you started',
    'dashboard.cash': 'cash', 'dashboard.inCrypto': 'in crypto', 'dashboard.holdings': 'Your holdings',
    'dashboard.trade': 'Trade →', 'dashboard.loading': 'Loading...', 'dashboard.noHoldings': 'No holdings yet. Start trading to build your portfolio.',
    'dashboard.goMarkets': 'Go to Markets', 'dashboard.availableCash': 'Available cash', 'dashboard.tradeNow': 'Trade now',
    'dashboard.quickActions': 'Quick actions', 'dashboard.spotTrade': 'Spot trade', 'dashboard.spotDesc': 'Buy or sell instantly',
    'dashboard.limitOrder': 'Limit order', 'dashboard.limitDesc': 'Set your price', 'dashboard.recurring': 'Recurring',
    'dashboard.recurringDesc': 'Automate buys', 'dashboard.security': 'Security', 'dashboard.securityDesc': 'Review settings',
    'dashboard.watchlist': 'Watchlist', 'dashboard.usDollar': 'US Dollar',
  },
  ka: {
    'dashboard.title': 'პორტფელი', 'dashboard.subtitle': 'შენი ბალანსები და საბაზრო ღირებულება, რომელიც ცოცხლად განახლდება.',
    'dashboard.totalValue': 'პორტფელის სრული ღირებულება', 'dashboard.sinceStart': 'დაწყებიდან',
    'dashboard.cash': 'ნაღდი თანხა', 'dashboard.inCrypto': 'კრიპტოში', 'dashboard.holdings': 'შენი აქტივები',
    'dashboard.trade': 'ვაჭრობა →', 'dashboard.loading': 'იტვირთება...', 'dashboard.noHoldings': 'აქტივები ჯერ არ გაქვს. დაიწყე ვაჭრობა პორტფელის შესაქმნელად.',
    'dashboard.goMarkets': 'ბაზრებზე გადასვლა', 'dashboard.availableCash': 'ხელმისაწვდომი თანხა', 'dashboard.tradeNow': 'ივაჭრე ახლა',
    'dashboard.quickActions': 'სწრაფი მოქმედებები', 'dashboard.spotTrade': 'სპოტ ვაჭრობა', 'dashboard.spotDesc': 'იყიდე ან გაყიდე მყისიერად',
    'dashboard.limitOrder': 'ლიმიტ ორდერი', 'dashboard.limitDesc': 'დააყენე შენი ფასი', 'dashboard.recurring': 'რეგულარული',
    'dashboard.recurringDesc': 'შესყიდვების ავტომატიზაცია', 'dashboard.security': 'უსაფრთხოება', 'dashboard.securityDesc': 'პარამეტრების ნახვა',
    'dashboard.watchlist': 'სადარაჯო სია', 'dashboard.usDollar': 'აშშ დოლარი',
  },
};

const STORAGE_KEY = 'novax_lang';
const I18nContext = createContext(null);

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ka', label: 'ქა', name: 'ქართული' },
];

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('ka');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ka') {
      setLang(stored);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ka')) {
      setLang('ka');
    }
  }, []);

  const change = useCallback((next) => {
    setLang(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key, vars) => {
    const dict = translations[lang] || {};
    let value = supplementalTranslations[lang]?.[key] ?? dict[key] ?? supplementalTranslations.en[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang: change, t }), [lang, change, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: 'en', setLang: () => {}, t: (k) => translations.en[k] ?? k };
  return ctx;
}

export function LanguageSwitch({ className = '' }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language">
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          type="button"
          className={lang === l.code ? 'active' : ''}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.name}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
