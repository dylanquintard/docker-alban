import LegalPageLayout from "../components/legal/LegalPageLayout";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function LegalMentions() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const email = String(settings.contact?.email || "").trim() || "contact@exemple.fr";
  const phone = String(settings.contact?.phone || "").trim() || "+33";
  const address = String(settings.contact?.address || "").trim() || tr("Adresse communiquee sur demande", "Address available on request");

  return (
    <LegalPageLayout
      title={tr(`Mentions legales | ${siteName}`, `Legal notice | ${siteName}`)}
      description={tr(
        `Mentions legales et informations de publication du site ${siteName}.`,
        `Legal notice and publishing information for the ${siteName} website.`
      )}
      pathname="/mentions-legales"
      eyebrow={tr("Informations legales", "Legal information")}
      pageTitle={tr("Mentions legales", "Legal notice")}
      intro={tr(
        "Cette page rassemble les informations d'identification et de publication du site.",
        "This page gathers the website publishing and identification details."
      )}
      sections={[
        {
          title: tr("Editeur du site", "Website publisher"),
          paragraphs: [
            `${siteName}`,
            `${tr("Email", "Email")} : ${email}`,
            `${tr("Telephone", "Phone")} : ${phone}`,
            `${tr("Adresse", "Address")} : ${address}`,
          ],
        },
        {
          title: tr("Objet du site", "Website purpose"),
          paragraphs: [
            tr(
              "Le site présente l'activite du camion pizza, permet de consulter le menu, les horaires, les contenus editoriaux et de passer commande selon les créneaux disponibles.",
              "The website presents the pizza truck activity, allows visitors to browse the menu, opening hours, editorial content and place orders depending on available pickup slots."
            ),
          ],
        },
        {
          title: tr("Propriete intellectuelle", "Intellectual property"),
          paragraphs: [
            tr(
              "Les contenus, textes, visuels, logos et éléments graphiques du site ne peuvent pas être reproduits sans autorisation préalable.",
              "Website texts, visuals, logos and graphic elements may not be reproduced without prior authorization."
            ),
          ],
        },
      ]}
    />
  );
}
