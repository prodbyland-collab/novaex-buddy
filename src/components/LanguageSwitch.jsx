import { useLanguage } from '@/lib/language';

export default function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="lang-switch" role="group" aria-label={t('common.language')}>
      <button type="button" className={language === 'ka' ? 'active' : ''} onClick={() => setLanguage('ka')}>ქარ</button>
      <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
    </div>
  );
}
