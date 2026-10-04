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
        type="button"
        className={lang === "ka" ? "active" : ""}
        aria-pressed={lang === "ka"}
        onClick={() => changeLanguage("ka")}
      >
        ქარ
      </button>
      <button
        type="button"
        className={lang === "en" ? "active" : ""}
        aria-pressed={lang === "en"}
        onClick={() => changeLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
