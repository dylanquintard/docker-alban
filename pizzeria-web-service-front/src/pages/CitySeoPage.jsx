import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { getLocations } from "../api/location.api";
import { getSeoLocations } from "../api/seo.api";
import { getPublicWeeklySettings } from "../api/timeslot.api";
import PageFaqSection from "../components/common/PageFaqSection";
import PublicReviewsSection from "../components/reviews/PublicReviewsSection";
import SeoHead from "../components/seo/SeoHead";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd, buildBreadcrumbJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";
import {
  BLOCKED_LOCAL_CITY_SLUGS,
  buildDynamicCityContent,
  FIXED_LOCAL_CITY_SLUGS,
  getFixedCityPathBySlug,
  slugifyCity,
} from "../seo/localLandingContent";

const DAY_LABELS = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

function toDisplayCity(citySlug) {
  const normalized = String(citySlug || "")
    .replace(/-/g, " ")
    .trim();

  if (!normalized) return "Moselle";
  return normalized
    .split(" ")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function formatHourValue(timeValue) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(timeValue || "").trim());
  if (!match) return "--";
  const hours = match[1];
  const minutes = match[2];
  return minutes === "00" ? `${hours}H` : `${hours}H${minutes}`;
}

function formatHourRange(startTime, endTime) {
  return `${formatHourValue(startTime)}-${formatHourValue(endTime)}`;
}

