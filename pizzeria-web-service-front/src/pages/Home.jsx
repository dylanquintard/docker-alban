import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api/category.api";
import { getPublicGallery } from "../api/gallery.api";
import { getPublicWeeklySettings } from "../api/timeslot.api";
import { getAllProductsClient } from "../api/user.api";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useTheme } from "../context/ThemeContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_TOUR_CITIES } from "../seo/localLandingContent";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";
import { lazyWithSingleReload } from "../utils/lazyWithSingleReload";
import { getLocationDisplayName } from "../utils/location";

const paymentLogos = [
  {
    src: "/payments/cb.webp",
    fallbackSrc: "/payments/cb.webp",
    alt: "CB",
    width: 112,
    height: 63,
    className: "h-7 w-auto object-contain sm:h-8",
  },
  {
    src: "/payments/visa.webp",
    fallbackSrc: "/payments/visa.webp",
    alt: "VISA",
    width: 67,
    height: 63,
    className: "h-7 w-auto object-contain sm:h-8",
  },
  {
    src: "/payments/mastercard.webp",
    fallbackSrc: "/payments/mastercard.webp",
    alt: "MASTERCARD",
    width: 90,
    height: 63,
    className: "h-7 w-auto object-contain sm:h-8",
  },
  {
    src: "/payments/especes.webp",
    fallbackSrc: "/payments/especes.webp",
    alt: "Especes",
    width: 105,
    height: 105,
    className: "h-9 w-auto object-contain sm:h-10",
  },
];

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
const TrustHighlightsSection = lazyWithSingleReload(
  () => import("../components/trust/TrustHighlightsSection"),
  "home-trust-highlights"
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
            getCategories({ active: true, kind: "PRODUCT" }),
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

  const trustHighlights = useMemo(
    () => [
      {
        kicker: tr("Produit", "Product"),
        title: tr("Une pâte pensee pour le retrait", "Dough designed for pickup"),
        text: tr(
          "La pizza est travaillee pour rester souple, chaude et nette au moment ou elle quitte le camion.",
          "Each pizza is worked so it stays supple, hot and clean when it leaves the truck."
        ),
      },
      {
        kicker: tr("Service", "Service"),
        title: tr("Un retrait simple a suivre", "A simple pickup flow"),
        text: tr(
          "Commande, créneau, puis retrait sur le point de passage actif sans attente inutile.",
          "Order, choose a timeslot, then collect from the active stop without unnecessary waiting."
        ),
      },
      {
        kicker: tr("Sélection", "Selection"),
        title: tr("Des produits italiens bien choisis", "Well-chosen Italian products"),
        text: tr(
          "Farine, tomates, mozzarella et charcuteries sont choisis pour leur tenue au four et leur equilibre en bouche.",
          "Flour, tomatoes, mozzarella and charcuterie are chosen for oven balance and clean flavor."
        ),
      },
    ],
    [tr]
  );

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
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] xl:items-start">
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
            <article id="emplacements" className="glass-panel p-5 sm:p-6">
              <p className="theme-light-keep-dark text-xs uppercase tracking-[0.22em] text-saffron">
                {tr("Emplacements & horaires d'ouverture", "Locations & opening hours")}
              </p>
              <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-white">
                {tr("Ou nous trouver", "Where to find us")}
              </h2>
              <p className="mt-2 text-sm text-stone-400">
                {tr(
                  "Les points de passage, jours et horaires actuellement ouverts.",
                  "Current stops, opening days and available hours."
                )}
              </p>

              <div className="mt-5 space-y-3">
                {truckTourSchedule.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-stone-300">
                    {tr("Aucun horaire disponible pour le moment.", "No opening hours available for now.")}
                  </div>
                ) : (
                  truckTourSchedule.map((location) => (
                    <div
                      key={location.key}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{location.locationName}</p>
                          <p className="mt-1 text-xs text-stone-300">{location.address}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-saffron/30 bg-saffron/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-saffron">
                          {location.dayLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Array.isArray(location.hours) ? location.hours : []).map((hour) => (
                          <span
                            key={hour}
                            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-stone-200"
                          >
                            {hour}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Link
                to="/planing"
                className="mt-5 inline-flex rounded-full border border-saffron/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
              >
                {tr("Voir les horaires", "See opening hours")}
              </Link>
            </article>

            <article id="services" className="glass-panel p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-saffron">
                {tr("Nos services", "Our services")}
              </p>
              <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-white">
                {tr("A emporter uniquement", "Takeaway only")}
              </h2>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-base font-bold text-white">{tr("Commande rapide", "Fast ordering")}</p>
                  <p className="mt-2 text-sm text-stone-300">
                    {tr(
                      "Commandez, choisissez votre créneau, puis reçuperez votre pizza au camion sans attente inutile.",
                      "Order, pick your slot, then collect your pizza at the truck without unnecessary waiting."
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-base font-bold text-white">{tr("Qualité constante", "Consistent quality")}</p>
                  <p className="mt-2 text-sm text-stone-300">
                    {tr(
                      "Une pâte préparée en amont, des produits bien calibres et une cuisson minute pour garder un resultat plus stable.",
                      "Prepared dough, well-calibrated ingredients and minute baking for a more reliable result."
                    )}
                  </p>
                </div>
              </div>
            </article>

            <article id="paiements" className="glass-panel p-4 sm:p-5">
              <p className="theme-light-keep-dark text-xs uppercase tracking-[0.22em] text-saffron">
                {tr("Moyens de paiement acceptes", "Accepted payment methods")}
              </p>
              <h2 className="mt-2 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
                {tr("Paiement sur place", "On-site payment")}
              </h2>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {paymentLogos.map((logo) => (
                  <div
                    key={logo.alt}
                    className="flex items-center justify-center"
                  >
                    <picture>
                      <source srcSet={logo.src} type="image/webp" />
                      <img
                        src={logo.fallbackSrc}
                        alt={logo.alt}
                        width={logo.width}
                        height={logo.height}
                        loading="lazy"
                        decoding="async"
                        className={logo.className}
                      />
                    </picture>
                  </div>
                ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-shell space-y-6">
        <div className="grid gap-5 xl:grid-cols-12">
          <article className="glass-panel p-6 sm:p-8 xl:col-span-7">
            <p className="text-xs uppercase tracking-[0.2em] text-saffron">
              {tr("Camion pizza Moselle", "Moselle pizza truck")}
            </p>
            <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-white">
              {tr(
                "Une pizza pensee pour être bonne au moment du retrait",
                "Pizza made to be at its best at pickup time"
              )}
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Le camion circule dans le nord de la Moselle avec une carte courte et une cuisson vive, pour servir une pizza propre plutot qu une offre standardisee.",
                "The truck moves around northern Moselle with a short menu and lively baking, so each pizza stays focused instead of feeling standardized."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Le planning change selon la semaine, mais la ligne reste la meme: une organisation simple, un retrait rapide et une execution reguliere.",
                "The weekly route changes, but the approach stays the same: simple organization, fast pickup and steady execution."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Les pizzas sont préparées avec une pâte travaillee, une garniture tenue et un four bois-gaz qui donne du rythme au service.",
                "Each pizza is built around a well-worked dough, balanced toppings and a wood-and-gas oven that keeps service moving."
              )}
            </p>
          </article>

          <article className="glass-panel p-6 sm:p-8 xl:col-span-5">
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
                  key={`${ingredient}-${index}`}
                  className="rounded-lg border border-white/20 bg-stone-200/20 px-3 py-2"
                >
                  {ingredient}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-saffron">
              {tr(
                "pâte travaillee | ingrédients bien choisis | cuisson minute",
                "worked dough | carefully chosen ingredients | baked to order"
              )}
            </p>
          </article>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
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

          <article className="glass-panel p-6 sm:p-8">
            <h2 className="font-display text-3xl uppercase tracking-wide text-white">
              {tr("Où trouver notre camion pizza", "Where to find our pizza truck")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Le camion passe sur plusieurs points autour de Thionville et dans les communes voisines de Moselle.",
                "The truck stops at several pickup points around Thionville and nearby towns across Moselle."
              )}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-300 sm:text-base">
              {tr(
                "Les emplacements changent selon la tournée hebdomadaire.",
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
        </div>
      </section>

      <DeferredSection minHeightClass={CONTENT_SECTION_MIN_HEIGHT_CLASS} rootMargin="380px">
        <PublicReviewsSection />
      </DeferredSection>

      <DeferredSection minHeightClass={CONTENT_SECTION_MIN_HEIGHT_CLASS} rootMargin="380px">
        <TrustHighlightsSection
          eyebrow={tr("Ce qui fait revenir", "Why people come back")}
          title={tr("Une pizza claire, un retrait fluide, un service mobile serieux", "Clear pizza, smooth pickup, serious mobile service")}
          intro={tr(
            "Sans inventer de faux avis, on met en avant les points de confiance qui comptent le plus pour un client local avant de commander.",
            "Without inventing fake reviews, we highlight the trust points that matter most to local customers before they order."
          )}
          items={trustHighlights}
        />
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

