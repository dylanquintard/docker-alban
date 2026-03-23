import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateMe } from "../api/user.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { buildFullName, splitPersonName } from "../utils/personName";

export default function Profile() {
  const { user, token, updateUserContext } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();

  const [editingProfile, setEditingProfile] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [editingPassword, setEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }
    const parsedName = splitPersonName(user);
    setFirstName(parsedName.firstName);
    setLastName(parsedName.lastName);
    setPhone(user.phone || "");
    setEmail(user.email || "");
  }, [user, token, navigate]);

  const setError = (text) => {
    setMessageType("error");
    setMessage(text);
  };

  const setSuccess = (text) => {
    setMessageType("success");
    setMessage(text);
  };

  const clearFeedback = () => {
    setMessage("");
    setMessageType("");
  };

  const handleProfileUpdate = async (event) => {
    event.preventDefault();
    setProfileLoading(true);
    clearFeedback();
    const fullName = buildFullName(firstName, lastName);

    if (!firstName.trim() || !lastName.trim()) {
      setError(tr("Le prénom et le nom sont obligatoires", "First and last names are required"));
      setProfileLoading(false);
      return;
    }

    try {
      const updatedUser = await updateMe(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName,
        phone,
      });
      updateUserContext(updatedUser);
      setSuccess(tr("Profil mis à jour avec succès.", "Profile updated successfully."));
      setEditingProfile(false);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          tr("Erreur lors de la mise à jour du profil", "Unable to save your profile changes")
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();
    setPasswordLoading(true);
    clearFeedback();

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(tr("Veuillez remplir tous les champs du mot de passe", "Please fill all password fields"));
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(tr("Le nouveau mot de passe et la confirmation ne correspondent pas", "New password and confirmation do not match"));
      setPasswordLoading(false);
      return;
    }

    try {
      await updateMe(token, { oldPassword, newPassword });
      setSuccess(tr("Mot de passe mis à jour avec succès.", "Password updated successfully."));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          tr("Erreur lors de la mise à jour du mot de passe", "Unable to change your password")
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const inputClassName =
    "w-full rounded-xl border border-white/20 bg-charcoal/70 px-4 py-3 text-sm text-white placeholder:text-stone-400 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/25";
  const secondaryButtonClassName =
    "rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClassName =
    "rounded-full bg-saffron px-5 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60";
  const roleLabel = user?.role === "ADMIN" ? tr("Administrateur", "Administrator") : tr("Client", "Customer");
  const liveFullName = buildFullName(firstName, lastName);
  const savedName = splitPersonName(user || {});
  const displayName = (liveFullName || savedName.fullName || tr("Utilisateur", "User")).trim();
  const displayFirstName = firstName || savedName.firstName || tr("Non renseigne", "Not provided");
  const displayLastName = lastName || savedName.lastName || tr("Non renseigne", "Not provided");
  const displayEmail = email || tr("Non renseigne", "Not provided");
  const displayPhone = phone || tr("Non renseigne", "Not provided");
  const avatarLetter = (displayName[0] || displayEmail[0] || "U").toUpperCase();
  const passwordMismatch = Boolean(confirmPassword && newPassword && newPassword !== confirmPassword);

  return (
    <div className="section-shell pb-20 pt-12 sm:pt-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
          <div className="bg-oven-glow p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="avatar-badge flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold">
                  {avatarLetter}
                </div>
                <div>
                  <p className="theme-light-keep-dark text-xs uppercase tracking-[0.25em] text-saffron">{tr("Espace client", "My account")}</p>
                  <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">{tr("Mon profil", "My profile")}</h1>
                </div>
              </div>
              <span className="theme-light-keep-dark rounded-full border border-saffron/55 bg-saffron/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-saffron">
                {roleLabel}
              </span>
            </div>
            <p className="mt-3 text-sm text-stone-300">
              {tr(
                "Vérifiez et mettez a jour vos informations personnelles.",
                "Review and update your personal details."
              )}
            </p>
          </div>
        </section>

        {message && (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              messageType === "success"
                ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/45 bg-red-500/10 text-red-200"
            }`}
          >
            {message}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-charcoal/45 p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="theme-light-keep-dark text-xs uppercase tracking-[0.22em] text-saffron">{tr("Informations", "Details")}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{tr("Informations personnelles", "Personal information")}</h2>
              </div>
              {!editingProfile && (
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setEditingProfile(true);
                  }}
                  className={secondaryButtonClassName}
                >
                  {tr("Modifier", "Edit")}
                </button>
              )}
            </div>

            {!editingProfile ? (
              <dl className="space-y-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{tr("Prénom", "First name")}</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{displayFirstName}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{tr("Nom", "Last name")}</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{displayLastName}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">Email</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{displayEmail}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-stone-400">{tr("Telephone", "Phone")}</dt>
                  <dd className="mt-1 text-base font-semibold text-white">{displayPhone}</dd>
                </div>
              </dl>
            ) : (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label htmlFor="profile-first-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Prénom", "First name")}
                  </label>
                  <input
                    id="profile-first-name"
                    type="text"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className={inputClassName}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="profile-last-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Nom", "Last name")}
                  </label>
                  <input
                    id="profile-last-name"
                    type="text"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className={inputClassName}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    Email
                  </label>
                  <input id="profile-email" type="email" value={email} disabled className={`${inputClassName} cursor-not-allowed opacity-70`} />
                  <p className="mt-1 text-xs text-stone-400">
                    {tr("L'email ne peut pas être modifie ici.", "Your email address cannot be changed here.")}
                  </p>
                </div>

                <div>
                  <label htmlFor="profile-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Telephone", "Phone")}
                  </label>
                  <input
                    id="profile-phone"
                    type="text"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={inputClassName}
                    required
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" disabled={profileLoading} className={primaryButtonClassName}>
                    {profileLoading ? tr("Mise à jour...", "Updating...") : tr("Enregistrer", "Save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false);
                      const parsedName = splitPersonName(user || {});
                      setFirstName(parsedName.firstName);
                      setLastName(parsedName.lastName);
                      setPhone(user?.phone || "");
                    }}
                    className={secondaryButtonClassName}
                    disabled={profileLoading}
                  >
                    {tr("Annuler", "Cancel")}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-charcoal/45 p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="theme-light-keep-dark text-xs uppercase tracking-[0.22em] text-saffron">{tr("Securite", "Security")}</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{tr("Mot de passe", "Password")}</h2>
              </div>
              {!editingPassword && (
                <button
                  type="button"
                  onClick={() => {
                    clearFeedback();
                    setEditingPassword(true);
                  }}
                  className={secondaryButtonClassName}
                >
                  {tr("Modifier", "Edit")}
                </button>
              )}
            </div>

            {!editingPassword ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-stone-300">
                  {tr(
                    "Pour renforcer la sécurité de votre compte, mettez à jour votre mot de passe régulièrement.",
                    "Use a strong password and update it regularly to keep your account secure."
                  )}
                </p>
              </div>
            ) : (
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div>
                  <label htmlFor="old-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Mot de passe actuel", "Current password")}
                  </label>
                  <input
                    id="old-password"
                    type="password"
                    value={oldPassword}
                    onChange={(event) => setOldPassword(event.target.value)}
                    className={inputClassName}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Nouveau mot de passe", "New password")}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={inputClassName}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-stone-300">
                    {tr("Confirmer le nouveau mot de passe", "Confirm new password")}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={inputClassName}
                    autoComplete="new-password"
                    required
                  />
                </div>

                {passwordMismatch && (
                  <p className="rounded-lg border border-red-400/45 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {tr("Le nouveau mot de passe et la confirmation ne correspondent pas", "New password and confirmation do not match")}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button type="submit" disabled={passwordLoading || passwordMismatch} className={primaryButtonClassName}>
                    {passwordLoading ? tr("Mise à jour...", "Updating...") : tr("Changer le mot de passe", "Change password")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPassword(false);
                      setOldPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className={secondaryButtonClassName}
                    disabled={passwordLoading}
                  >
                    {tr("Annuler", "Cancel")}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
