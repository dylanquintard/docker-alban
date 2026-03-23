import PageFaqSection from "../components/common/PageFaqSection";
import ContactPanel from "../components/contact/ContactPanel";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";

export default function ContactPage() {
  const { language, tr } = useLanguage();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const siteDescription = getLocalizedSiteText(
    settings.siteDescription,
    language,
    tr(
      "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
      "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup."
    )
  );
  const contactPageTitle = getLocalizedSiteText(
    settings.contactPage?.pageTitle,
    language,
    tr("Nous contacter", "Get in touch")
  );
  const contactPageIntro = getLocalizedSiteText(
    settings.contactPage?.introText,
    language,
    siteDescription
  );
  const contactHelperText = getLocalizedSiteText(
    settings.contactPage?.helperText,
    language,
    ""
  );
  const title = tr(
    `Contact | ${siteName}`,
    `Contact | ${siteName}`
  );
  const description = tr(
    `Contactez ${siteName}. Informations de contact, réseaux et formulaire pour vos demandes.`,
    `Get in touch with ${siteName}. Contact details, social links and a contact form for your questions.`
  );
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const defaultOgImageUrl = String(settings.seo?.defaultOgImageUrl || "").trim();
  const socialUrls = [
    settings.social?.instagramUrl,
    settings.social?.facebookUrl,
    settings.social?.tiktokUrl,
  ].filter(Boolean);
  const contactJsonLd = [
    buildBaseFoodEstablishmentJsonLd({
      pagePath: "/contact",
      pageName: title,
      description,
      siteName,
      siteUrl: canonicalSiteUrl || undefined,
      phone: settings.contact?.phone,
      email: settings.contact?.email,
      address: settings.contact?.address,
      mapUrl: settings.contact?.mapsUrl,
      image: defaultOgImageUrl,
      socialUrls,
      areaServed: [
        getLocalizedSiteText(
          settings.contact?.serviceArea,
          language,
          tr("Moselle", "Moselle")
        ),
      ],
    }),
  ].filter(Boolean);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={title}
        description={description}
        pathname="/contact"
        jsonLd={contactJsonLd}
      />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("Contact", "Contact")}</p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          {contactPageTitle}
        </h1>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {contactPageIntro}
        </p>
        {contactHelperText ? (
          <p className="max-w-3xl text-sm text-stone-400 sm:text-base">{contactHelperText}</p>
        ) : null}
      </header>

      <ContactPanel />

      <PageFaqSection
        pathname="/contact"
        title={tr("Questions fréquentes", "Frequently asked questions")}
        intro={tr(
          "Quelques réponses utiles avant de nous écrire ou de nous appeler.",
          "A few useful answers before you write to us or call us."
        )}
      />
    </div>
  );
}
