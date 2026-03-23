import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { loginUser, logoutUser } from "@shared/api/user.api";
import { AuthContext } from "@shared/context/AuthContext";
import { useLanguage } from "@shared/context/LanguageContext";

function getRedirectTarget(locationState) {
  const nextPath = String(locationState?.from || "").trim();
  return nextPath || "/";
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { user, token, login } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "http://localhost:8000";

  useEffect(() => {
    if (user?.role === "ADMIN" && token) {
      navigate(getRedirectTarget(location.state), { replace: true });
    }
  }, [location.state, navigate, token, user]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const { user: loggedUser, token: nextToken } = await loginUser({ email, password });
      if (loggedUser?.role !== "ADMIN") {
        await logoutUser(nextToken).catch(() => undefined);
        setError(
          tr(
            "Acces refuse : administrateur uniquement.",
            "Access denied: admin only."
          )
        );
        return;
      }

      login(loggedUser, nextToken);
      navigate(getRedirectTarget(location.state), { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          tr("Erreur de connexion", "Unable to sign in")
      );
    }
  };

  return (
    <div className="admin-auth-shell">
      <div className="admin-auth-card">
        <p className="text-xs uppercase tracking-[0.28em] text-saffron">
          {tr("Administration", "Administration")}
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">
          {tr("Connexion admin", "Admin sign in")}
        </h1>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          {tr(
            "Acces reserve a la gestion du site. Le reste des espaces sera separe progressivement dans la V2.",
            "Access reserved for site management. The remaining spaces will be separated progressively in V2."
          )}
        </p>

        {error ? (
          <p className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder={tr("Email admin", "Admin email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <input
            type="password"
            placeholder={tr("Mot de passe", "Password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <button
            type="submit"
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Entrer dans l'admin", "Enter admin")}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-300">
          <a
            href={publicSiteUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-saffron hover:underline"
          >
            {tr("Retour au site", "Back to site")}
          </a>
        </div>
      </div>
    </div>
  );
}
