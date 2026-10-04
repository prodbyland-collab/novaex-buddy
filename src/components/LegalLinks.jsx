import { useLanguage } from "@/lib/language";
import { legalLabels } from "@/lib/legal";

export default function LegalLinks() {
  const { language } = useLanguage();
  const labels = legalLabels[language] || legalLabels.en;
  return (
    <nav
      className="legal-links"
      aria-label={language === "ka" ? "სამართლებრივი ინფორმაცია" : "Legal information"}
    >
      <a href="/privacy">{labels.privacy}</a>
      <a href="/terms">{labels.terms}</a>
    </nav>
  );
}
