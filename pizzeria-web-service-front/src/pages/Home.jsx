import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api/category.api";
import { getPublicGallery } from "../api/gallery.api";
import { getPublicWeeklySettings } from "../api/timeslot.api";
import { getAllProductsClient } from "../api/user.api";
import CompactServiceInfoPanel from "../components/common/CompactServiceInfoPanel";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useTheme } from "../context/ThemeContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_TOUR_CITIES } from "../seo/localLandingContent";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";
import { lazyWithSingleReload } from "../utils/lazyWithSingleReload";
import { getLocationDisplayName } from "../utils/location";

const DAY_LABELS = {
  MONDAY: { fr: "Lundi", en: "Monday" },
  TUESDAY: { fr: "Mardi", en: "Tuesday" },
  WEDNESDAY: { fr: "Mercredi", en: "Wednesday" },
  THURSDAY: { fr: "Jeudi", en: "Thursday" },
  FRIDAY: { fr: "Vendredi", en: "Friday" },
  SATURDAY: { fr: "Samedi", en: "Saturday" },
  SUNDAY: { fr: "Dimanche", en: "Sunday" },
};
const DEFAULT_HOME_BACKGROUND = "/pizza-background-1920.webp";
const HERO_AUTOPLAY_DELAY_MS = 5000;
const HERO_IMAGE_LIMIT = 5;
const MOBILE_HERO_MEDIA_QUERY = "(max-width: 767px)";
const MOBILE_USER_AGENT_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const MENU_BOARD_MIN_HEIGHT_CLASS = "min-h-[680px]";
const CONTENT_SECTION_MIN_HEIGHT_CLASS = "min-h-[220px]";

const PageFaqSection = lazyWithSingleReload(
  () => import("../components/common/PageFaqSection"),
  "home-page-faq-section"
);
const MenuBoard = lazyWithSingleReload(
  () => import("../components/menu/MenuBoard"),
  "home-menu-board"
);
const PublicReviewsSection = lazyWithSingleReload(
  () => import("../components/reviews/PublicReviewsSection"),
  "home-public-reviews"
);

function getInitialIsMobileViewport() {
  if (typeof window === "undefined") {
    return true;
  }

  const hasMobileUserAgent =
    typeof navigator !== "undefined" &&
    MOBILE_USER_AGENT_REGEX.test(String(navigator.userAgent || ""));

  if (typeof window.matchMedia !== "function") {
    return hasMobileUserAgent;
  }

  const isMobileByViewport = window.matchMedia(MOBILE_HERO_MEDIA_QUERY).matches;
  return isMobileByViewport;
}

function formatLocationAddress(location, tr) {
  if (!location) return tr("Adresse non renseignee", "Address not available");
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function getSeoLocationLabel(location) {
  return String(location?.name || location?.city || "").trim();
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

function parseHighlightedIngredients(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function DeferredSection({
  children,
  minHeightClass = CONTENT_SECTION_MIN_HEIGHT_CLASS,
  rootMargin = "350px",
}) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return undefined;
    if (typeof window === "undefined") {
      setIsVisible(true);
      return undefined;
    }
    if (typeof window.IntersectionObserver !== "function") {
      setIsVisible(true);
      return undefined;
    }

    const target = containerRef.current;
    if (!target) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin,
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        <Suspense fallback={<div className={minHeightClass} aria-hidden="true" />}>
          {children}
        </Suspense>
      ) : (
        <div className={minHeightClass} aria-hidden="true" />
      )}
    </div>
  );
}

