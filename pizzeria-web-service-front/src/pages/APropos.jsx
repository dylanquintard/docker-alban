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
        <Link
          to="/planing"
          className="inline-flex rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
        >
          {tr("Voir les emplacements et horaires", "See locations and opening hours")}
        </Link>
        <div className="flex justify-end pt-1">
          <CompactReviewsPanel className="w-full max-w-[420px]" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start">
        <section className="glass-panel p-6">
          <h2 className="text-xl font-bold text-white">
            {tr("Ou trouver le camion en Moselle ?", "Where can you find the truck in Moselle?")}
          </h2>
          <p className="mt-3 text-sm text-stone-300">
            {tr(
              `${companyName} se deplace chaque semaine sur plusieurs communes de Moselle, autour de Thionville et des secteurs voisins.`,
              `${companyName} moves every week across several towns in Moselle, around Thionville and nearby areas.`
            )}
          </p>
          <p className="mt-3 text-sm text-stone-300">
            {tr(
              "Les lieux de passage et les horaires ne sont pas figes. Ils suivent la tournee publiee sur le planning.",
              "Locations and opening hours are not fixed. They follow the route published in the weekly schedule."
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/planing"
              className="rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
            >
              {tr("Voir la tournee de la semaine", "See this week's route")}
            </Link>
            <Link
              to="/menu"
              className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
            >
              {tr("Voir le menu", "See the menu")}
            </Link>
          </div>
        </section>

        <CompactServiceInfoPanel />
      </div>
      <PageFaqSection
        pathname="/a-propos"
        title={tr("Questions frequentes", "Frequently asked questions")}
      />
    </div>
  );
}
