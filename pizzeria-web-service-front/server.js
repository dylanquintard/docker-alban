const fs = require("fs");
const express = require("express");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const BUILD_DIR = path.join(__dirname, "build");
const INDEX_FILE = path.join(BUILD_DIR, "index.html");
const SEO_CACHE_TTL_MS = Number(process.env.SEO_CACHE_TTL_MS || 300000);
const SEO_FETCH_TIMEOUT_MS = Number(process.env.SEO_FETCH_TIMEOUT_MS || 6000);
const SEO_FORCE_REFRESH_MIN_INTERVAL_MS = Number(process.env.SEO_FORCE_REFRESH_MIN_INTERVAL_MS || 15000);
const SITEMAP_CACHE_TTL_MS = Math.max(15000, Math.min(SEO_CACHE_TTL_MS, 300000));
const BACKEND_SITEMAP_CACHE_TTL_MS = Math.min(SITEMAP_CACHE_TTL_MS, 15000);

const FIXED_CITY_CATALOG = [
  { slug: "thionville", label: "Thionville" },
  { slug: "moselle", label: "Moselle" },
];
const BLOCKED_CITY_SLUGS = new Set();
const FIXED_CITY_SLUGS = new Set(FIXED_CITY_CATALOG.map((item) => item.slug));

const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteName: "Camion Pizza Italienne",
  seo: {
    defaultMetaTitle: {
      fr: "Camion Pizza Italienne | Pizza napolitaine au feu de bois en Moselle",
    },
    defaultMetaDescription: {
      fr: "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
    },
    defaultOgImageUrl: "",
    faviconUrl: "",
    canonicalSiteUrl: "",
  },
  blog: {
    introTitle: {
      fr: "Farines, tomates, mozzarella & surtout la pizza !",
    },
    introText: {
      fr: "Ici on parle d'italie, de saveurs, de savoir faire et de qualite !",
    },
  },
  contact: {
    phone: "",
    email: "",
    address: "",
    mapsUrl: "",
    serviceArea: {
      fr: "Moselle et alentours",
    },
  },
  social: {
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
  },
});

const EXACT_SPA_ROUTES = new Set([
  "/",
  "/gallery",
  "/menu",
  "/planing",
  "/tournee",
  "/tournee-camion",
  "/a-propos",
  "/contact",
  "/blog",
  "/mentions-legales",
  "/confidentialite",
  "/conditions-generales",
  "/camion-pizza-moselle",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/verify-email",
  "/order",
  "/order/confirmation",
  "/profile",
  "/userorders",
]);

const NOINDEX_EXACT_ROUTES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/verify-email",
  "/order",
  "/order/confirmation",
  "/profile",
  "/userorders",
]);

const PREFIX_SPA_ROUTES = ["/admin"];
const SITEMAP_STATIC_ROUTES = new Set([
  "/",
  "/a-propos",
  "/blog",
  "/contact",
  "/gallery",
  "/menu",
  "/planing",
  "/pizza",
  "/pizza-thionville",
  "/camion-pizza-moselle",
  "/mentions-legales",
  "/confidentialite",
  "/conditions-generales",
]);

function createInitialSeoCache() {
  return {
    expiresAt: 0,
    lastRefreshAt: 0,
    citySlugs: new Set(FIXED_CITY_SLUGS),
    cityLabelsBySlug: new Map(FIXED_CITY_CATALOG.map((entry) => [entry.slug, entry.label])),
    citySlugByLocationId: new Map(),
    blogSlugs: new Set(),
    blogMetaBySlug: new Map(),
    siteSettings: JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS)),
  };
}

function createInitialSitemapCache() {
  return {
    expiresAt: 0,
    xml: "",
    sourceLabel: "",
  };
}

const seoCache = createInitialSeoCache();
const sitemapCache = createInitialSitemapCache();

let indexTemplate = "";
let seoRefreshPromise = null;
let sitemapRefreshPromise = null;

function ensureIndexTemplate() {
  if (!indexTemplate) {
    indexTemplate = fs.readFileSync(INDEX_FILE, "utf8");
  }
  return indexTemplate;
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeForwardedHeaderValue(value) {
  return String(value || "")
    .split(",")[0]
    .trim();
}

function isLoopbackAddress(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "::1" || normalized === "127.0.0.1" || normalized === "::ffff:127.0.0.1";
}

function normalizeRoutePath(pathname) {
  const normalized = `/${String(pathname || "").trim().replace(/^\/+/, "")}`.replace(/\/+$/, "");
  if (normalized === "") return "/";
  return normalized;
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function extractSitemapLocs(xmlPayload) {
  return [...String(xmlPayload || "").matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) =>
    decodeXmlEntities(match[1]).trim()
  );
}

function normalizeAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    parsed.search = "";
    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch (_error) {
    return "";
  }
}

