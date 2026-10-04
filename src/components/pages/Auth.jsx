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

const REF_KEY = "novax_ref_code";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const { t, language } = useLanguage();
  const legal = legalLabels[language] || legalLabels.en;
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [factorId, setFactorId] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    const stored = window.localStorage.getItem(REF_KEY);
    const code = (fromUrl || stored || "").trim().toUpperCase();
    if (code) {
      window.localStorage.setItem(REF_KEY, code);
      setRefCode(code);
      if (fromUrl) setMode("signup");
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
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(async ({ data, error }) => {
      if (error || data?.nextLevel !== "aal2" || data.currentLevel === "aal2") return;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === "verified");
      if (alive && factor) setFactorId(factor.id);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "20px" }}>
      <div className="grid-glow" />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: "420px" }}>
        <Link className="brand" to="/" style={{ justifyContent: "center", marginBottom: 32 }}>
          <span className="brand-mark">
            <span>G</span>
          </span>
          GNG
        </Link>
        <div className="card fade-up">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <LanguageSwitch />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            {mode === "login" ? t("auth.welcome") : t("auth.createAccount")}
          </h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 28 }}>
            {mode === "login" ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
          </p>

          <div className="trade-tabs" style={{ marginBottom: 24 }}>
            <button
              className={`trade-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              {t("auth.login")}
            </button>
            <button
              className={`trade-tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => setMode("signup")}
            >
              {t("auth.signup")}
            </button>
          </div>

          {notice && <p role="status">{notice}</p>}
          {factorId ? (
            <MfaChallenge factorId={factorId} ka={language === "ka"} onVerified={finishLogin} />
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>{t("common.email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("auth.emailPlaceholder")}
                />
              </div>
              <div className="field">
                <label>{t("common.password")}</label>
                <input
                  type="password"
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
