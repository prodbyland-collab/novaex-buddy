import { useI18n } from "@/lib/i18n";
import { useLanguage } from "@/lib/language";

export default function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  const { setLanguage } = useLanguage();
  const changeLanguage = (next) => {
    setLang(next);
    setLanguage(next);
  };

  return (
    <div className="lang-switch" role="group" aria-label={t("common.language") || "Language"}>
      <button
        className="mobile-language-toggle"
        type="button"
        aria-label={t(lang === "ka" ? "Switch to English" : "Switch to Georgian")}
        onClick={() => changeLanguage(lang === "ka" ? "en" : "ka")}
      >
        {lang === "ka" ? "ქარ" : "EN"}
      </button>
      <button
        type="button"
        className={`desktop-language-option ${lang === "ka" ? "active" : ""}`}
        aria-pressed={lang === "ka"}
        onClick={() => changeLanguage("ka")}
      >
        ქარ
      </button>
      <button
        type="button"
        className={`desktop-language-option ${lang === "en" ? "active" : ""}`}
        aria-pressed={lang === "en"}
        onClick={() => changeLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
