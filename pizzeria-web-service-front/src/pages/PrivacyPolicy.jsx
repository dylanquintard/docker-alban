import LegalPageLayout from "../components/legal/LegalPageLayout";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function PrivacyPolicy() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const email = String(settings.contact?.email || "").trim() || "contact@exemple.fr";

  return (
    <LegalPageLayout
      title={tr(
        `Confidentialite | ${siteName}`,
        `Privacy policy | ${siteName}`
      )}
      description={tr(
        `Politique de confidentialite du site ${siteName}.`,
        `Privacy policy for the ${siteName} website.`
      )}
      pathname="/confidentialite"
      eyebrow={tr("Protection des données", "Data protection")}
      pageTitle={tr("Politique de confidentialite", "Privacy policy")}
      intro={tr(
        "Cette page explique quelles données peuvent être traitees via le site et dans quel but.",
        "This page explains which data may be processed through the website and for which purposes."
      )}
      sections={[
        {
          title: tr("Donnees collectees", "Collected data"),
          paragraphs: [
            tr(
              "Les données saisies dans les formulaires, dans l'espace client ou pendant la commande peuvent inclure votre nom, votre email, votre telephone et les informations nécessaires a la gestion de la commande.",
              "Data entered in forms, the customer account area or the ordering flow may include your name, email address, phone number and the information required to manage the order."
            ),
          ],
        },
        {
          title: tr("Utilisation des données", "Use of data"),
          paragraphs: [
            tr(
              "Ces informations sont utilisees pour repondre a vos demandes, organiser le retrait, assurer le suivi de commande et gerer la relation client.",
              "This information is used to answer your requests, organize pickup, handle order follow-up and manage the customer relationship."
            ),
          ],
        },
        {
          title: tr("Contact", "Contact"),
          paragraphs: [
            tr(
              `Pour toute question sur vos données personnelles, vous pouvez écrire a ${email}.`,
              `For any question regarding your personal data, you can contact ${email}.`
            ),
          ],
        },
      ]}
    />
  );
}
