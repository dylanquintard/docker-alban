import { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginUser } from "../api/user.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { user, token, login } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.email && !email) {
      setEmail(String(location.state.email));
    }
  }, [location.state, email]);

  useEffect(() => {
    if (user && token) navigate("/profile");
  }, [user, token, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const { user: loggedUser, token } = await loginUser({ email, password });
      login(loggedUser, token);
      navigate("/profile");
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.code === "EMAIL_NOT_VERIFIED") {
        navigate("/verify-email", {
          state: {
            email: email.trim().toLowerCase(),
            verificationExpiresAt: apiError?.verificationExpiresAt || null,
          },
        });
        return;
      }
      setError(apiError?.error || tr("Erreur de connexion", "Unable to sign in"));
    }
  };

  return (
    <div className="section-shell py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.25em] text-saffron">{tr("Connexion", "Login")}</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">{tr("Espace client", "Sign in to your account")}</h1>

        {error && (
          <p className="mt-4 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
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
          <input
            type="password"
            placeholder={tr("Mot de passe", "Password")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <button
            type="submit"
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal hover:bg-yellow-300"
          >
            {tr("Se connecter", "Sign in")}
          </button>
        </form>

        <p className="mt-3 text-right text-sm">
          <Link to="/forgot-password" className="font-semibold text-saffron hover:underline">
            {tr("Mot de passe oublié ?", "Forgot password?")}
          </Link>
        </p>

        <p className="mt-5 text-sm text-stone-300">
          {tr("Pas encore de compte?", "New here?")}{" "}
          <Link to="/register" className="font-semibold text-saffron hover:underline">
            {tr("Créer un compte", "Create your account")}
          </Link>
        </p>
      </div>
    </div>
  );
}