function formatAddress(location) {
  if (!location) return "";
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function getSeoLocationLabel(location) {
  return String(location?.name || location?.city || "").trim();
}

function normalizeSeoCatalogEntries(entries) {
  const source = Array.isArray(entries) ? entries : [];
  const bySlug = new Map();

  for (const item of source) {
    const slug = slugifyCity(item?.slug);
    if (!slug) continue;

    const label = String(item?.label || "").trim() || toDisplayCity(slug);
    const locationId = Number(item?.locationId);
    const path = String(item?.path || `/pizza-${slug}`).trim() || `/pizza-${slug}`;
    const existing = bySlug.get(slug);

    if (!existing) {
      bySlug.set(slug, {
        slug,
        label,
        path,
        locationId: Number.isFinite(locationId) && locationId > 0 ? locationId : null,
      });
      continue;
    }

    bySlug.set(slug, {
      ...existing,
      label: existing.label || label,
      path: existing.path || path,
      locationId:
        Number.isFinite(locationId) && locationId > 0
          ? locationId
          : existing.locationId,
    });
  }

  return [...bySlug.values()].sort((a, b) => a.path.localeCompare(b.path, "fr"));
}

function buildCatalogFromLocations(entries) {
  const source = Array.isArray(entries) ? entries : [];
  const fallback = [];
  for (const location of source) {
    const locationId = Number(location?.id);
    const labelCandidates = [location?.city, location?.name].filter(Boolean);
    for (const candidate of labelCandidates) {
      const slug = slugifyCity(candidate);
      if (!slug || BLOCKED_LOCAL_CITY_SLUGS.includes(slug)) continue;
      fallback.push({
        slug,
        label: String(candidate).trim(),
        path: `/pizza-${slug}`,
        locationId: Number.isFinite(locationId) && locationId > 0 ? locationId : null,
      });
    }
  }
  return normalizeSeoCatalogEntries(fallback);
}

function CityPageNotFound({ citySlug }) {
  const pathname = citySlug ? `/pizza-${citySlug}` : "/404";
  return (
    <div className="section-shell space-y-6 pb-20 pt-12">
      <SeoHead
        title={`Page locale non disponible | ${DEFAULT_SITE_SETTINGS.siteName}`}
        description="Cette page locale n'est pas disponible."
        pathname={pathname}
        robots="noindex,nofollow"
      />
      <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
        Page locale non disponible
      </h1>
      <p className="max-w-2xl text-sm text-stone-300 sm:text-base">
        Cette ville n'est pas encore active dans les emplacements publies.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/planing"
          className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
        >
          Voir les horaires d'ouvertures
        </Link>
        <Link
          to="/"
          className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          Retour a l'accueil
        </Link>
      </div>
    </div>
  );
}

export default function CitySeoPage({ forcedCitySlug = "" }) {
  const { settings } = useSiteSettings();
  const location = useLocation();
  const params = useParams();
  const rawCity = forcedCitySlug || params.city || params["*"] || "";
  const citySlugFromPath = slugifyCity(rawCity);
  const queryLocationId = useMemo(() => {
    const search = new URLSearchParams(location.search);
    const value =
      search.get("locationId") || search.get("locationID") || search.get("locationid");
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [location.search]);
  const [weeklySettings, setWeeklySettings] = useState([]);
  const [seoCatalog, setSeoCatalog] = useState([]);
  const [locations, setLocations] = useState([]);
  const [allowedLoaded, setAllowedLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPublicWeeklySettings()
      .then((data) => {
        if (!cancelled) {
          setWeeklySettings(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeeklySettings([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      const [locationsResult, seoResult] = await Promise.allSettled([
        getLocations({ active: true }),
        getSeoLocations(),
      ]);

      if (cancelled) return;

      const activeLocations =
        locationsResult.status === "fulfilled" && Array.isArray(locationsResult.value)
          ? locationsResult.value
          : [];
      setLocations(activeLocations);

      const normalizedSeoCatalog =
        seoResult.status === "fulfilled"
          ? normalizeSeoCatalogEntries(seoResult.value?.locations)
          : [];

      if (normalizedSeoCatalog.length > 0) {
        setSeoCatalog(normalizedSeoCatalog);
      } else {
        setSeoCatalog(buildCatalogFromLocations(activeLocations));
      }

      setAllowedLoaded(true);
    };

    loadCatalog().catch(() => {
      if (cancelled) return;
      setLocations([]);
      setSeoCatalog([]);
      setAllowedLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const locationBuckets = useMemo(() => {
    const map = new Map();
    const source = Array.isArray(weeklySettings) ? weeklySettings : [];
    const locationsById = new Map(
      (Array.isArray(locations) ? locations : [])
        .map((location) => [Number(location?.id), location])
        .filter(([locationId]) => Number.isFinite(locationId) && locationId > 0)
    );

    for (const dayEntry of source) {
      const services =
        Array.isArray(dayEntry?.services) && dayEntry.services.length > 0
          ? dayEntry.services
          : dayEntry?.isOpen && dayEntry?.location
            ? [
                {
                  startTime: dayEntry.startTime,
                  endTime: dayEntry.endTime,
                  location: dayEntry.location,
                },
              ]
            : [];

      for (const service of services) {
        const locationId = Number(service?.locationId || dayEntry?.locationId);
        const location =
          service?.location ||
          (Number.isFinite(locationId) && locationId > 0 ? locationsById.get(locationId) : null);
        const label = getSeoLocationLabel(location);
        const slug = slugifyCity(label);
        if (!slug) continue;

        if (!map.has(slug)) {
          map.set(slug, {
            slug,
            label,
            entries: [],
          });
        }

        const dayLabel = DAY_LABELS[dayEntry?.dayOfWeek] || dayEntry?.dayOfWeek || "";
        const hours = formatHourRange(service?.startTime, service?.endTime);
        const locationName = location?.name || location?.city || "Emplacement";
        const address = formatAddress(location);
        const dedupeKey = `${locationName}|${address}|${dayLabel}|${hours}`;
        const bucket = map.get(slug);
        const alreadyExists = bucket.entries.some((entry) => entry.key === dedupeKey);

        if (!alreadyExists) {
          bucket.entries.push({
            key: dedupeKey,
            locationName,
            address,
            dayLabel,
            hours,
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [locations, weeklySettings]);

  const catalogBySlug = useMemo(() => {
    const map = new Map();
    for (const item of seoCatalog) {
      if (item?.slug) map.set(item.slug, item);
    }
    return map;
  }, [seoCatalog]);

  const catalogByLocationId = useMemo(() => {
    const map = new Map();
    for (const item of seoCatalog) {
      if (Number.isFinite(item?.locationId) && item.locationId > 0) {
        map.set(Number(item.locationId), item);
      }
    }
    return map;
  }, [seoCatalog]);

  const resolvedCitySlug = useMemo(() => {
    if (citySlugFromPath) return citySlugFromPath;
    if (queryLocationId && catalogByLocationId.has(queryLocationId)) {
      return catalogByLocationId.get(queryLocationId)?.slug || "";
    }
    return "";
  }, [citySlugFromPath, queryLocationId, catalogByLocationId]);

  const currentBucket = useMemo(
    () => locationBuckets.find((bucket) => bucket.slug === resolvedCitySlug),
    [resolvedCitySlug, locationBuckets]
  );
  const catalogEntry = catalogBySlug.get(resolvedCitySlug);
  const reviewLocationId = useMemo(() => {
    const fromQuery = Number(queryLocationId);
    if (Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;

    const fromCatalog = Number(catalogEntry?.locationId);
    if (Number.isInteger(fromCatalog) && fromCatalog > 0) return fromCatalog;

    const fallbackLocation = (Array.isArray(locations) ? locations : []).find((entry) => {
      const citySlug = slugifyCity(entry?.city);
      const nameSlug = slugifyCity(entry?.name);
      return citySlug === resolvedCitySlug || nameSlug === resolvedCitySlug;
    });
    const fallbackId = Number(fallbackLocation?.id);
    return Number.isInteger(fallbackId) && fallbackId > 0 ? fallbackId : null;
  }, [catalogEntry?.locationId, locations, queryLocationId, resolvedCitySlug]);
  const cityDisplay = catalogEntry?.label || currentBucket?.label || toDisplayCity(resolvedCitySlug);
  const content = useMemo(
    () =>
      buildDynamicCityContent(cityDisplay, {
        locationHighlights: (currentBucket?.entries || []).map((entry) => entry.locationName),
      }),
    [cityDisplay, currentBucket]
  );
  const canonicalPath = catalogEntry?.path || content.pathname;
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const cityJsonLd = useMemo(
    () =>
      [
        buildBaseFoodEstablishmentJsonLd({
          pagePath: canonicalPath,
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
          areaServed: [cityDisplay, "Moselle"],
        }),
        buildBreadcrumbJsonLd(
          [
            { name: "Accueil", path: "/" },
            { name: "Horaires", path: "/planing" },
            { name: cityDisplay, path: canonicalPath },
          ],
          canonicalSiteUrl || undefined
        ),
      ].filter(Boolean),
    [
      canonicalPath,
      canonicalSiteUrl,
      cityDisplay,
      content.description,
      content.title,
      settings.contact?.address,
      settings.contact?.email,
      settings.contact?.mapsUrl,
      settings.contact?.phone,
      settings.seo?.defaultOgImageUrl,
      settings.social?.facebookUrl,
      settings.social?.instagramUrl,
      settings.social?.tiktokUrl,
      siteName,
    ]
  );

  const effectiveAllowedSlugs = useMemo(() => {
    const combined = new Set(FIXED_LOCAL_CITY_SLUGS);
    for (const item of seoCatalog) {
      if (item?.slug) combined.add(item.slug);
    }
    for (const bucket of locationBuckets) {
      if (bucket?.slug) combined.add(bucket.slug);
    }
    return combined;
  }, [seoCatalog, locationBuckets]);

  if (!allowedLoaded) {
    return (
      <div className="section-shell py-10">
        <p className="text-sm text-stone-300">Chargement...</p>
      </div>
    );
  }

  if (!resolvedCitySlug) {
    return <CityPageNotFound citySlug="" />;
  }

  if (BLOCKED_LOCAL_CITY_SLUGS.includes(resolvedCitySlug)) {
    return <CityPageNotFound citySlug={resolvedCitySlug} />;
  }

  if (queryLocationId && catalogByLocationId.size > 0) {
    const locationEntry = catalogByLocationId.get(queryLocationId);
    if (!locationEntry || locationEntry.slug !== resolvedCitySlug) {
      return <CityPageNotFound citySlug={resolvedCitySlug} />;
    }
  }

  if (!effectiveAllowedSlugs.has(resolvedCitySlug)) {
    return <CityPageNotFound citySlug={resolvedCitySlug} />;
  }

  const fixedPath = getFixedCityPathBySlug(resolvedCitySlug);
  if (fixedPath) {
    return <Navigate to={fixedPath} replace />;
  }

  if (citySlugFromPath && canonicalPath && canonicalPath !== `/pizza-${resolvedCitySlug}`) {
    return <Navigate to={canonicalPath} replace />;
  }

  if (!citySlugFromPath && canonicalPath) {
    return <Navigate to={canonicalPath} replace />;
  }

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={content.title}
        description={content.description}
        pathname={canonicalPath}
        jsonLd={cityJsonLd}
      />

      <header className="space-y-3">
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">{content.h1}</h1>
        {Array.isArray(content.introParagraphs) && content.introParagraphs.length > 0 ? (
          content.introParagraphs.map((paragraph, index) => (
            <p key={`intro-${index}`} className="max-w-3xl text-sm text-stone-300 sm:text-base">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="max-w-3xl text-sm text-stone-300 sm:text-base">{content.intro}</p>
        )}
      </header>

      {content.sections.map((section) => (
        <section key={section.heading} className="glass-panel p-6">
          <h2 className="text-xl font-bold text-white">{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            <p key={`${section.heading}-${index}`} className="mt-3 text-sm leading-7 text-stone-300">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {currentBucket?.entries?.length > 0 && (
        <section className="glass-panel p-6">
          <h2 className="text-lg font-bold text-white">
            {content?.nearbySection?.heading || `Prochains emplacements a ${cityDisplay}`}
          </h2>
          <p className="mt-3 text-sm text-stone-300">
            {content?.nearbySection?.lead || "Exemples d'emplacements actifs :"}
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {currentBucket.entries.slice(0, 6).map((entry) => (
              <li key={entry.key} className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-stone-200">
                <p className="font-semibold text-white">{entry.locationName}</p>
                {entry.address ? (
                  <p className="mt-1 text-xs text-stone-300">{entry.address}</p>
                ) : null}
                <p className="mt-1 text-xs text-stone-300">
                  {entry.dayLabel} - {entry.hours}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-300">
            {content?.nearbySection?.footer ||
              "Consultez la page horaires d'ouvertures pour connaitre les prochains passages du camion pizza."}
          </p>
        </section>
      )}

      <PublicReviewsSection locationId={reviewLocationId} className="space-y-5" />

      <PageFaqSection
        pathname={canonicalPath}
        title={`Questions fréquentes sur ${cityDisplay}`}
      />

      <section className="glass-panel p-6">
        <h2 className="text-lg font-bold text-white">Commander votre pizza</h2>
        <div className="mt-3 flex flex-wrap gap-2">
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
