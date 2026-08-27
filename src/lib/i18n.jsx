import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '@/lib/translations';

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
    let value = dict[key] ?? translations.en[key] ?? key;
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
