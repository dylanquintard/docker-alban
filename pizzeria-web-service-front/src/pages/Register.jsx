import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/user.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { buildFullName } from "../utils/personName";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function normalizePhone(value) {
  const compact = String(value || "").trim().replace(/[\s().-]/g, "");
  if (!compact) return "";
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+33${compact.slice(1)}`;
  return compact;
}

export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, token, login } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && token) navigate("/profile");
  }, [user, token, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);
    const fullName = buildFullName(firstName, lastName);

    if (!firstName.trim() || !lastName.trim()) {
      setError(tr("Le prénom et le nom sont obligatoires", "First and last names are required"));
      setLoading(false);
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError(tr("Format d'email invalide", "Invalid email format"));
      setLoading(false);
      return;
    }

    if (!E164_PHONE_REGEX.test(normalizedPhone)) {
      setError(
        tr(
          "Format de telephone invalide (exemple: +33612345678)",
          "Invalid phone format (example: +33612345678)"
        )
      );
      setLoading(false);
      return;
    }

    try {
      const registration = await registerUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password,
      });

      if (registration?.requiresEmailVerification) {
        navigate("/verify-email", {
          state: {
            email: normalizedEmail,
            verificationExpiresAt: registration?.verificationExpiresAt || null,
          },
        });
        return;
      }

      if (registration?.user && registration?.token) {
        login(registration.user, registration.token);
        navigate("/profile");
        return;
      }

      navigate("/login", { state: { email: normalizedEmail } });
    } catch (err) {
      setError(err.response?.data?.error || tr("Erreur lors de l'inscription", "Unable to create your account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-shell py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
        <p className="text-sm uppercase tracking-[0.25em] text-saffron">{tr("Inscription", "Register")}</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">{tr("Créer un compte", "Create your account")}</h1>

        {error && (
          <p className="mt-4 rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <input
            placeholder={tr("Prénom", "First name")}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <input
            placeholder={tr("Nom", "Last name")}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <input
            type="email"
            placeholder={tr("Email", "Email")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-white placeholder:text-stone-400"
            required
          />
          <input
            placeholder={tr("Telephone", "Phone")}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
            disabled={loading}
            className="w-full rounded-full bg-saffron px-5 py-3 text-sm font-bold uppercase tracking-wide text-charcoal hover:bg-yellow-300 disabled:opacity-60"
          >
            {loading ? tr("Creation...", "Creating account...") : tr("S'inscrire", "Sign up")}
          </button>
        </form>

        <p className="mt-5 text-sm text-stone-300">
          {tr("Déjà un compte?", "Already have an account?")}{" "}
          <Link to="/login" className="font-semibold text-saffron hover:underline">
            {tr("Se connecter", "Sign in")}
          </Link>
        </p>
      </div>
    </div>
  );
}
