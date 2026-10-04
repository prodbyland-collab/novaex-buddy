// Thin compatibility wrapper over the single i18n system in ./i18n.
// Keeps the older useLanguage()/LanguageProvider API working while all
// components share one language state and one storage key.
import { LanguageProvider, useI18n } from "@/lib/i18n";

export { LanguageProvider };

export function useLanguage() {
  const { lang, setLang, t } = useI18n();
  return { language: lang, setLanguage: setLang, t };
}
