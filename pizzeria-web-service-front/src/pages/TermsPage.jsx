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
        `Ces conditions définissent les modalités d’utilisation du site ${siteName}, de l’espace client et du service de commande en ligne.`,
        `These terms define how the ${siteName} website, customer area and online ordering service may be used.`
      )}
      sections={[
        {
          title: tr("Accès au site", "Website access"),
          paragraphs: [
            tr(
              "Le site est accessible sous réserve de disponibilité. Il Forno D’oro se réserve la possibilité d’interrompre temporairement l’accès au site pour des opérations de maintenance, des mises à jour ou des raisons techniques.",
              "The website is accessible subject to availability. Il Forno D’oro may temporarily suspend access for maintenance, updates or technical reasons."
            ),
          ],
        },
        {
          title: tr("Commandes et disponibilités", "Orders and availability"),
          paragraphs: [
            tr(
              "Les commandes en ligne sont soumises aux créneaux de commande proposés, aux disponibilités des produits et aux modalités de retrait indiquées sur le site.",
              "Online orders are subject to the offered ordering slots, product availability and pickup terms shown on the website."
            ),
            tr(
              "Les horaires, emplacements du foodtruck, menus et disponibilités peuvent évoluer en fonction de la tournée et des contraintes d’exploitation. Les informations communiquées lors de la commande prévalent pour son traitement.",
              "Opening hours, food truck locations, menus and availability may change according to the route and operational constraints. Information provided when an order is placed takes precedence for processing it."
            ),
          ],
        },
        {
          title: tr("Utilisation du site", "Use of the website"),
          paragraphs: [
            tr(
              "L’utilisateur s’engage à fournir des informations exactes, notamment lors de la création d’un compte ou du passage d’une commande, et à utiliser le site conformément à sa destination et à la réglementation applicable.",
              "Users agree to provide accurate information, especially when creating an account or placing an order, and to use the website in accordance with its purpose and applicable regulations."
            ),
          ],
        },
      ]}
    />
  );
}
