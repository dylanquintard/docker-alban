import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/user.api";
import { useLanguage } from "../context/LanguageContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const { tr } = useLanguage();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError(tr("Format d'email invalide", "Invalid email format"));
      return;
    }

    try {
      setLoading(true);
      await forgotPassword({ email: normalizedEmail });
      setInfo(
        tr(
          "Si ce compte existe, un lien de réinitialisation a été envoyé par email.",
          "If this account exists, a reset link has been sent by email."
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          tr("Impossible de lancer la reçuperation du mot de passe.", "Unable to send the password reset email.")
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
          {tr("Mot de passe oublié", "Reset your password")}
        </h1>

        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Entrez votre email. Nous enverrons un lien sécurisé pour définir un nouveau mot de passe.",
            "Enter your email. We will send a secure link to set a new password."
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
          <input
            type="email"
            placeholder={tr("Email", "Email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? tr("Envoi...", "Sending...") : tr("Recevoir le lien de réinitialisation", "Send me a reset link")}
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
