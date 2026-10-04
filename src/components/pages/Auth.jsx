import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { ensureUsdBalance, claimReferral } from "@/lib/api";
import LegalLinks from "@/components/LegalLinks";
import LanguageSwitch from "@/components/LanguageSwitch";
import { supabase } from "@/integrations/supabase/client";
import { MfaChallenge } from "@/components/Mfa";
import { legalLabels } from "@/lib/legal";
import { ChartNoAxesCombined, ArrowUpRight } from "lucide-react";

const REF_KEY = "novax_ref_code";

export default function Auth() {
  const { signIn, signUp, user, recovering, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const legal = legalLabels[language] || legalLabels.en;
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [recoveryFinished, setRecoveryFinished] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [factorId, setFactorId] = useState(null);
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const ka = language === "ka";
  const recovery = mode === "reset";
  const forgot = mode === "forgot";
  const text = ka
    ? {
        forgot: "პაროლის აღდგენა",
        forgotSub: "შეიყვანე ელფოსტა და მიიღე აღდგენის ბმული.",
        reset: "ახალი პაროლი",
        resetSub: "შექმენი ახალი პაროლი — მინიმუმ 8 სიმბოლო.",
        send: "აღდგენის ბმულის გაგზავნა",
        save: "პაროლის შენახვა",
        resend: "დადასტურების წერილის ხელახლა გაგზავნა",
        sent: "თუ ელფოსტა შესაბამის ანგარიშს ეკუთვნის, ბმულს მიიღებ. შეამოწმე სპამის საქაღალდეც.",
        saved: "პაროლი შეიცვალა. შედი ახალი პაროლით.",
        expired: "აღდგენის ბმული არ მოქმედებს ან ვადაგასულია. მოითხოვე ახალი ბმული.",
        back: "შესვლაზე დაბრუნება",
        email: "ჯერ შეიყვანე ელფოსტა.",
        mismatch: "პაროლები არ ემთხვევა.",
        confirm: "გაიმეორე პაროლი",
      }
    : {
        forgot: "Forgot password?",
        forgotSub: "Enter your email to receive a password reset link.",
        reset: "Choose a new password",
        resetSub: "Use at least 8 characters for your new password.",
        send: "Send reset link",
        save: "Save new password",
        resend: "Resend verification email",
        sent: "If this email is eligible, a link will arrive shortly. Check your spam folder too.",
        saved: "Password updated. Sign in with your new password.",
        expired: "This recovery link is invalid or expired. Request a new link.",
        back: "Back to sign in",
        email: "Enter your email address first.",
        mismatch: "Passwords do not match.",
        confirm: "Confirm new password",
      };
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (
      !recoveryFinished &&
      (recovering || new URLSearchParams(window.location.search).get("mode") === "recovery")
    )
      setMode("reset");
  }, [recovering, recoveryFinished]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendEmail(type) {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(text.email);
      return;
    }
    if (cooldown || loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { error: sendError } =
        type === "reset"
          ? await supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${window.location.origin}/auth?mode=recovery`,
            })
          : await supabase.auth.resend({
              type: "signup",
              email: email.trim(),
              options: { emailRedirectTo: `${window.location.origin}/auth` },
            });
      if (sendError) throw sendError;
      setNotice(text.sent);
      setCooldown(60);
    } catch (e) {
      setError(e.message || t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }
  async function savePassword(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError(text.mismatch);
      return;
    }
    setLoading(true);
    try {
      const { data: identity, error: identityError } = await supabase.auth.getUser();
      if (identityError || !identity.user) throw new Error(text.expired);
      const { data: level, error: levelError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (levelError) throw levelError;
      if (level.nextLevel === "aal2" && level.currentLevel !== "aal2") {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const factor = factors.totp.find((f) => f.status === "verified");
        if (!factor) throw new Error("Authenticator verification is unavailable");
        setFactorId(factor.id);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setRecoveryFinished(true);
      const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
      setMode("login");
      setPassword("");
      setConfirmation("");
      setNotice(signOutError ? `${text.saved} ${signOutError.message}` : text.saved);
      await navigate({ to: "/auth", replace: true, search: {} });
    } catch (e) {
      setError(e.message || t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    const stored = window.localStorage.getItem(REF_KEY);
    const code = (fromUrl || stored || "").trim().toUpperCase();
    if (code) {
      window.localStorage.setItem(REF_KEY, code);
      setRefCode(code);
      if (fromUrl && !new URLSearchParams(window.location.search).has("mode")) setMode("signup");
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && !acceptedLegal) {
      setError(legal.required);
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await signIn(email, password)
          : await signUp(email, password, acceptedLegal);

      if (result.error) throw result.error;

      if (!result.data.session) {
        setNotice(
          language === "ka"
            ? "დაადასტურეთ ელფოსტა და შემდეგ შედით ანგარიშში."
            : "Check your email to confirm your account, then sign in.",
        );
        return;
      }
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const factor = factors.totp.find((f) => f.status === "verified");
        if (!factor) throw new Error("Authenticator verification is unavailable");
        setFactorId(factor.id);
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(err.message || t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  }

  async function finishLogin() {
    await ensureUsdBalance();
    const pending = refCode || window.localStorage.getItem(REF_KEY);
    if (pending) {
      const result = await claimReferral(pending);
      if (result?.ok) window.localStorage.removeItem(REF_KEY);
    }
    navigate({ to: "/app" });
  }
  useEffect(() => {
    let alive = true;
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(async ({ data, error }) => {
        if (error || data?.nextLevel !== "aal2" || data.currentLevel === "aal2") return;
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp.find((f) => f.status === "verified");
        if (alive && factor) setFactorId(factor.id);
      })
      .catch((e) => {
        if (alive) setError(e.message || "Could not verify your session. Please retry.");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="auth-page">
      <aside className="auth-story">
        <span className="auth-art" aria-hidden="true">
          <ChartNoAxesCombined size={76} strokeWidth={1} />
          <ArrowUpRight size={30} />
        </span>
        <p className="eyebrow">{t("landing.heroEyebrow")}</p>
        <h2>{t("landing.heroTitle").replace("|", " ")}</h2>
        <p>{t("landing.heroText")}</p>
        <div className="auth-story-links">
          <LegalLinks />
        </div>
      </aside>
      <div className="auth-form-wrap">
        <Link className="brand" to="/" style={{ justifyContent: "center", marginBottom: 32 }}>
          <span className="brand-mark">
            <span>G</span>
          </span>
          GNG
        </Link>
        <div className="card fade-up auth-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <LanguageSwitch />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            {recovery
              ? text.reset
              : forgot
                ? text.forgot
                : mode === "login"
                  ? t("auth.welcome")
                  : t("auth.createAccount")}
          </h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 28 }}>
            {recovery
              ? text.resetSub
              : forgot
                ? text.forgotSub
                : mode === "login"
                  ? t("auth.loginSubtitle")
                  : t("auth.signupSubtitle")}
          </p>

          {!recovery && !forgot && (
            <div className="trade-tabs" style={{ marginBottom: 24 }}>
              <button
                className={`trade-tab ${mode === "login" ? "active" : ""}`}
                aria-pressed={mode === "login"}
                onClick={() => setMode("login")}
              >
                {t("auth.login")}
              </button>
              <button
                className={`trade-tab ${mode === "signup" ? "active" : ""}`}
                aria-pressed={mode === "signup"}
                onClick={() => setMode("signup")}
              >
                {t("auth.signup")}
              </button>
            </div>
          )}

          {notice && <p role="status">{notice}</p>}
          {factorId ? (
            <MfaChallenge
              factorId={factorId}
              ka={language === "ka"}
              onVerified={recovery ? async () => setFactorId(null) : finishLogin}
            />
          ) : recovery ? (
            <>
              {authLoading && (
                <p role="status">{ka ? "იტვირთება…" : "Checking recovery session…"}</p>
              )}
              {!authLoading && !user && <p role="alert">{text.expired}</p>}
              <form onSubmit={savePassword}>
                <div className="field">
                  <label htmlFor="reset-password">{text.reset}</label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">{text.confirm}</label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="loss">
                    {error}
                  </p>
                )}
                <button
                  className="btn"
                  disabled={loading || authLoading || !user}
                  style={{ width: "100%" }}
                >
                  {loading ? t("wallet.processing") : text.save}
                </button>
              </form>
              <button
                className="text-link"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setFactorId(null);
                }}
                style={{ marginTop: 16 }}
              >
                {text.forgot}
              </button>
            </>
          ) : forgot ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendEmail("reset");
              }}
            >
              <div className="field">
                <label htmlFor="recovery-email">{t("common.email")}</label>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p className="loss" role="alert">
                  {error}
                </p>
              )}
              <button className="btn" disabled={loading || cooldown > 0} style={{ width: "100%" }}>
                {cooldown ? `${text.send} (${cooldown}s)` : text.send}
              </button>
              <button
                type="button"
                className="text-link"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                {text.back}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="auth-email">{t("common.email")}</label>
                <input
                  type="email"
                  id="auth-email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="auth-password">{t("common.password")}</label>
                <input
                  type="password"
                  id="auth-password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={t("auth.passwordPlaceholder")}
                />
              </div>
              {mode === "signup" && (
                <div className="legal-consent">
                  <div className="legal-consent-row">
                    <input
                      id="accept-legal"
                      type="checkbox"
                      required
                      checked={acceptedLegal}
                      onChange={(e) => setAcceptedLegal(e.target.checked)}
                      aria-describedby="legal-risk"
                    />
                    <label htmlFor="accept-legal">
                      {legal.agree}{" "}
                      <a href="/terms" target="_blank" rel="noopener noreferrer">
                        {legal.terms}
                      </a>{" "}
                      {legal.acknowledge}{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer">
                        {legal.privacy}
                      </a>
                      .
                    </label>
                  </div>
                  <p id="legal-risk" className="muted-2">
                    {legal.risk}
                  </p>
                </div>
              )}
              {error && (
                <div
                  style={{
                    background: "rgba(240,97,109,0.1)",
                    border: "1px solid rgba(240,97,109,0.3)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "var(--red)",
                    marginBottom: 16,
                  }}
                >
                  {error}
                </div>
              )}
              <button
                className="btn"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={loading || (mode === "signup" && !acceptedLegal)}
              >
                {loading
                  ? t("common.pleaseWait")
                  : mode === "login"
                    ? t("auth.submitLogin")
                    : t("auth.submitSignup")}
              </button>
            </form>
          )}

          {!forgot && !recovery && (
            <div className="auth-help-actions">
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                {text.forgot}
              </button>
              <button
                className="text-link"
                type="button"
                disabled={loading || cooldown > 0}
                onClick={() => sendEmail("verify")}
              >
                {text.resend}
                {cooldown ? ` (${cooldown}s)` : ""}
              </button>
            </div>
          )}
          <p className="muted-2" style={{ fontSize: 12, textAlign: "center", marginTop: 20 }}>
            {t("auth.startingBalance")}
          </p>
        </div>
        <Link
          className="muted-2"
          to="/"
          style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 13 }}
        >
          {t("common.backHome")}
        </Link>
        <footer className="legal-footer">
          <LegalLinks />
        </footer>
      </div>
    </div>
  );
}
