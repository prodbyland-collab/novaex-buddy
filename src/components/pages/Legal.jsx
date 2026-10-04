import { Link } from "@tanstack/react-router";
import LegalLinks from "@/components/LegalLinks";
import LanguageSwitch from "@/components/LanguageSwitch";
import { useLanguage } from "@/lib/language";
import { georgianLegalDocuments } from "@/lib/legal-ka";
import { LEGAL_VERSION, LEGAL_CONTACT_EMAIL, legalDocuments } from "@/lib/legal";

export default function Legal({ document }) {
  const { language } = useLanguage();
  const ka = language === "ka";
  const policy = (ka ? georgianLegalDocuments : legalDocuments)[document];
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <span>G</span>
          </span>
          GNG
        </Link>
        <div className="header-actions">
          <LanguageSwitch />
          <Link className="btn small ghost" to="/auth">
            {ka ? "შესვლა / რეგისტრაცია" : "Sign in / Register"}
          </Link>
        </div>
      </header>
      <main className="card legal-document" lang={ka ? "ka" : "en"}>
        <p className="eyebrow">
          {ka ? "სამართლებრივი ინფორმაცია · ქართული" : "Legal information · English"}
        </p>
        <h1>{policy.title}</h1>
        <p className="muted-2">
          {ka ? "ბოლო განახლება" : "Last updated"}: {LEGAL_VERSION}
        </p>
        <p>{policy.introduction}</p>
        {policy.sections.map(([title, text], index) => (
          <section key={title}>
            <h2>
              {index + 1}. {title}
            </h2>
            <p>{text}</p>
          </section>
        ))}
      </main>
      <footer className="legal-footer">
        <LegalLinks />
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
        <Link to="/">{ka ? "მთავარ გვერდზე დაბრუნება" : "Back to home"}</Link>
      </footer>
    </div>
  );
}
