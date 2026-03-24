import { Link } from "react-router-dom";
import CompactServiceInfoPanel from "../components/common/CompactServiceInfoPanel";
import PageFaqSection from "../components/common/PageFaqSection";
import CompactReviewsPanel from "../components/reviews/CompactReviewsPanel";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function APropos() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const companyName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const title = tr(
    `A propos | ${companyName}, camion pizza napolitaine en Moselle`,
    `About | ${companyName}, Neapolitan pizza truck in Moselle`
  );
  const description = tr(
    `${companyName} est un camion pizza en Moselle, actif autour de Thionville et des communes voisines, avec une carte courte, une cuisson bois-gaz et un retrait organise.`,
    `${companyName} is a pizza truck in Moselle, active around Thionville and nearby towns, with a focused menu, wood-gas baking and organized pickup.`
  );
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const defaultOgImageUrl = String(settings.seo?.defaultOgImageUrl || "").trim();
  const menuUrl = canonicalSiteUrl ? `${canonicalSiteUrl.replace(/\/+$/, "")}/menu` : "/menu";
  const socialUrls = [
    settings.social?.instagramUrl,
    settings.social?.facebookUrl,
    settings.social?.tiktokUrl,
  ].filter(Boolean);
  const aboutJsonLd = [
    buildBaseFoodEstablishmentJsonLd({
      pagePath: "/a-propos",
      pageName: title,
      description,
      siteName: companyName,
      siteUrl: canonicalSiteUrl || undefined,
      phone: settings.contact?.phone,
      email: settings.contact?.email,
      address: settings.contact?.address,
      mapUrl: settings.contact?.mapsUrl,
      image: defaultOgImageUrl,
      socialUrls,
      areaServed: ["Moselle", "Thionville"],
      extra: {
        "@type": "FoodTruck",
        hasMenu: menuUrl,
      },
    }),
  ].filter(Boolean);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={title}
        description={description}
        pathname="/a-propos"
        jsonLd={aboutJsonLd}
      />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("A propos", "About")}</p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          {tr(
            `${companyName}, un camion pizza pense pour bien servir la Moselle`,
            `${companyName}, a pizza truck built to serve Moselle well`
          )}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/planing"
            className="inline-flex rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
          >
            {tr("Voir les emplacements et horaires", "See locations and opening hours")}
          </Link>
          <Link
            to="/menu"
            className="inline-flex rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Voir le menu", "See the menu")}
          </Link>
        </div>
        <div className="flex justify-end pt-1">
          <CompactReviewsPanel compact className="w-full max-w-[336px]" />
        </div>
      </header>

      <div className="flex justify-end">
        <div className="mr-auto grid max-w-2xl gap-5">
          <section className="glass-panel p-6">
            <h2 className="text-xl font-bold text-saffron">Notre camion pizza</h2>
            <p className="mt-3 text-base leading-8 text-stone-200">
              Installe en Moselle, pres de Thionville (57), notre camion pizza vous propose des pizzas artisanales preparees avec soin et passion. Nous venons au plus pres de vous pour partager une cuisine conviviale, genereuse et pleine d'authenticite.
            </p>
          </section>

          <section className="glass-panel p-6">
            <h2 className="text-xl font-bold text-saffron">Notre facon de faire</h2>
            <p className="mt-3 text-base leading-8 text-stone-200">
              Nous selectionnons des produits italiens de qualite pour composer une base d'ingredients savoureuse, avec une pate travaillee facon napolitaine, bien aeree et legere. Le tout est cuit dans un four napolitain au feu de bois, pour offrir des pizzas riches en gout et en caractere.
            </p>
          </section>
        </div>

        <CompactServiceInfoPanel className="w-full max-w-[336px]" />
      </div>
      <PageFaqSection
        pathname="/a-propos"
        title={tr("Questions frequentes", "Frequently asked questions")}
      />
    </div>
  );
}
