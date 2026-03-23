import LegalPageLayout from "../components/legal/LegalPageLayout";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function TermsPage() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;

  return (
    <LegalPageLayout
      title={tr(
        `Conditions d'utilisation | ${siteName}`,
        `Terms of use | ${siteName}`
      )}
      description={tr(
        `Conditions d'utilisation du site ${siteName}.`,
        `Terms of use for the ${siteName} website.`
      )}
      pathname="/conditions-generales"
      eyebrow={tr("Utilisation du site", "Website use")}
      pageTitle={tr("Conditions d'utilisation", "Terms of use")}
      intro={tr(
        "Ces conditions encadrent l'utilisation du site, de l'espace client et des fonctions de commande.",
        "These terms govern the use of the website, customer account area and ordering features."
      )}
      sections={[
        {
          title: tr("Accès au service", "Access to the service"),
          paragraphs: [
            tr(
              "Le site est accessible sous réserve de maintenance, d'indisponibilité temporaire ou d'évolution du service.",
              "The website remains accessible subject to maintenance, temporary downtime or service updates."
            ),
          ],
        },
        {
          title: tr("Commande et disponibilité", "Ordering and availability"),
          paragraphs: [
            tr(
              "Les commandes restent soumises aux créneaux ouverts, aux emplacements disponibles et a la validation finale du service.",
              "Orders remain subject to available pickup slots, active locations and final service validation."
            ),
            tr(
              "Les informations affichees sur le site peuvent évoluer selon la tournée, les horaires et les contraintes d'exploitation.",
              "Information displayed on the website may change depending on the weekly route, opening hours and operating constraints."
            ),
          ],
        },
        {
          title: tr("Bon usage", "Proper use"),
          paragraphs: [
            tr(
              "L'utilisateur s'engage a fournir des informations exactes et a utiliser le site conformement a sa destination.",
              "Users agree to provide accurate information and use the website for its intended purpose."
            ),
          ],
        },
      ]}
    />
  );
}
