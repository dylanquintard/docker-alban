import { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendEmailVerificationCode, verifyEmailCode } from "../api/user.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const OTP_CODE_REGEX = /^\d{6}$/;

export default function VerifyEmail() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, login } = useContext(AuthContext);
  const { tr } = useLanguage();

  useEffect(() => {
    if (location.state?.email) {
      setEmail(String(location.state.email).trim().toLowerCase());
    }
  }, [location.state]);

  useEffect(() => {
    if (user && token) {
      navigate("/profile");
    }
  }, [user, token, navigate]);

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    if (!normalizedEmail) {
      setError(tr("Email requis", "Email is required"));
      return;
    }

    if (!OTP_CODE_REGEX.test(normalizedCode)) {
      setError(tr("Le code doit contenir 6 chiffres", "Code must contain 6 digits"));
      return;
    }

    setLoading(true);
    try {
      const { user: verifiedUser, token: verifiedToken } = await verifyEmailCode({
        email: normalizedEmail,
        code: normalizedCode,
      });
      login(verifiedUser, verifiedToken);
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.error || tr("Code invalide ou expiré", "Invalid or expired code"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(tr("Email requis", "Email is required"));
      return;
    }

    setResendLoading(true);
    try {
      await resendEmailVerificationCode({ email: normalizedEmail });
      setInfo(
        tr(
          "Un nouveau code a été envoyé à votre email.",
          "A new verification code has been sent to your email."
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || tr("Impossible de renvoyer le code", "Unable to resend code"));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="section-shell py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.25em] text-saffron">
          {tr("Vérification email", "Email verification")}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">
          {tr("Entrez le code", "Verify your email")}
        </h1>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Saisissez le code a 6 chiffres reçu par email.",
            "Enter the 6-digit code we sent to your email address."
          )}
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {info && (
          <p className="mt-4 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {info}
          </p>
        )}

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder={tr("Email", "Email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            placeholder={tr("Code a 6 chiffres", "6-digit code")}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? tr("Vérification...", "Verifying...") : tr("Valider", "Verify email")}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading}
          className="mt-4 w-full rounded-full border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/10 disabled:opacity-60"
        >
          {resendLoading ? tr("Envoi...", "Sending...") : tr("Renvoyer le code", "Send a new code")}
        </button>

        <p className="mt-5 text-sm text-stone-300">
          <Link to="/login" className="font-semibold text-saffron hover:underline">
            {tr("Retour a la connexion", "Back to login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
