import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';
import { fetchSecuritySettings, ensureSecuritySettings, updateSecuritySettings } from '@/lib/api';

export default function Security() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ka = language === 'ka';
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const text = ka ? {
    title: 'უსაფრთხოება', subtitle: 'მრავალშრიანი დაცვა და გამჭვირვალე კონტროლი ანგარიშს შენს ხელში ტოვებს.',
    loading: 'იტვირთება...', account: 'ანგარიში', accountId: 'ანგარიშის ID', active: 'აქტიური',
    failed: 'პარამეტრის განახლება ვერ მოხერხდა', enabled: 'ჩართულია', disabled: 'გამორთულია',
    tips: 'რჩევები',
    twoFactor: 'ორფაქტორიანი ავთენტიფიკაცია', twoFactorDesc: 'შესვლისას პაროლის გარდა მოითხოვე დამადასტურებელი კოდი. რეკომენდებულია ყველა ანგარიშისთვის.',
    alerts: 'შესვლის შეტყობინებები', alertsDesc: 'მიიღე ელფოსტით შეტყობინება, როდესაც ახალი მოწყობილობა ან IP მისამართი შედის ანგარიშზე.',
    whitelist: 'გატანის თეთრი სია', whitelistDesc: 'გატანა დაუშვი მხოლოდ წინასწარ დამტკიცებულ მისამართებზე. ბლოკავს გადარიცხვას უცნობ მისამართებზე.',
    tip1: 'გამოიყენე უნიკალური პაროლი, რომელსაც სხვა საიტებზე არ იყენებ.', tip2: 'დამატებითი დაცვისთვის ჩართე ორფაქტორიანი ავთენტიფიკაცია.',
    tip3: 'გადაამოწმე აქტიური სესიები და გამოდი უცნობი მოწყობილობებიდან.', tip4: 'არასდროს გაუზიარო ვინმეს პაროლი ან დამადასტურებელი კოდები.',
  } : {
    title: 'Security', subtitle: 'Layered protection and transparent controls to keep your account in your hands.',
    loading: 'Loading...', account: 'Account', accountId: 'Account ID', active: 'Active', failed: 'Failed to update setting', enabled: 'enabled', disabled: 'disabled',
    tips: 'Tips', twoFactor: 'Two-factor authentication', twoFactorDesc: 'Require a verification code in addition to your password when signing in. Strongly recommended for all accounts.',
    alerts: 'Login alerts', alertsDesc: 'Get notified by email whenever a new device or IP address accesses your account.',
    whitelist: 'Withdrawal whitelist', whitelistDesc: 'Only allow withdrawals to addresses you have previously approved. Blocks transfers to unknown destinations.',
    tip1: "Use a unique password you don't reuse on other sites.", tip2: 'Enable two-factor authentication for an extra layer of security.',
    tip3: 'Review your active sessions and sign out of unfamiliar devices.', tip4: 'Never share your password or verification codes with anyone.',
  };

  const load = useCallback(async () => {
    if (!user) return;
    await ensureSecuritySettings(user.id);
    setSettings(await fetchSecuritySettings(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) { setToast({ msg }); setTimeout(() => setToast(null), 3000); }

  const items = [
    { key: 'two_factor_enabled', title: text.twoFactor, desc: text.twoFactorDesc },
    { key: 'login_alerts', title: text.alerts, desc: text.alertsDesc },
    { key: 'withdrawal_whitelist', title: text.whitelist, desc: text.whitelistDesc },
  ];

  async function toggle(field) {
    const value = !settings[field];
    setSettings({ ...settings, [field]: value });
    try {
      await updateSecuritySettings(settings.id, { [field]: value });
      const title = items.find(item => item.key === field)?.title;
      showToast(title + ' ' + (value ? text.enabled : text.disabled));
    } catch {
      showToast(text.failed);
      setSettings({ ...settings, [field]: !value });
    }
  }

  return <div className="fade-up" style={{ maxWidth: 720 }}>
    <h1 className="page-title">{text.title}</h1>
    <p className="page-sub">{text.subtitle}</p>
    <div className="card">
      {loading || !settings ? <p className="muted">{text.loading}</p> : <>
        <div style={{ marginBottom: 28, padding: '0 0 24px', borderBottom: '1px solid var(--line)' }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>{text.account}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><strong style={{ fontSize: 14 }}>{user?.email}</strong><div className="muted-2" style={{ fontSize: 12, marginTop: 2 }}>{text.accountId}: {user?.id?.slice(0, 8)}...</div></div>
            <span className="badge badge-green">{text.active}</span>
          </div>
        </div>
        {items.map(item => <div key={item.key} className="security-item"><div className="security-info"><h4>{item.title}</h4><p>{item.desc}</p></div><button type="button" aria-label={item.title} className={'toggle ' + (settings[item.key] ? 'on' : '')} onClick={() => toggle(item.key)} /></div>)}
      </>}
    </div>
    <div className="card-2" style={{ marginTop: 24 }}><p className="eyebrow" style={{ marginBottom: 10 }}>{text.tips}</p><ul style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}><li>{text.tip1}</li><li>{text.tip2}</li><li>{text.tip3}</li><li>{text.tip4}</li></ul></div>
    {toast && <div className="toast success">{toast.msg}</div>}
  </div>;
}
