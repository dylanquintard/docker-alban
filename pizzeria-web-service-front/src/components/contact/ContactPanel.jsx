import { useContext, useEffect, useState } from "react";
import { sendContactEmail } from "../../api/contact.api";
import { AuthContext } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import { getLocalizedSiteText } from "../../site/siteSettings";
import { sanitizeAbsoluteHttpUrl } from "../../utils/url";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPanel({ sectionId, sectionClassName = "" }) {
  const { user } = useContext(AuthContext);
  const { language, tr } = useLanguage();
  const { settings } = useSiteSettings();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactFeedback, setContactFeedback] = useState("");
  const [contactFeedbackTone, setContactFeedbackTone] = useState("info");
  const [submittingContact, setSubmittingContact] = useState(false);

  useEffect(() => {
    if (!user) return;
    setContactName((prev) => prev || user.name || "");
    setContactEmail((prev) => prev || user.email || "");
  }, [user]);

  const handleContactSubmit = async (event) => {
    event.preventDefault();

    if (!contactName.trim()) {
      setContactFeedbackTone("error");
      setContactFeedback(tr("Le nom est obligatoire.", "Name is required."));
      return;
    }

    const normalizedEmail = contactEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setContactFeedbackTone("error");
      setContactFeedback(tr("L'email est obligatoire.", "Email is required."));
      return;
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setContactFeedbackTone("error");
      setContactFeedback(tr("Format d'email invalide.", "Invalid email format."));
      return;
    }

    if (!contactMessage.trim()) {
      setContactFeedbackTone("error");
      setContactFeedback(tr("Le message est obligatoire.", "Message is required."));
      return;
    }

    try {
      setSubmittingContact(true);
      setContactFeedback("");
      setContactFeedbackTone("info");
      await sendContactEmail({
        name: contactName.trim(),
        email: normalizedEmail,
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      });
      setContactSubject("");
      setContactMessage("");
      setContactFeedback(
        tr(
          "Message envoyé par email. Nous vous répondrons rapidement.",
          "Email sent. We will reply quickly."
        )
      );
      setContactFeedbackTone("success");
    } catch (err) {
      setContactFeedbackTone("error");
      setContactFeedback(
        err.response?.data?.error || tr("Impossible d'envoyer l'email.", "Unable to send email.")
      );
    } finally {
      setSubmittingContact(false);
    }
  };

  const phone = String(settings.contact?.phone || "").trim();
  const email = String(settings.contact?.email || "").trim();
  const address = String(settings.contact?.address || "").trim();
  const mapsUrl = sanitizeAbsoluteHttpUrl(settings.contact?.mapsUrl);
  const instagramUrl = sanitizeAbsoluteHttpUrl(settings.social?.instagramUrl);
  const facebookUrl = sanitizeAbsoluteHttpUrl(settings.social?.facebookUrl);
  const tiktokUrl = sanitizeAbsoluteHttpUrl(settings.social?.tiktokUrl);
  const serviceArea = getLocalizedSiteText(settings.contact?.serviceArea, language, "").trim();

  return (
    <section id={sectionId} className={sectionClassName}>
      <div className="rounded-3xl border border-white/10 bg-oven-glow p-8 sm:p-10">
        <p className="theme-light-keep-dark text-sm uppercase tracking-[0.25em] text-saffron">
          {tr("Nous contacter", "Contact us")}
        </p>
        <h2 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">
          {tr("On vous repond rapidement", "We reply quickly")}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl bg-charcoal/70 p-5">
            <p className="theme-light-keep-dark text-sm uppercase tracking-wider text-saffron">
              {tr("Telephone", "Phone")}
            </p>
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="mt-2 inline-flex text-lg font-semibold text-white hover:text-saffron"
              >
                {phone}
              </a>
            ) : (
              <p className="mt-2 text-lg font-semibold text-white">
                {tr("Numéro a venir", "Number coming soon")}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-charcoal/70 p-5">
            <p className="theme-light-keep-dark text-sm uppercase tracking-wider text-saffron">Email</p>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="mt-2 inline-flex text-lg font-semibold text-white hover:text-saffron"
              >
                {email}
              </a>
            ) : (
              <p className="mt-2 text-lg font-semibold text-white">adresse@email-a-venir.com</p>
            )}
          </div>
          <div className="rounded-2xl bg-charcoal/70 p-5">
            <p className="theme-light-keep-dark text-sm uppercase tracking-wider text-saffron">
              {tr("Infos utiles", "Useful info")}
            </p>
            {serviceArea ? <p className="mt-2 text-sm font-semibold text-white">{serviceArea}</p> : null}
            {address ? <p className="mt-2 text-sm text-stone-300">{address}</p> : null}
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-full border border-saffron/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
              >
                {tr("Voir sur la carte", "View on map")}
              </a>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Instagram
                </a>
              ) : null}
              {facebookUrl ? (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Facebook
                </a>
              ) : null}
              {tiktokUrl ? (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  TikTok
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/15 bg-charcoal/70 p-5">
          <p className="theme-light-keep-dark text-sm uppercase tracking-wider text-saffron">
            {tr("Formulaire de contact", "Contact form")}
          </p>
          <form onSubmit={handleContactSubmit} className="mt-3 space-y-3" aria-busy={submittingContact}>
            <label htmlFor="contact-name" className="sr-only">
              {tr("Votre nom", "Your name")}
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder={tr("Votre nom", "Your name")}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-stone-400 focus:border-saffron focus:outline-none"
              autoComplete="name"
              required
            />
            <label htmlFor="contact-email" className="sr-only">
              {tr("Votre email", "Your email")}
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder={tr("Votre email", "Your email")}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-stone-400 focus:border-saffron focus:outline-none"
              autoComplete="email"
              required
            />
            <label htmlFor="contact-subject" className="sr-only">
              {tr("Sujet (optionnel)", "Subject (optional)")}
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              value={contactSubject}
              onChange={(event) => setContactSubject(event.target.value)}
              placeholder={tr("Sujet (optionnel)", "Subject (optional)")}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-stone-400 focus:border-saffron focus:outline-none"
            />
            <label htmlFor="contact-message" className="sr-only">
              {tr("Votre message", "Your message")}
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={4}
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value)}
              placeholder={tr("Votre message", "Your message")}
              className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-stone-400 focus:border-saffron focus:outline-none"
              required
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submittingContact}
                className="rounded-full bg-saffron px-5 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingContact ? tr("Envoi...", "Sending...") : tr("Envoyer", "Send")}
              </button>
              {contactFeedback && (
                <p
                  role={contactFeedbackTone === "error" ? "alert" : "status"}
                  aria-live="polite"
                  className={`text-xs ${
                    contactFeedbackTone === "error" ? "text-red-200" : "text-emerald-200"
                  }`}
                >
                  {contactFeedback}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