export default function Home() {
  const { language, tr } = useLanguage();
  const { settings: siteSettings } = useSiteSettings();
  const { theme } = useTheme();
  const isLightTheme = theme === "light";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [weeklySettings, setWeeklySettings] = useState([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(getInitialIsMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(MOBILE_HERO_MEDIA_QUERY);
    const handleViewportChange = () => {
      setIsMobileViewport(mediaQueryList.matches);
    };

    handleViewportChange();

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleViewportChange);
      return () => {
        mediaQueryList.removeEventListener("change", handleViewportChange);
      };
    }

    mediaQueryList.addListener(handleViewportChange);
    return () => {
      mediaQueryList.removeListener(handleViewportChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const shouldLoadHeroMedia = !isMobileViewport;

    async function fetchHomeData() {
      try {
        const [productData, categoryData, galleryData, weeklySettingsData] =
          await Promise.all([
            getAllProductsClient(),
            getCategories({ active: true, kind: "PRODUCT", sortBy: "createdAt" }),
            shouldLoadHeroMedia ? getPublicGallery({ active: true }) : Promise.resolve([]),
            getPublicWeeklySettings(),
          ]);

        if (!cancelled) {
          setProducts(Array.isArray(productData) ? productData : []);
          setCategories(Array.isArray(categoryData) ? categoryData : []);
          setGalleryImages(Array.isArray(galleryData) ? galleryData : []);
          setWeeklySettings(
            Array.isArray(weeklySettingsData) ? weeklySettingsData : []
          );
        }
      } catch (_err) {
        if (!cancelled) {
          setProducts([]);
          setCategories([]);
          setGalleryImages([]);
          setWeeklySettings([]);
        }
      }
    }

    fetchHomeData();
    return () => {
      cancelled = true;
    };
  }, [isMobileViewport]);

const truckTourSchedule = useMemo(
  () => {
    const rows = (Array.isArray(weeklySettings) ? weeklySettings : []).flatMap(
      (entry, dayIndex) => {
        const services =
          Array.isArray(entry?.services) && entry.services.length > 0
            ? entry.services
            : entry?.isOpen && entry?.location
              ? [
                  {
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    locationId: entry.locationId,
                    location: entry.location,
                  },
                ]
              : [];

        return services
          .filter((service) => service?.location && entry?.dayOfWeek)
          .map((service, serviceIndex) => {
            const locationName = getLocationDisplayName(service.location, tr("Emplacement", "Location"));
            const address = formatLocationAddress(service.location, tr);
            const locationKey =
              service.locationId ||
              `${locationName.toLowerCase()}-${address.toLowerCase()}`;

            return {
              groupKey: `${entry.dayOfWeek}-${locationKey}`,
              sortKey: `${dayIndex}-${serviceIndex}`,
              locationName,
              address,
              dayLabel: tr(
                DAY_LABELS[entry.dayOfWeek]?.fr || entry.dayOfWeek,
                DAY_LABELS[entry.dayOfWeek]?.en || entry.dayOfWeek
              ),
              hours: formatHourRange(service.startTime, service.endTime),
            };
          });
      }
    );

    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.groupKey)) {
        grouped.set(row.groupKey, {
          key: row.groupKey,
          sortKey: row.sortKey,
          locationName: row.locationName,
          address: row.address,
          dayLabel: row.dayLabel,
          hours: [],
        });
      }

      const current = grouped.get(row.groupKey);
      if (!current.hours.includes(row.hours)) {
        current.hours.push(row.hours);
      }
    }

    return [...grouped.values()]
      .sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)))
      .map((entry) => ({
        key: entry.key,
        locationName: entry.locationName,
        address: entry.address,
        dayLabel: entry.dayLabel,
        hours: entry.hours,
      }));
  },
  [weeklySettings, tr]
);

  const truckTourCities = useMemo(() => {
    const source = Array.isArray(weeklySettings) ? weeklySettings : [];
    const dynamicLocations = source.flatMap((entry) => {
      const services =
        Array.isArray(entry?.services) && entry.services.length > 0
          ? entry.services
          : entry?.isOpen && entry?.location
            ? [{ location: entry.location }]
            : [];

      return services
        .map((service) => getSeoLocationLabel(service?.location))
        .filter(Boolean);
    });

    return [...new Set([...DEFAULT_TOUR_CITIES, ...dynamicLocations])];
  }, [weeklySettings]);
  const productsSortedByPrice = useMemo(() => {
    return [...products].sort((left, right) => {
      const leftPrice = Number(left?.basePrice);
      const rightPrice = Number(right?.basePrice);
      const safeLeft = Number.isFinite(leftPrice) ? leftPrice : Number.POSITIVE_INFINITY;
      const safeRight = Number.isFinite(rightPrice) ? rightPrice : Number.POSITIVE_INFINITY;
      if (safeLeft !== safeRight) return safeLeft - safeRight;
      return String(left?.name || "").localeCompare(String(right?.name || ""));
    });
  }, [products]);

  const siteName = siteSettings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const showHomeMenuProductImages = false;
  const canonicalSiteUrl = String(siteSettings.seo?.canonicalSiteUrl || "").trim();
  const defaultOgImageUrl = String(siteSettings.seo?.defaultOgImageUrl || "").trim();
  const socialUrls = [
    siteSettings.social?.instagramUrl,
    siteSettings.social?.facebookUrl,
    siteSettings.social?.tiktokUrl,
  ].filter(Boolean);

  const heroGalleryImages = useMemo(() => {
    const validImages = galleryImages.filter((image) => image?.imageUrl);

    if (validImages.length === 0) {
      return [{ id: "fallback-hero", imageUrl: DEFAULT_HOME_BACKGROUND }];
    }

    return [...validImages].sort((left, right) => {
      const leftPriority = left?.isHomeBackground ? 0 : 1;
      const rightPriority = right?.isHomeBackground ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftOrder = Number(left?.sortOrder ?? 0);
      const rightOrder = Number(right?.sortOrder ?? 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;

      return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
    }).slice(0, HERO_IMAGE_LIMIT);
  }, [galleryImages]);
  const shouldRenderHeroImages = !isMobileViewport && heroGalleryImages.length > 0;

  const heroOverlay = theme === "light"
    ? "linear-gradient(118deg, rgba(246,235,221,0.90) 6%, rgba(246,235,221,0.68) 42%, rgba(58,38,28,0.48) 100%)"
    : "linear-gradient(120deg, rgba(18,16,13,0.88) 5%, rgba(18,16,13,0.62) 40%, rgba(18,16,13,0.92) 100%)";

  const siteMetaTitle = getLocalizedSiteText(
    siteSettings.seo?.defaultMetaTitle,
    language,
    tr(
      `Pizza napolitaine au feu de bois en Moselle | ${siteName}`,
      `Wood-fired Neapolitan pizza in Moselle | ${siteName}`
    )
  );
  const siteMetaDescription = getLocalizedSiteText(
    siteSettings.seo?.defaultMetaDescription,
    language,
    tr(
      "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
      "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup."
    )
  );
  const heroTitle = getLocalizedSiteText(
    siteSettings.home?.heroTitle,
    language,
    tr(
      "Pizza napolitaine au feu de bois en Moselle",
      "Wood-fired Neapolitan pizza in Moselle"
    )
  );
  const heroSubtitle = getLocalizedSiteText(
    siteSettings.home?.heroSubtitle,
    language,
    tr(
      "Une pizza travaillee pour l emporter: pâte souple, cuisson vive et recettes nettes a reçuperer en Moselle.",
      "Pizza built for pickup: supple dough, lively baking and cleaner recipes to collect in Moselle."
    )
  );
  const siteTaglineText = getLocalizedSiteText(
    siteSettings.siteTagline,
    language,
    ""
  );
  const heroPrimaryCtaLabel = getLocalizedSiteText(
    siteSettings.home?.primaryCtaLabel,
    language,
    tr("Commander", "Order now")
  );
  const heroSecondaryCtaLabel = getLocalizedSiteText(
    siteSettings.home?.secondaryCtaLabel,
    language,
    tr("Voir le menu", "See menu")
  );
  const heroReassuranceText = getLocalizedSiteText(
    siteSettings.home?.reassuranceText,
    language,
    tr(
      "Commande en ligne, retrait rapide, cuisson minute",
      "Online ordering, quick pickup, baked to order"
    )
  );
  const highlightedIngredientsFrText = getLocalizedSiteText(
    siteSettings.home?.highlightedIngredients,
    "fr",
    DEFAULT_SITE_SETTINGS.home.highlightedIngredients.fr
  );
  const highlightedIngredientsEnText = getLocalizedSiteText(
    siteSettings.home?.highlightedIngredients,
    "en",
    DEFAULT_SITE_SETTINGS.home.highlightedIngredients.en
  );
  const highlightedIngredients = useMemo(() => {
    const frenchLines = parseHighlightedIngredients(highlightedIngredientsFrText);
    const englishLines = parseHighlightedIngredients(highlightedIngredientsEnText);

    if (language !== "en") return frenchLines;

    const lineCount = Math.max(frenchLines.length, englishLines.length);
    return Array.from({ length: lineCount }, (_value, index) => {
      return englishLines[index] || frenchLines[index] || "";
    }).filter(Boolean);
  }, [highlightedIngredientsEnText, highlightedIngredientsFrText, language]);

  const homeJsonLd = useMemo(() => {
    const base = buildBaseFoodEstablishmentJsonLd({
      pagePath: "/",
      pageName: heroTitle,
      description: siteMetaDescription,
      siteName,
      siteUrl: canonicalSiteUrl || undefined,
      phone: siteSettings.contact?.phone,
      email: siteSettings.contact?.email,
      address: siteSettings.contact?.address,
      mapUrl: siteSettings.contact?.mapsUrl,
      image: defaultOgImageUrl,
      socialUrls,
    });

    const payload = {
      ...base,
      areaServed: truckTourCities,
    };

    return payload;
  }, [
    canonicalSiteUrl,
    defaultOgImageUrl,
    heroTitle,
    siteMetaDescription,
    siteName,
    siteSettings.contact?.address,
    siteSettings.contact?.email,
    siteSettings.contact?.mapsUrl,
    siteSettings.contact?.phone,
    socialUrls,
    truckTourCities,
  ]);

  useEffect(() => {
    setActiveHeroIndex((prev) => {
      if (!shouldRenderHeroImages || heroGalleryImages.length === 0) return 0;
      return prev % heroGalleryImages.length;
    });
  }, [heroGalleryImages.length, shouldRenderHeroImages]);

  useEffect(() => {
    if (!shouldRenderHeroImages || heroGalleryImages.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveHeroIndex((prev) => (prev + 1) % heroGalleryImages.length);
    }, HERO_AUTOPLAY_DELAY_MS);

    return () => window.clearInterval(intervalId);
  }, [heroGalleryImages.length, shouldRenderHeroImages]);

  return (
    <div className="space-y-20 pb-24">
      <SeoHead
        title={siteMetaTitle}
        description={siteMetaDescription}
        pathname="/"
        jsonLd={homeJsonLd}
      />
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {shouldRenderHeroImages
            ? heroGalleryImages.map((image, index) => (
                <img
                  key={image.id || `${image.imageUrl}-${index}`}
                  src={image.imageUrl}
                  alt=""
                  aria-hidden="true"
                  fetchPriority={index === 0 ? "high" : undefined}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                    index === activeHeroIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))
            : null}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: heroOverlay,
            }}
          />
        </div>
        <div className="section-shell relative py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            {siteTaglineText ? (
              <p
                className={`mb-4 text-xs font-semibold uppercase tracking-[0.28em] ${
                  isLightTheme ? "text-[#3A261C]/70" : "text-saffron"
                }`}
              >
                {siteTaglineText}
              </p>
            ) : null}
            <h1
              className={`font-display text-5xl uppercase leading-none tracking-wide sm:text-6xl lg:text-7xl ${
                isLightTheme ? "text-[#3A261C]" : "theme-light-keep-white text-white"
              }`}
            >
              {heroTitle}
            </h1>
            <p
              className={`mt-6 max-w-2xl text-base sm:text-lg ${
                isLightTheme ? "text-[#1A1817]/80" : "theme-light-keep-white text-stone-200"
              }`}
            >
              {heroSubtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/order"
                className="rounded-full bg-saffron px-6 py-3 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
              >
                {heroPrimaryCtaLabel}
              </Link>
              <a
                href="#menu"
                className={`rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                  isLightTheme
                    ? "border border-[#3A261C]/15 bg-white/70 text-[#3A261C] hover:bg-white"
                    : "theme-light-keep-white border border-white/30 text-white hover:bg-white/10"
                }`}
              >
                {heroSecondaryCtaLabel}
              </a>
            </div>
            {heroReassuranceText ? (
              <p
                className={`mt-4 text-xs font-semibold uppercase tracking-[0.22em] ${
                  isLightTheme ? "text-[#3A261C]/70" : "text-stone-300"
                }`}
              >
                {heroReassuranceText}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section id="menu" className="section-shell">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] xl:items-start">
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="theme-light-keep-dark text-4xl uppercase tracking-[0.25em] text-saffron">
                  {tr("Le Menu", "Menu")}
                </h2>
              </div>
              <span className="rounded-full border border-saffron/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-saffron">
                {tr("Carte artisanale", "Craft menu")}
              </span>
            </div>

            <DeferredSection
              minHeightClass={MENU_BOARD_MIN_HEIGHT_CLASS}
              rootMargin="220px"
            >
              <MenuBoard
                products={productsSortedByPrice}
                categories={categories}
                tr={tr}
                variant="compact"
                showProductImages={showHomeMenuProductImages}
                emptyMessage={tr("Le menu sera disponible ici.", "The menu will be available here.")}
              />
            </DeferredSection>
          </div>

          <div className="space-y-5 xl:sticky xl:top-28">
            <CompactServiceInfoPanel compact truckTourSchedule={truckTourSchedule} />
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="grid gap-5 xl:grid-cols-3">
          <article className="glass-panel p-6 sm:p-8">
            <h2 className="font-display text-3xl uppercase tracking-wide text-white">
              {tr(
                "Des produits choisis pour leur tenue, pas pour remplir la carte",
                "Ingredients chosen for balance, not just to pad out the menu"
              )}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "La base produit reste volontairement courte pour garder des recettes plus nettes:",
                "The ingredient list stays intentionally short to keep the recipes clear:"
              )}
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-stone-200 sm:grid-cols-2">
              {highlightedIngredients.map((ingredient, index) => (
                <li
                  key={`home-highlight-${ingredient}-${index}`}
                  className="rounded-lg border border-white/20 bg-stone-200/20 px-3 py-2"
                >
                  {ingredient}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-saffron">
              {tr(
                "pate travaillee | ingredients bien choisis | cuisson minute",
                "worked dough | carefully chosen ingredients | baked to order"
              )}
            </p>
          </article>

          <article className="glass-panel p-6 sm:p-8">
            <h2 className="font-display text-3xl uppercase tracking-wide text-white">
              {tr("Ou trouver notre camion pizza", "Where to find our pizza truck")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Le camion passe sur plusieurs points autour de Thionville et dans les communes voisines de Moselle.",
                "The truck stops at several pickup points around Thionville and nearby towns across Moselle."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Les emplacements changent selon la tournee hebdomadaire.",
                "Locations change with the weekly route."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Consultez le planning pour connaitre les horaires et les points de retrait ouverts.",
                "Check the schedule to see opening hours and available pickup points."
              )}
            </p>
            <Link
              to="/planing"
              className="mt-5 inline-flex rounded-full border border-saffron/60 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
            >
              {tr("Voir les horaires d'ouverture", "See opening hours")}
            </Link>
          </article>

          <article className="glass-panel p-6 sm:p-8">
            <h2 className="font-display text-3xl uppercase tracking-wide text-white">
              {tr("Cuisson au four a bois et gaz", "Wood-and-gas oven baking")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Le four sert a garder une cuisson courte et lisible: un bord qui se developpe, une base qui tient et une pizza qui ne seche pas.",
                "The oven keeps the bake short and clean: a risen crust, a base that holds and a pizza that does not dry out."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Chaque pizza est lancee a la commande pour sortir au bon moment, pas pour attendre sur le cote.",
                "Every pizza goes in to order so it comes out at the right moment, not to sit waiting on the side."
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-[11px] uppercase tracking-wide text-saffron">
                {tr("pizza napolitaine feu de bois", "wood-fired Neapolitan pizza")}
              </span>
              <span className="rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-[11px] uppercase tracking-wide text-saffron">
                {tr("pizza feu de bois thionville", "wood-fired pizza Thionville")}
              </span>
              <span className="rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-[11px] uppercase tracking-wide text-saffron">
                {tr("pizza artisanale moselle", "artisan pizza Moselle")}
              </span>
              <span className="rounded-full border border-saffron/40 bg-saffron/10 px-3 py-1 text-[11px] uppercase tracking-wide text-saffron">
                {tr("camion pizza napolitaine", "Neapolitan pizza truck")}
              </span>
            </div>
          </article>
        </div>
      </section>

      <DeferredSection minHeightClass={CONTENT_SECTION_MIN_HEIGHT_CLASS} rootMargin="380px">
        <PublicReviewsSection />
      </DeferredSection>

      <DeferredSection minHeightClass={CONTENT_SECTION_MIN_HEIGHT_CLASS} rootMargin="420px">
        <PageFaqSection
          pathname="/"
          className="section-shell"
          eyebrow={tr("Questions fréquentes", "Frequently asked questions")}
          title={tr("Ce qu'il faut savoir avant de commander", "What to know before ordering")}
          intro={tr(
            "Voici les réponses les plus utiles pour commander rapidement et reçuperer votre pizza sans surprise.",
            "Here are the most useful answers to order quickly and pick up your pizza without surprises."
          )}
        />
      </DeferredSection>
    </div>
  );
}

