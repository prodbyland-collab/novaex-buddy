import { useEffect, useState, useCallback } from "react";
import { ShieldCheck } from "lucide-react";
import PageHeading from "@/components/PageHeading";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { fetchSecuritySettings, ensureSecuritySettings, updateSecuritySettings } from "@/lib/api";
import { MfaSettings } from "@/components/Mfa";
import { parseWhitelist } from "@/lib/withdrawal-whitelist";

export default function Security() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const ka = language === "ka";
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [addresses, setAddresses] = useState("");
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addressError, setAddressError] = useState("");

  const text = ka
    ? {
        title: "უსაფრთხოება",
        subtitle: "მრავალშრიანი დაცვა და გამჭვირვალე კონტროლი ანგარიშს შენს ხელში ტოვებს.",
        loading: "იტვირთება...",
        account: "ანგარიში",
        accountId: "ანგარიშის ID",
        active: "აქტიური",
        failed: "პარამეტრის განახლება ვერ მოხერხდა",
        enabled: "ჩართულია",
        disabled: "გამორთულია",
        tips: "რჩევები",
        twoFactor: "ორფაქტორიანი ავთენტიფიკაცია",
        twoFactorDesc:
          "შესვლისას პაროლის გარდა მოითხოვე დამადასტურებელი კოდი. რეკომენდებულია ყველა ანგარიშისთვის.",
        alerts: "შესვლის შეტყობინებები",
        alertsDesc:
          "მიიღე ელფოსტით შეტყობინება, როდესაც ახალი მოწყობილობა ან IP მისამართი შედის ანგარიშზე.",
        whitelist: "გატანის თეთრი სია",
        whitelistDesc:
          "გატანა დაუშვი მხოლოდ წინასწარ დამტკიცებულ მისამართებზე. ბლოკავს გადარიცხვას უცნობ მისამართებზე.",
        tip1: "გამოიყენე უნიკალური პაროლი, რომელსაც სხვა საიტებზე არ იყენებ.",
        tip2: "დამატებითი დაცვისთვის ჩართე ორფაქტორიანი ავთენტიფიკაცია.",
        tip3: "გადაამოწმე აქტიური სესიები და გამოდი უცნობი მოწყობილობებიდან.",
        tip4: "არასდროს გაუზიარო ვინმეს პაროლი ან დამადასტურებელი კოდები.",
      }
    : {
        title: "Security",
        subtitle: "Layered protection and transparent controls to keep your account in your hands.",
        loading: "Loading...",
        account: "Account",
        accountId: "Account ID",
        active: "Active",
        failed: "Failed to update setting",
        enabled: "enabled",
        disabled: "disabled",
        tips: "Tips",
        twoFactor: "Two-factor authentication",
        twoFactorDesc:
          "Require a verification code in addition to your password when signing in. Strongly recommended for all accounts.",
        alerts: "Login alerts",
        alertsDesc:
          "Get notified by email whenever a new device or IP address accesses your account.",
        whitelist: "Withdrawal whitelist",
        whitelistDesc:
          "Only allow withdrawals to addresses you have previously approved. Blocks transfers to unknown destinations.",
        tip1: "Use a unique password you don't reuse on other sites.",
        tip2: "Enable two-factor authentication for an extra layer of security.",
        tip3: "Review your active sessions and sign out of unfamiliar devices.",
        tip4: "Never share your password or verification codes with anyone.",
      };

  const load = useCallback(async () => {
    if (!user) return;
    await ensureSecuritySettings(user.id);
    const security = await fetchSecuritySettings(user.id);
    setSettings(security);
    const list = security?.approved_addresses ?? [];
    setSavedAddresses(list);
    setAddresses(list.join("\n"));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load().catch((err) => {
      setAddressError(err.message);
      setLoading(false);
    });
  }, [load]);

  function showToast(msg) {
    setToast({ msg });
    setTimeout(() => setToast(null), 3000);
  }

  const items = [{ key: "withdrawal_whitelist", title: text.whitelist, desc: text.whitelistDesc }];

  async function toggle(field) {
    if (field === "withdrawal_whitelist" && !settings[field] && !savedAddresses.length) {
      setAddressError(
        ka
          ? "ჩართვამდე დაამატეთ და შეინახეთ მინიმუმ ერთი მისამართი."
          : "Add and save at least one address before enabling the whitelist.",
      );
      return;
    }
    setSaving(true);
    const value = !settings[field];
    setSettings({ ...settings, [field]: value });
    try {
      const next = await updateSecuritySettings(settings.id, {
        withdrawal_whitelist: value,
        approved_addresses: savedAddresses,
      });
      setSettings(next);
      const title = items.find((item) => item.key === field)?.title;
      showToast(title + " " + (value ? text.enabled : text.disabled));
    } catch {
      showToast(text.failed);
      setSettings({ ...settings, [field]: !value });
    } finally {
      setSaving(false);
    }
  }

  async function saveAddresses(event) {
    event.preventDefault();
    setSaving(true);
    setAddressError("");
    try {
      const list = parseWhitelist(addresses);
      if (settings.withdrawal_whitelist && !list.length) {
        throw new Error("Disable the whitelist before removing all addresses.");
      }
      const next = await updateSecuritySettings(settings.id, {
        withdrawal_whitelist: settings.withdrawal_whitelist,
        approved_addresses: list,
      });
      setSettings(next);
      setSavedAddresses(list);
      setAddresses(list.join("\n"));
      showToast(ka ? "მისამართები შენახულია" : "Addresses saved");
    } catch {
      setAddressError(
        ka
          ? "მისამართები ვერ შეინახა. ჩაწერეთ მაქსიმუმ 50 მისამართი, თითო ახალ ხაზზე, გამოტოვებების გარეშე (12–256 სიმბოლო). ჩართულ სიაში მინიმუმ ერთი მისამართი უნდა დარჩეს."
          : "Could not save addresses. Enter up to 50 addresses, one per line, without spaces (12–256 characters). An enabled whitelist must keep at least one address.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-up focused-page security-page">
      <PageHeading icon={ShieldCheck} title={text.title}>
        {text.subtitle}
      </PageHeading>
      <div className="card">
        {loading || !settings ? (
          <p className="muted">{text.loading}</p>
        ) : (
          <>
            <div
              style={{
                marginBottom: 28,
                padding: "0 0 24px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <p className="eyebrow" style={{ marginBottom: 12 }}>
                {text.account}
              </p>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>{user?.email}</strong>
                  <div className="muted-2" style={{ fontSize: 12, marginTop: 2 }}>
                    {text.accountId}: {user?.id?.slice(0, 8)}...
                  </div>
                </div>
                <span className="badge badge-green">{text.active}</span>
              </div>
            </div>
            <MfaSettings ka={ka} />
            <div className="security-item">
              <div className="security-info">
                <h4>{text.alerts}</h4>
                <p>
                  {ka
                    ? "ელფოსტის შეტყობინებები ჯერ ხელმისაწვდომი არ არის."
                    : "Email login alerts are not available yet."}
                </p>
              </div>
              <span className="muted">{ka ? "მიუწვდომელია" : "Unavailable"}</span>
            </div>
            {items.map((item) => (
              <div key={item.key} className="security-item">
                <div className="security-info">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
                <button
                  type="button"
                  aria-label={item.title}
                  aria-pressed={Boolean(settings[item.key])}
                  disabled={saving}
                  className={"toggle " + (settings[item.key] ? "on" : "")}
                  onClick={() => toggle(item.key)}
                />
              </div>
            ))}
            <form onSubmit={saveAddresses} style={{ marginTop: 24 }}>
              <label
                htmlFor="whitelist-addresses"
                style={{ display: "block", fontWeight: 700, marginBottom: 8 }}
              >
                {ka ? "დამტკიცებული გატანის მისამართები" : "Approved withdrawal addresses"}
              </label>
              <p className="muted" id="whitelist-help" style={{ fontSize: 13, marginBottom: 12 }}>
                {ka
                  ? "ჩაწერეთ თითო მისამართი ახალ ხაზზე და შეინახეთ. გადაამოწმეთ ვალუტა და ქსელი. სიიდან წასაშლელად ამოიღეთ შესაბამისი ხაზი და კვლავ შეინახეთ."
                  : "Enter one address per line and save. Check the currency and network. To remove an address, delete its line and save again."}
              </p>
              <textarea
                id="whitelist-addresses"
                aria-describedby="whitelist-help"
                value={addresses}
                onChange={(event) => setAddresses(event.target.value)}
                disabled={saving}
                rows={5}
                maxLength={13000}
                spellCheck={false}
                autoCapitalize="none"
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 12,
                  resize: "vertical",
                  fontFamily: "var(--mono)",
                  fontSize: 14,
                }}
              />
              {addressError && (
                <p role="alert" className="loss" style={{ marginTop: 10 }}>
                  {addressError}
                </p>
              )}
              <button className="btn small" disabled={saving} style={{ marginTop: 12 }}>
                {saving
                  ? ka
                    ? "ინახება…"
                    : "Saving…"
                  : ka
                    ? "მისამართების შენახვა"
                    : "Save addresses"}
              </button>
            </form>
          </>
        )}
      </div>
      <div className="card-2" style={{ marginTop: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          {text.tips}
        </p>
        <ul style={{ paddingLeft: 20, color: "var(--muted)", fontSize: 13, lineHeight: 1.8 }}>
          <li>{text.tip1}</li>
          <li>{text.tip2}</li>
          <li>{text.tip3}</li>
          <li>{text.tip4}</li>
        </ul>
      </div>
      {toast && <div className="toast success">{toast.msg}</div>}
    </div>
  );
}