function buildSitemapXml(urls) {
  const safeUrls = Array.from(
    new Set((Array.isArray(urls) ? urls : []).map((url) => normalizeAbsoluteHttpUrl(url)).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const lastmod = new Date().toISOString().slice(0, 10);
  const urlNodes = safeUrls
    .map(
      (url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>`;
}

function getCanonicalBaseUrl(req) {
  const configured = normalizeBaseUrl(
    normalizeAbsoluteHttpUrl(
      process.env.CANONICAL_SITE_URL ||
        process.env.VITE_SITE_URL ||
        process.env.REACT_APP_SITE_URL ||
        ""
    )
  );
  if (configured) return configured;

  const host = normalizeForwardedHeaderValue(req.headers.host || "");
  if (host) {
    try {
      const parsed = new URL(`http://${host}`);
      if (
        ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname) &&
        isLoopbackAddress(req.socket?.remoteAddress)
      ) {
        return `${req.secure ? "https" : "http"}://${host}`;
      }
    } catch (_error) {
      // Fall through to the fixed safe default.
    }
  }

  return "https://localhost";
}

function buildBackendApiBaseUrl() {
  const configured = normalizeBaseUrl(
    process.env.SEO_BACKEND_API_URL ||
      process.env.VITE_API_BASE_URL ||
      process.env.REACT_APP_API_BASE_URL ||
      ""
  );
  if (!configured) return "";
  if (/\/api$/i.test(configured)) return configured;
  return `${configured}/api`;
}

function buildBackendOriginUrl() {
  const apiBase = buildBackendApiBaseUrl();
  if (!apiBase) return "";
  return apiBase.replace(/\/api$/i, "");
}

function buildRobotsSitemapUrl(req) {
  const explicit = normalizeAbsoluteHttpUrl(process.env.SEO_ROBOTS_SITEMAP_URL || "");
  if (explicit) return explicit;

  const backendOrigin = buildBackendOriginUrl();
  if (backendOrigin) return `${backendOrigin}/sitemap.xml`;

  const canonicalBase = normalizeBaseUrl(getCanonicalBaseUrl(req));
  if (canonicalBase) return `${canonicalBase}/sitemap.xml`;
  return "/sitemap.xml";
}

function buildRobotsTxt(req) {
  const sitemapUrl = buildRobotsSitemapUrl(req);

  return [
    "# https://www.robotstxt.org/robotstxt.html",
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /order",
    "Disallow: /profile",
    "Disallow: /userorders",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");
}

function buildApiUrl(pathname) {
  const apiBase = buildBackendApiBaseUrl();
  if (!apiBase) return "";
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${apiBase}${suffix}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleizeSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getLocalizedValue(value, fallback = "") {
  if (value && typeof value === "object") {
    const frValue = String(value.fr || "").trim();
    const enValue = String(value.en || "").trim();
    return frValue || enValue || fallback;
  }
  return String(value || "").trim() || fallback;
}

function normalizeSiteSettings(payload) {
  const source = payload && typeof payload === "object" ? payload : {};

  return {
    siteName: String(source.siteName || "").trim() || DEFAULT_SITE_SETTINGS.siteName,
    seo: {
      defaultMetaTitle: {
        fr: getLocalizedValue(
          source.seo?.defaultMetaTitle,
          DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr
        ),
      },
      defaultMetaDescription: {
        fr: getLocalizedValue(
          source.seo?.defaultMetaDescription,
          DEFAULT_SITE_SETTINGS.seo.defaultMetaDescription.fr
        ),
      },
      defaultOgImageUrl:
        String(source.seo?.defaultOgImageUrl || "").trim() ||
        DEFAULT_SITE_SETTINGS.seo.defaultOgImageUrl,
      faviconUrl:
        String(source.seo?.faviconUrl || "").trim() ||
        DEFAULT_SITE_SETTINGS.seo.faviconUrl,
      canonicalSiteUrl:
        String(source.seo?.canonicalSiteUrl || "").trim() ||
        DEFAULT_SITE_SETTINGS.seo.canonicalSiteUrl,
    },
    blog: {
      introTitle: {
        fr: getLocalizedValue(
          source.blog?.introTitle,
          DEFAULT_SITE_SETTINGS.blog.introTitle.fr
        ),
      },
      introText: {
        fr: getLocalizedValue(
          source.blog?.introText,
          DEFAULT_SITE_SETTINGS.blog.introText.fr
        ),
      },
    },
    contact: {
      phone: String(source.contact?.phone || "").trim(),
      email: String(source.contact?.email || "").trim(),
      address: String(source.contact?.address || "").trim(),
      mapsUrl: String(source.contact?.mapsUrl || "").trim(),
      serviceArea: {
        fr: getLocalizedValue(
          source.contact?.serviceArea,
          DEFAULT_SITE_SETTINGS.contact.serviceArea.fr
        ),
      },
    },
    social: {
      instagramUrl: String(source.social?.instagramUrl || "").trim(),
      facebookUrl: String(source.social?.facebookUrl || "").trim(),
      tiktokUrl: String(source.social?.tiktokUrl || "").trim(),
    },
  };
}

function normalizeSeoLocationCatalog(payload) {
  const source = Array.isArray(payload?.locations) ? payload.locations : [];
  if (!source.length) return [];

  const deduped = new Map();
  for (const row of source) {
    const slug = slugify(row?.slug);
    const locationId = Number(row?.locationId);
    const label = String(row?.label || "").trim();
    if (!slug || BLOCKED_CITY_SLUGS.has(slug)) continue;

    const existing = deduped.get(slug) || {};
    deduped.set(slug, {
      slug,
      label: label || existing.label || titleizeSlug(slug),
      locationId:
        Number.isFinite(locationId) && locationId > 0
          ? locationId
          : Number.isFinite(existing.locationId)
            ? existing.locationId
            : null,
    });
  }

  return [...deduped.values()];
}

function normalizeSeoBlogArticleCatalog(payload) {
  const source = Array.isArray(payload?.articles) ? payload.articles : [];
  if (!source.length) return [];

  const deduped = new Map();
  for (const row of source) {
    const slug = slugify(row?.slug);
    if (!slug) continue;

    deduped.set(slug, {
      slug,
      title: String(row?.title || "").trim() || titleizeSlug(slug),
      description:
        String(row?.description || "").trim() ||
        "Article du blog sur la pizza napolitaine artisanale.",
      image:
        String(row?.image?.imageUrl || row?.imageUrl || "").trim() || "",
    });
  }

  return [...deduped.values()];
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

async function fetchJsonWithTimeout(url) {
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEO_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, acceptHeader = "text/plain") {
  if (!url) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEO_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: acceptHeader },
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function refreshSeoCacheIfNeeded(options = {}) {
  const force = Boolean(options?.force);
  const now = Date.now();
  const recentlyRefreshed =
    seoCache.lastRefreshAt > 0 &&
    now - seoCache.lastRefreshAt < Math.max(0, SEO_FORCE_REFRESH_MIN_INTERVAL_MS);

  if (!force && seoCache.expiresAt > now) return seoCache;
  if (force && (seoCache.expiresAt > now || recentlyRefreshed)) return seoCache;
  if (seoRefreshPromise) return seoRefreshPromise;

  seoRefreshPromise = (async () => {
    const refreshStartedAt = Date.now();
    seoCache.lastRefreshAt = refreshStartedAt;

    const nextCitySlugs = new Set(FIXED_CITY_SLUGS);
    const nextCityLabelsBySlug = new Map(FIXED_CITY_CATALOG.map((entry) => [entry.slug, entry.label]));
    const nextCitySlugByLocationId = new Map();
    const nextBlogSlugs = new Set();
    const nextBlogMetaBySlug = new Map();

    function addLocationSlugCandidates(source, preferredLabel = "") {
      const fromName = slugify(source?.name);
      const fromCity = slugify(source?.city);
      const sourceId = Number(source?.id);
      if (fromName && !BLOCKED_CITY_SLUGS.has(fromName)) {
        nextCitySlugs.add(fromName);
        if (!nextCityLabelsBySlug.has(fromName)) {
          nextCityLabelsBySlug.set(fromName, String(preferredLabel || source?.name || "").trim() || titleizeSlug(fromName));
        }
        if (Number.isFinite(sourceId) && sourceId > 0 && !nextCitySlugByLocationId.has(sourceId)) {
          nextCitySlugByLocationId.set(sourceId, fromName);
        }
      }
      if (fromCity && !BLOCKED_CITY_SLUGS.has(fromCity)) {
        nextCitySlugs.add(fromCity);
        if (!nextCityLabelsBySlug.has(fromCity)) {
          nextCityLabelsBySlug.set(fromCity, String(preferredLabel || source?.city || "").trim() || titleizeSlug(fromCity));
        }
        if (Number.isFinite(sourceId) && sourceId > 0) {
          nextCitySlugByLocationId.set(sourceId, fromCity);
        }
      }
    }

    function addWeeklySettingsSlugs(weeklySettingsData) {
      if (!Array.isArray(weeklySettingsData)) return;
      for (const dayEntry of weeklySettingsData) {
        const services =
          Array.isArray(dayEntry?.services) && dayEntry.services.length > 0
            ? dayEntry.services
            : dayEntry?.isOpen && dayEntry?.location
              ? [{ location: dayEntry.location }]
              : [];

        for (const service of services) {
          addLocationSlugCandidates(service?.location || {});
        }
      }
    }

    function addSeoLocationCatalog(catalogPayload) {
      const entries = normalizeSeoLocationCatalog(catalogPayload);
      for (const entry of entries) {
        nextCitySlugs.add(entry.slug);
        if (entry.label) {
          nextCityLabelsBySlug.set(entry.slug, entry.label);
        }
        if (Number.isFinite(entry.locationId) && entry.locationId > 0) {
          nextCitySlugByLocationId.set(entry.locationId, entry.slug);
        }
      }
      return entries.length > 0;
    }

    function addSeoBlogCatalog(catalogPayload) {
      const entries = normalizeSeoBlogArticleCatalog(catalogPayload);
      for (const entry of entries) {
        nextBlogSlugs.add(entry.slug);
        nextBlogMetaBySlug.set(entry.slug, {
          title: entry.title,
          description: entry.description,
          image: entry.image,
        });
      }
    }

    try {
      const [seoLocationsData, blogArticlesData, siteSettingsData] = await Promise.all([
        fetchJsonWithTimeout(buildApiUrl("/seo/locations")),
        fetchJsonWithTimeout(buildApiUrl("/seo/blog-articles")),
        fetchJsonWithTimeout(buildApiUrl("/site-settings/public")),
      ]);

      const hasCatalogData = addSeoLocationCatalog(seoLocationsData);
      if (!hasCatalogData) {
        const [locationsData, weeklySettingsData] = await Promise.all([
          fetchJsonWithTimeout(buildApiUrl("/locations?active=true")),
          fetchJsonWithTimeout(buildApiUrl("/timeslots/public-weekly-settings")),
        ]);
        if (Array.isArray(locationsData)) {
          for (const location of locationsData) {
            addLocationSlugCandidates(location);
          }
        }
        addWeeklySettingsSlugs(weeklySettingsData);
      }

      addSeoBlogCatalog(blogArticlesData);

      seoCache.citySlugs = nextCitySlugs;
      seoCache.cityLabelsBySlug = nextCityLabelsBySlug;
      seoCache.citySlugByLocationId = nextCitySlugByLocationId;
      seoCache.blogSlugs = nextBlogSlugs;
      seoCache.blogMetaBySlug = nextBlogMetaBySlug;
      seoCache.siteSettings = normalizeSiteSettings(siteSettingsData);
      seoCache.expiresAt = refreshStartedAt + SEO_CACHE_TTL_MS;
    } catch (_error) {
      // Keep fallback cache windows short so dynamic routes recover quickly
      // after transient API cold starts/timeouts.
      seoCache.siteSettings = seoCache.siteSettings || normalizeSiteSettings(null);
      seoCache.expiresAt = refreshStartedAt + Math.min(SEO_CACHE_TTL_MS, 15000);
    }

    return seoCache;
  })().finally(() => {
    seoRefreshPromise = null;
  });

  return seoRefreshPromise;
}

async function getSitemapPayload(req) {
  const now = Date.now();
  if (sitemapCache.expiresAt > now && sitemapCache.xml) {
    return sitemapCache;
  }

  if (sitemapRefreshPromise) {
    return sitemapRefreshPromise;
  }

  sitemapRefreshPromise = (async () => {
    const backendCandidates = buildBackendSitemapCandidates();
    const backendLocs = [];

    for (const sitemapUrl of backendCandidates) {
      try {
        const xmlPayload = await fetchTextWithTimeout(
          sitemapUrl,
          "application/xml, text/xml;q=0.9, text/plain;q=0.8"
        );
        const locs = extractSitemapLocs(xmlPayload).map((entry) => normalizeAbsoluteHttpUrl(entry)).filter(Boolean);
        if (locs.length > 0) {
          backendLocs.push(...locs);
          break;
        }
      } catch (_error) {
        // Keep trying other sitemap candidates and local fallback.
      }
    }

    if (backendLocs.length > 0) {
      sitemapCache.xml = buildSitemapXml(backendLocs);
      sitemapCache.sourceLabel = "backend";
      sitemapCache.expiresAt = Date.now() + BACKEND_SITEMAP_CACHE_TTL_MS;
      return sitemapCache;
    }

    const cache = await refreshSeoCacheIfNeeded();
    const localLocs = buildLocalSitemapUrls(req, cache);
    if (localLocs.length === 0) {
      if (sitemapCache.xml) {
        sitemapCache.expiresAt = Date.now() + Math.min(SITEMAP_CACHE_TTL_MS, 15000);
        return sitemapCache;
      }
      throw new Error("SITEMAP_UNAVAILABLE");
    }

    sitemapCache.xml = buildSitemapXml(localLocs);
    sitemapCache.sourceLabel = "local";
    sitemapCache.expiresAt = Date.now() + SITEMAP_CACHE_TTL_MS;

    return sitemapCache;
  })().finally(() => {
    sitemapRefreshPromise = null;
  });

  return sitemapRefreshPromise;
}

function isDynamicSeoPath(pathname) {
  return (
    /^\/blog\/[^/]+$/.test(pathname) ||
    /^\/[a-z0-9-]+$/.test(pathname) ||
    /^\/pizza-[a-z0-9-]+$/.test(pathname) ||
    /^\/pizza\/[^/]+$/.test(pathname)
  );
}

function buildLocalSitemapUrls(req, cache) {
  const settings = normalizeSiteSettings(cache?.siteSettings);
  const configuredCanonical = normalizeBaseUrl(settings.seo?.canonicalSiteUrl);
  const canonicalBase = configuredCanonical || normalizeBaseUrl(getCanonicalBaseUrl(req));

  const routes = new Set();
  for (const staticPath of SITEMAP_STATIC_ROUTES) {
    routes.add(normalizeRoutePath(staticPath));
  }

  const citySlugs = cache?.citySlugs instanceof Set ? [...cache.citySlugs] : [];
  for (const slug of citySlugs) {
    if (!slug || FIXED_CITY_SLUGS.has(slug) || BLOCKED_CITY_SLUGS.has(slug)) continue;
    routes.add(`/pizza-${slug}`);
  }

  const blogSlugs = cache?.blogSlugs instanceof Set ? [...cache.blogSlugs] : [];
  for (const slug of blogSlugs) {
    if (!slug) continue;
    const blogPath = normalizeRoutePath(`/${slug}`);
    if (EXACT_SPA_ROUTES.has(blogPath)) continue;
    if (NOINDEX_EXACT_ROUTES.has(blogPath)) continue;
    if (PREFIX_SPA_ROUTES.some((prefix) => blogPath === prefix || blogPath.startsWith(`${prefix}/`))) continue;
    routes.add(blogPath);
  }

  const urls = [...routes]
    .sort((left, right) => left.localeCompare(right))
    .map((pathname) => `${canonicalBase}${pathname === "/" ? "" : pathname}`);

  return urls.map((url) => normalizeAbsoluteHttpUrl(url)).filter(Boolean);
}

function buildBackendSitemapCandidates() {
  const backendOrigin = buildBackendOriginUrl();
  const backendApiBase = buildBackendApiBaseUrl();
  const candidates = [
    backendOrigin ? `${backendOrigin}/sitemap.xml` : "",
    backendApiBase ? `${backendApiBase}/sitemap.xml` : "",
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function buildSeoMeta(pathname, cache) {
  const settings = normalizeSiteSettings(cache?.siteSettings);
  const siteName = String(settings.siteName || DEFAULT_SITE_SETTINGS.siteName).trim();
  const defaultTitle = getLocalizedValue(
    settings.seo?.defaultMetaTitle,
    DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr
  );
  const defaultDescription = getLocalizedValue(
    settings.seo?.defaultMetaDescription,
    DEFAULT_SITE_SETTINGS.seo.defaultMetaDescription.fr
  );
  const defaultImage =
    String(settings.seo?.defaultOgImageUrl || "").trim() || "/pizza-background-1920.webp";
  const canonicalBaseUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const blogIntroText = getLocalizedValue(
    settings.blog?.introText,
    DEFAULT_SITE_SETTINGS.blog.introText.fr
  );
  const staticPageMeta = {
    "/": {
      title: defaultTitle,
      description: defaultDescription,
      image: defaultImage,
    },
    "/gallery": {
      title: `Galerie | ${siteName}`,
      description:
        "Photos du camion pizza, des cuissons et des pizzas napolitaines servies en Moselle.",
      image: defaultImage,
    },
    "/menu": {
      title: `Menu | ${siteName}`,
      description:
        `Consultez la carte ${siteName}: pizzas napolitaines artisanales, ingredients italiens et cuisson au four a bois et gaz.`,
      image: defaultImage,
    },
    "/planing": {
      title: `Horaires | ${siteName}`,
      description:
        "Retrouvez les horaires d'ouvertures, emplacements et deplacements du camion pizza napolitain.",
      image: defaultImage,
    },
    "/a-propos": {
      title: `A propos | ${siteName}`,
      description:
        `Decouvrez ${siteName}: pate maison, produits italiens, cuisson au four a bois et gaz et service a emporter.`,
      image: defaultImage,
    },
    "/contact": {
      title: `Contact | ${siteName}`,
      description:
        `Contactez ${siteName}. Informations de contact, reseaux et formulaire pour vos demandes.`,
      image: defaultImage,
    },
    "/blog": {
      title: `Blog | ${siteName}`,
      description:
        blogIntroText ||
        `Articles ${siteName}: pizza napolitaine, cuisson, ingredients italiens et savoir-faire artisanal.`,
      image: defaultImage,
    },
    "/mentions-legales": {
      title: `Mentions legales | ${siteName}`,
      description: `Mentions legales et informations de publication du site ${siteName}.`,
      image: defaultImage,
    },
    "/confidentialite": {
      title: `Confidentialite | ${siteName}`,
      description: `Politique de confidentialite du site ${siteName}.`,
      image: defaultImage,
    },
    "/conditions-generales": {
      title: `Conditions d'utilisation | ${siteName}`,
      description: `Conditions d'utilisation du site ${siteName}.`,
      image: defaultImage,
    },
    "/camion-pizza-moselle": {
      title: `Camion pizza en Moselle | ${siteName}`,
      description:
        "Camion pizza en Moselle: carte courte, cuisson vive et passages hebdomadaires dans les communes voisines.",
      image: defaultImage,
    },
  };

  if (pathname === "/pizza") {
    return {
      title: "Redirection vers la page locale",
      description: "Choisissez un emplacement actif pour acceder a la page locale.",
      robots: "noindex,follow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  if (staticPageMeta[pathname]) {
    return {
      ...staticPageMeta[pathname],
      robots: "index,follow",
      ogType: "website",
      pathname,
      siteName,
      canonicalBaseUrl,
    };
  }

  const pizzaDashMatch = /^\/pizza-([a-z0-9-]+)$/.exec(pathname);
  if (pizzaDashMatch) {
    const slug = slugify(pizzaDashMatch[1]);
    if (!cache.citySlugs.has(slug)) return null;
    const city = cache.cityLabelsBySlug.get(slug) || titleizeSlug(slug);
    return {
      title: `Pizza napolitaine ${city} | ${siteName}`,
      description:
        `Pizza napolitaine artisanale ${city}: ingredients italiens, cuisson au four a bois et gaz, service a emporter.`,
      robots: "index,follow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  const blogMatch = /^\/([a-z0-9-]+)$/.exec(pathname);
  if (blogMatch) {
    const slug = slugify(blogMatch[1]);
    if (!cache.blogSlugs.has(slug)) return null;
    const articleMeta = cache.blogMetaBySlug.get(slug);
    return {
      title: articleMeta ? `${articleMeta.title} | ${siteName}` : `Article | ${siteName}`,
      description:
        articleMeta?.description ||
        `Article du blog ${siteName} sur la pizza napolitaine artisanale et les ingredients italiens.`,
      image: articleMeta?.image || defaultImage,
      robots: "index,follow",
      ogType: "article",
      pathname,
      siteName,
      canonicalBaseUrl,
    };
  }

  const legacyPizzaMatch = /^\/pizza\/([^/]+)$/.exec(pathname);
  if (legacyPizzaMatch) {
    const slug = slugify(legacyPizzaMatch[1]);
    if (!cache.citySlugs.has(slug)) return null;
    return {
      title: "Redirection vers la page locale",
      description: `Redirection vers la page locale officielle ${siteName}.`,
      robots: "noindex,follow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  if (PREFIX_SPA_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return {
      title: `Admin | ${siteName}`,
      description: `Interface d'administration ${siteName}.`,
      robots: "noindex,nofollow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  if (NOINDEX_EXACT_ROUTES.has(pathname)) {
    return {
      title: `${siteName}`,
      description: defaultDescription,
      robots: "noindex,nofollow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  if (EXACT_SPA_ROUTES.has(pathname)) {
    return {
      title: defaultTitle,
      description: defaultDescription,
      robots: "index,follow",
      ogType: "website",
      pathname,
      siteName,
      image: defaultImage,
      canonicalBaseUrl,
    };
  }

  return null;
}

function renderHtmlWithSeo(req, meta) {
  const template = ensureIndexTemplate();
  const safeMeta = meta || {
    title: DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr,
    description: DEFAULT_SITE_SETTINGS.seo.defaultMetaDescription.fr,
  };
  const baseUrl = normalizeBaseUrl(safeMeta.canonicalBaseUrl) || getCanonicalBaseUrl(req);
  const pathname = safeMeta.pathname || req.path || "/";
  const canonical = `${baseUrl}${pathname}`;
  const image = String(safeMeta.image || "/pizza-background-1920.webp").startsWith("http")
    ? String(safeMeta.image || "/pizza-background-1920.webp")
    : `${baseUrl}${String(safeMeta.image || "/pizza-background-1920.webp").startsWith("/") ? String(safeMeta.image || "/pizza-background-1920.webp") : `/${String(safeMeta.image || "/pizza-background-1920.webp")}`}`;

  const titleTag = `<title>${escapeHtml(safeMeta.title)}</title>`;
  const descriptionTag = `<meta name="description" content="${escapeHtmlAttr(safeMeta.description)}" />`;
  const robotsTag = `<meta name="robots" content="${escapeHtmlAttr(safeMeta.robots || "index,follow")}" />`;
  const canonicalTag = `<link rel="canonical" href="${escapeHtmlAttr(canonical)}" />`;
  const ogTags = [
    `<meta property="og:type" content="${escapeHtmlAttr(safeMeta.ogType || "website")}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(safeMeta.siteName || DEFAULT_SITE_SETTINGS.siteName)}" />`,
    '<meta property="og:locale" content="fr_FR" />',
    `<meta property="og:title" content="${escapeHtmlAttr(safeMeta.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttr(safeMeta.description)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtmlAttr(image)}" />`,
  ].join("\n    ");
  const twitterTags = [
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtmlAttr(safeMeta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(safeMeta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtmlAttr(image)}" />`,
  ].join("\n    ");

  const dynamicSeoBlock = `<!-- dynamic-seo-start -->
    ${descriptionTag}
    ${robotsTag}
    ${canonicalTag}
    ${ogTags}
    ${twitterTags}
    <!-- dynamic-seo-end -->`;

  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/i, "");
  html = html.replace(/<!-- dynamic-seo-start -->[\s\S]*?<!-- dynamic-seo-end -->/i, "");
  html = html.replace("</head>", `  ${dynamicSeoBlock}\n  </head>`);

  return html;
}

function sendNoindex404(res) {
  res
    .status(404)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    .set("Pragma", "no-cache")
    .set("Expires", "0")
    .set("X-Robots-Tag", "noindex, nofollow")
    .send(`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>404 - Page introuvable</title>
    <meta name="robots" content="noindex,nofollow" />
  </head>
  <body style="font-family: Arial, sans-serif; background:#111827; color:#f3f4f6; margin:0; padding:32px;">
    <main style="max-width:720px; margin:0 auto;">
      <h1 style="font-size:28px; margin-bottom:12px;">404 - Page introuvable</h1>
      <p style="line-height:1.6;">Cette URL n'est pas disponible.</p>
      <p><a href="/" style="color:#fbbf24;">Retour a l'accueil</a></p>
    </main>
  </body>
</html>`);
}

function sendSpaWithSeo(req, res, meta) {
  const html = renderHtmlWithSeo(req, meta);
  res
    .status(200)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-cache, max-age=0, must-revalidate")
    .set("Pragma", "no-cache")
    .set("Expires", "0")
    .send(html);
}

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const isHttps = req.secure || forwardedProto === "https";
  if (isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.get("/robots.txt", (req, res) => {
  return res
    .status(200)
    .type("text/plain; charset=utf-8")
    .set("Cache-Control", "public, max-age=300")
    .send(buildRobotsTxt(req));
});

app.get("/favicon.ico", async (req, res) => {
  try {
    const cache = await refreshSeoCacheIfNeeded();
    const dynamicFaviconUrl = String(cache?.siteSettings?.seo?.faviconUrl || "").trim();
    if (dynamicFaviconUrl) {
      return res.redirect(302, dynamicFaviconUrl);
    }
  } catch (_error) {
    // Fall back to local static favicon when dynamic metadata is unavailable.
  }

  const localFaviconPath = path.join(BUILD_DIR, "favicon.ico");
  if (fs.existsSync(localFaviconPath)) {
    return res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("image/x-icon")
      .sendFile(localFaviconPath);
  }

  return res.status(204).end();
});

app.use(express.static(BUILD_DIR, { index: false, maxAge: "7d" }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const payload = await getSitemapPayload(req);
    const cacheControl =
      payload.sourceLabel === "backend"
        ? "no-store, no-cache, must-revalidate, max-age=0"
        : "public, max-age=60, stale-while-revalidate=30";
    const response = res
      .status(200)
      .type("application/xml; charset=utf-8")
      .set("Cache-Control", cacheControl)
      .set("X-Sitemap-Source", payload.sourceLabel);

    if (payload.sourceLabel === "backend") {
      response.set("Pragma", "no-cache");
      response.set("Expires", "0");
    }

    return response.send(payload.xml);
  } catch (_error) {
    return res.status(503).type("text/plain; charset=utf-8").send("Sitemap unavailable");
  }
});

app.use(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendNoindex404(res);
  }

  const pathname = req.path || "/";

  if (pathname.length > 1 && pathname.endsWith("/")) {
    const normalizedPath = pathname.replace(/\/+$/, "");
    const queryIndex = req.url.indexOf("?");
    const search = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    return res.redirect(301, `${normalizedPath}${search}`);
  }

  if (pathname === "/food-truck-pizza-moselle") {
    const queryIndex = req.url.indexOf("?");
    const search = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    return res.redirect(301, `/camion-pizza-moselle${search}`);
  }

  const legacyBlogMatch = /^\/blog\/([a-z0-9-]+)$/.exec(pathname.toLowerCase());
  if (legacyBlogMatch) {
    const requestedSlug = slugify(legacyBlogMatch[1]);
    const cache = await refreshSeoCacheIfNeeded();
    if (cache.blogSlugs.has(requestedSlug)) {
      return res.redirect(301, `/${requestedSlug}`);
    }

    const forcedCache = await refreshSeoCacheIfNeeded({ force: true });
    if (forcedCache.blogSlugs.has(requestedSlug)) {
      return res.redirect(301, `/${requestedSlug}`);
    }

    return sendNoindex404(res);
  }

  if (pathname === "/pizza") {
    const locationIdParam = String(
      req.query?.locationId || req.query?.locationID || req.query?.locationid || ""
    ).trim();
    if (locationIdParam) {
      const locationId = Number(locationIdParam);
      if (!Number.isFinite(locationId) || locationId <= 0) {
        return sendNoindex404(res);
      }

      const cache = await refreshSeoCacheIfNeeded();
      const slug = cache.citySlugByLocationId.get(locationId);
      if (slug) {
        return res.redirect(302, `/pizza-${slug}`);
      }

      const forcedCache = await refreshSeoCacheIfNeeded({ force: true });
      const forcedSlug = forcedCache.citySlugByLocationId.get(locationId);
      if (forcedSlug) {
        return res.redirect(302, `/pizza-${forcedSlug}`);
      }

      return sendNoindex404(res);
    }
  }

  if (
    EXACT_SPA_ROUTES.has(pathname) ||
    PREFIX_SPA_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    const cache = await refreshSeoCacheIfNeeded();
    const meta = buildSeoMeta(pathname, cache);
    return sendSpaWithSeo(req, res, meta);
  }

  const cache = await refreshSeoCacheIfNeeded();
  const dynamicMeta = buildSeoMeta(pathname, cache);
  if (dynamicMeta) {
    return sendSpaWithSeo(req, res, dynamicMeta);
  }

  if (isDynamicSeoPath(pathname)) {
    const forcedCache = await refreshSeoCacheIfNeeded({ force: true });
    const forcedDynamicMeta = buildSeoMeta(pathname, forcedCache);
    if (forcedDynamicMeta) {
      return sendSpaWithSeo(req, res, forcedDynamicMeta);
    }
  }

  return sendNoindex404(res);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Web service front running on port ${PORT}`);
  });
}

module.exports = {
  app,
  resetServerCachesForTests() {
    const initialSeoCache = createInitialSeoCache();
    seoCache.expiresAt = initialSeoCache.expiresAt;
    seoCache.lastRefreshAt = initialSeoCache.lastRefreshAt;
    seoCache.citySlugs = initialSeoCache.citySlugs;
    seoCache.cityLabelsBySlug = initialSeoCache.cityLabelsBySlug;
    seoCache.citySlugByLocationId = initialSeoCache.citySlugByLocationId;
    seoCache.blogSlugs = initialSeoCache.blogSlugs;
    seoCache.blogMetaBySlug = initialSeoCache.blogMetaBySlug;
    seoCache.siteSettings = initialSeoCache.siteSettings;

    const initialSitemapCache = createInitialSitemapCache();
    sitemapCache.expiresAt = initialSitemapCache.expiresAt;
    sitemapCache.xml = initialSitemapCache.xml;
    sitemapCache.sourceLabel = initialSitemapCache.sourceLabel;

    seoRefreshPromise = null;
    sitemapRefreshPromise = null;
    indexTemplate = "";
  },
};
