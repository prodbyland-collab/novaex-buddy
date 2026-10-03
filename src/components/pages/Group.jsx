import { useI18n } from '@/lib/i18n';

export default function Group() {
  const { lang } = useI18n();
  const ka = lang === 'ka';

  return (
    <div className="fade-up" style={{ maxWidth: 800 }}>
      <h1 className="page-title">{ka ? 'ჩატის ჯგუფი' : 'Chat group'}</h1>
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
          {ka ? 'მალე დაემატება' : 'Coming soon'}
        </h2>
        <p className="muted" style={{ lineHeight: 1.7 }}>
          {ka ? 'დღიური კოდები და სიახლეები მალე ამ გვერდზე გამოქვეყნდება.' : 'Daily codes and news will be available here soon.'}
        </p>
      </div>
    </div>
  );
}

