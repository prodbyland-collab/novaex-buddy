import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchSecuritySettings, ensureSecuritySettings, updateSecuritySettings } from '@/lib/api';

export default function Security() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    await ensureSecuritySettings(user.id);
    const data = await fetchSecuritySettings(user.id);
    setSettings(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg) {
    setToast({ msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggle(field) {
    const newVal = !settings[field];
    setSettings({ ...settings, [field]: newVal });
    try {
      await updateSecuritySettings(settings.id, { [field]: newVal });
      showToast(`${field === 'two_factor_enabled' ? 'Two-factor authentication' : field === 'login_alerts' ? 'Login alerts' : 'Withdrawal whitelist'} ${newVal ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showToast('Failed to update setting');
      setSettings({ ...settings, [field]: !newVal });
    }
  }

  const items = [
    {
      key: 'two_factor_enabled',
      title: 'Two-factor authentication',
      desc: 'Require a verification code in addition to your password when signing in. Strongly recommended for all accounts.',
    },
    {
      key: 'login_alerts',
      title: 'Login alerts',
      desc: 'Get notified by email whenever a new device or IP address accesses your account.',
    },
    {
      key: 'withdrawal_whitelist',
      title: 'Withdrawal whitelist',
      desc: 'Only allow withdrawals to addresses you have previously approved. Blocks transfers to unknown destinations.',
    },
  ];

  return (
    <div className="fade-up" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Security</h1>
      <p className="page-sub">Layered protection and transparent controls to keep your account in your hands.</p>

      <div className="card">
        {loading || !settings ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            {/* Account info */}
            <div style={{ marginBottom: 28, padding: '0 0 24px', borderBottom: '1px solid var(--line)' }}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>Account</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{user?.email}</strong>
                  <div className="muted-2" style={{ fontSize: 12, marginTop: 2 }}>Account ID: {user?.id?.slice(0, 8)}...</div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            </div>

            {/* Security toggles */}
            {items.map(item => (
              <div key={item.key} className="security-item">
                <div className="security-info">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
                <div className={`toggle ${settings[item.key] ? 'on' : ''}`} onClick={() => toggle(item.key)} />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card-2" style={{ marginTop: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Tips</p>
        <ul style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
          <li>Use a unique password you don't reuse on other sites.</li>
          <li>Enable two-factor authentication for an extra layer of security.</li>
          <li>Review your active sessions and sign out of unfamiliar devices.</li>
          <li>Never share your password or verification codes with anyone.</li>
        </ul>
      </div>

      {toast && <div className="toast success">{toast.msg}</div>}
    </div>
  );
}
