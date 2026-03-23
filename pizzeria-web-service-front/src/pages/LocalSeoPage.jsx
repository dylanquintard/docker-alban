import { Link } from "react-router-dom";
import PageFaqSection from "../components/common/PageFaqSection";
import SeoHead from "../components/seo/SeoHead";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd, buildBreadcrumbJsonLd } from "../seo/jsonLd";
import { LOCAL_PAGE_CONTENT } from "../seo/localLandingContent";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function LocalSeoPage({ cityKey }) {
  const { settings } = useSiteSettings();
  const content = LOCAL_PAGE_CONTENT[cityKey] || LOCAL_PAGE_CONTENT.moselle;
  const cityLabel = cityKey === "moselle" ? "Moselle" : "Thionville";
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const localJsonLd = [
    buildBaseFoodEstablishmentJsonLd({
      pagePath: content.pathname,
      pageName: content.title,
      description: content.description,
      siteName,
      siteUrl: canonicalSiteUrl || undefined,
      phone: settings.contact?.phone,
      email: settings.contact?.email,
      address: settings.contact?.address,
      mapUrl: settings.contact?.mapsUrl,
      image: settings.seo?.defaultOgImageUrl,
      socialUrls: [
        settings.social?.instagramUrl,
        settings.social?.facebookUrl,
        settings.social?.tiktokUrl,
      ],
      areaServed: [cityLabel, "Moselle"],
    }),
        buildBreadcrumbJsonLd(
          [
            { name: "Accueil", path: "/" },
            { name: "Horaires", path: "/planing" },
            { name: cityLabel, path: content.pathname },
          ],
          canonicalSiteUrl || undefined
        ),
  ].filter(Boolean);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={content.title}
        description={content.description}
        pathname={content.pathname}
        jsonLd={localJsonLd}
      />

      <header className="space-y-3">
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">{content.h1}</h1>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">{content.intro}</p>
      </header>

      {Array.isArray(content.sections) &&
        content.sections.map((section) => (
          <section key={section.heading} className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm leading-7 text-stone-300">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-saffron">
          Le camion n&apos;est pas disponible en permanence dans cette ville.{" "}
          <Link to="/planing" className="underline decoration-saffron underline-offset-2">
            Horaires & déplacements du camion
          </Link>
        </p>
        <PageFaqSection
          pathname={content.pathname}
          title={`Questions fréquentes sur ${cityLabel}`}
        />
      </div>

      <section className="glass-panel p-6">
        <h2 className="text-lg font-bold text-white">Commander votre pizza</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/menu"
            className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            Voir le menu des pizzas
          </Link>
          <Link
            to="/planing"
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Consulter les horaires d'ouvertures du camion pizza
          </Link>
        </div>
      </section>
    </div>
  );
}
