import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { fetchReferralInfo } from '@/lib/api';

export default function Referrals() {
  const { t } = useI18n();
  const [referral, setReferral] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => fetchReferralInfo().then(setReferral).catch(() => setReferral(null)), []);
  useEffect(() => { load(); }, [load]);

  const inviteLink = referral?.code ? `${window.location.origin}/auth?ref=${referral.code}` : '';
  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fade-up" style={{ maxWidth: 760 }}>
      <h1 className="page-title">{t('ref.title')}</h1>
      <p className="page-sub">{t('ref.desc')}</p>
      <div className="card" style={{ marginTop: 24 }}>
        <label className="address-label">{t('ref.link')}</label>
        <div className="address-box">
          <span>{inviteLink || '—'}</span>
          {inviteLink && <button className="btn small ghost" onClick={copyLink}>{copied ? t('common.copied') : t('common.copy')}</button>}
        </div>
        <div className="trade-summary" style={{ marginTop: 20 }}>
          <div><span>{t('ref.code')}</span><span>{referral?.code ?? '—'}</span></div>
          <div><span>{t('ref.invited')}</span><span>{Number(referral?.referrals ?? 0)}</span></div>
          <div><span>{t('ref.bonus')}</span><span className="gain">+{(Number(referral?.bonus_rate ?? 0) * 100).toFixed(2)}%</span></div>
          
        </div>
      </div>
    </div>
  );
}
