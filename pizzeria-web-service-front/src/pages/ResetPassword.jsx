import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/user.api";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tr } = useLanguage();

  const resetEmail = useMemo(
    () => String(searchParams.get("email") || "").trim().toLowerCase(),
    [searchParams]
  );
  const resetToken = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams]
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const redirectTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = resetEmail;
    const normalizedToken = resetToken;

    if (!normalizedEmail) {
      setError(tr("Lien invalide: email manquant", "Invalid link: missing email"));
      return;
    }

    if (!normalizedToken) {
      setError(tr("Lien invalide: token manquant", "Invalid link: missing token"));
      return;
    }

    if (password.length < 8) {
      setError(tr("Le mot de passe doit contenir au moins 8 caracteres", "Password must be at least 8 characters"));
      return;
    }

    if (password !== confirmPassword) {
      setError(tr("Les mots de passe ne correspondent pas", "Passwords do not match"));
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        email: normalizedEmail,
        token: normalizedToken,
        password,
      });
      setInfo(tr("Mot de passe mis à jour. Redirection vers la connexion...", "Password updated. Redirecting to login..."));
      redirectTimeoutRef.current = setTimeout(
        () => navigate("/login", { replace: true, state: { email: normalizedEmail } }),
        900
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          tr("Lien invalide ou expire", "This password reset link is invalid or has expired")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-shell py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.25em] text-saffron">
          {tr("Securite compte", "Account security")}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">
          {tr("Nouveau mot de passe", "Set a new password")}
        </h1>
        <p className="mt-3 text-sm text-stone-300">
          {resetEmail
            ? tr(
                `Reinitialisation pour ${resetEmail}`,
                `Resetting password for ${resetEmail}`
              )
            : tr(
                "Le lien de réinitialisation est incomplet.",
                "This password reset link is incomplete."
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-200">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              {tr("Email associe", "Linked email")}
            </p>
            <p className="mt-1 break-all text-white">
              {resetEmail || tr("Non disponible", "Unavailable")}
            </p>
            <p className="mt-2 text-xs text-stone-400">
              {tr(
                "L'adresse email et le token de réinitialisation sont verrouillés depuis le lien reçu.",
                "The email address and reset token are locked from the link you received."
              )}
            </p>
          </div>

          <label className="block text-sm text-stone-200" htmlFor="reset-password">
            {tr("Nouveau mot de passe", "New password")}
          </label>
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />

          <label className="block text-sm text-stone-200" htmlFor="reset-password-confirm">
            {tr("Confirmer le mot de passe", "Confirm password")}
          </label>
          <input
            id="reset-password-confirm"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? tr("Mise à jour...", "Updating...") : tr("Mettre à jour", "Save new password")}
          </button>
        </form>

        <p className="mt-5 text-sm text-stone-300">
          <Link to="/login" className="font-semibold text-saffron hover:underline">
            {tr("Retour a la connexion", "Back to login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
