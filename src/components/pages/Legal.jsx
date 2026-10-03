import { Link } from '@tanstack/react-router';
import LegalLinks from '@/components/LegalLinks';
import { LEGAL_VERSION, LEGAL_CONTACT_EMAIL, legalDocuments } from '@/lib/legal';

export default function Legal({ document }) {
  const policy = legalDocuments[document];
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="brand" to="/"><span className="brand-mark"><span>G</span></span>GNG</Link>
        <Link className="btn small ghost" to="/auth">Sign in / Register</Link>
      </header>
      <main className="card legal-document" lang="en">
        <p className="eyebrow">Legal information · English</p>
        <h1>{policy.title}</h1>
        <p className="muted-2">Last updated: {LEGAL_VERSION}</p>
        <p>{policy.introduction}</p>
        {policy.sections.map(([title, text], index) => (
          <section key={title}>
            <h2>{index + 1}. {title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </main>
      <footer className="legal-footer"><LegalLinks /><a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a><Link to="/">Back to home</Link></footer>
    </div>
  );
}
