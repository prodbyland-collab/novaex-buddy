import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Authentication failed";
}

export function MfaChallenge({
  factorId,
  onVerified,
  ka = false,
}: {
  factorId: string;
  onVerified: () => Promise<void>;
  ka?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
            factorId,
            code,
          });
          if (verifyError) throw verifyError;
          await onVerified();
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor="mfa-code">
          {ka ? "ავთენტიფიკატორის 6-ნიშნა კოდი" : "Six-digit authenticator code"}
        </label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </div>
      {error && (
        <p className="loss" role="alert">
          {error}
        </p>
      )}
      <button className="btn small" disabled={busy || code.length !== 6}>
        {ka ? "დადასტურება" : "Verify"}
      </button>
    </form>
  );
}

export function MfaSettings({ ka = false }: { ka?: boolean }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    setFactorId(data.totp.find((factor) => factor.status === "verified")?.id ?? null);
  }, []);
  useEffect(() => {
    load().catch((err) => setError(message(err)));
  }, [load]);
  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      for (const factor of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) throw removeError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "GNG Exchange",
        friendlyName: "Authenticator",
      });
      if (enrollError) throw enrollError;
      if (!("totp" in data)) throw new Error("Authenticator setup failed");
      setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (!factorId) return;
    setBusy(true);
    setError("");
    try {
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
      if (removeError) throw removeError;
      await load();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section style={{ marginBottom: 24 }}>
      <h3>{ka ? "ორფაქტორიანი ავთენტიფიკაცია" : "Two-factor authentication"}</h3>
      <p className="muted" style={{ margin: "8px 0" }}>
        {ka
          ? "გამოიყენეთ ავთენტიფიკატორის აპი შესვლის დასაცავად."
          : "Use an authenticator app to protect sign-in."}
      </p>
      {error && (
        <p className="loss" role="alert">
          {error}
        </p>
      )}
      {enrollment ? (
        <>
          <img
            src={enrollment.qr}
            alt={ka ? "ავთენტიფიკატორის QR კოდი" : "Authenticator QR code"}
            width={200}
            height={200}
          />
          <p className="muted" style={{ overflowWrap: "anywhere", margin: "12px 0" }}>
            {ka ? "ხელით შესაყვანი გასაღები" : "Manual setup key"}: {enrollment.secret}
          </p>
          <MfaChallenge
            factorId={enrollment.id}
            ka={ka}
            onVerified={async () => {
              setEnrollment(null);
              await load();
            }}
          />
          <button
            className="btn small ghost"
            onClick={async () => {
              const { error: removeError } = await supabase.auth.mfa.unenroll({
                factorId: enrollment.id,
              });
              if (removeError) setError(removeError.message);
              else setEnrollment(null);
            }}
          >
            {ka ? "გაუქმება" : "Cancel"}
          </button>
        </>
      ) : (
        <button className="btn small ghost" disabled={busy} onClick={factorId ? disable : enroll}>
          {factorId
            ? ka
              ? "2FA-ის გამორთვა"
              : "Disable 2FA"
            : ka
              ? "2FA-ის დაყენება"
              : "Set up 2FA"}
        </button>
      )}
    </section>
  );
}
