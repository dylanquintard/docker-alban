import { BRAND_LOGO_URL, SITE_URL } from "../config/env";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildAbsoluteUrl(value, baseUrl = SITE_URL) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^https?:\/\//i.test(source)) return source;

  try {
    return new URL(source.startsWith("/") ? source : `/${source}`, `${baseUrl}/`).toString();
  } catch (_err) {
    return "";
  }
}

function toPostalAddress(address) {
  const normalizedAddress = String(address || "").trim();
  if (!normalizedAddress) return null;

  return {
    "@type": "PostalAddress",
    streetAddress: normalizedAddress,
  };
}

function buildSocialLinks(links = []) {
  return links
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

export function buildBaseFoodEstablishmentJsonLd({
  pagePath = "/",
  pageName = "Camion Pizza Italienne",
  description = "",
  siteName = "Camion Pizza Italienne",
  siteUrl = SITE_URL,
  phone = "",
  email = "",
  address = "",
  mapUrl = "",
  image = "",
  areaServed = ["Moselle"],
  socialUrls = [],
  priceRange = "EUR",
  extra = {},
} = {}) {
  const normalizedSiteUrl = normalizeBaseUrl(siteUrl) || SITE_URL;
  const canonical = new URL(pagePath, `${normalizedSiteUrl}/`).toString();
  const resolvedImage =
    buildAbsoluteUrl(image, normalizedSiteUrl) || buildAbsoluteUrl(BRAND_LOGO_URL, normalizedSiteUrl);
  const resolvedAddress = toPostalAddress(address);
  const sameAs = buildSocialLinks(socialUrls);
  const contactPoint = [];

  if (String(phone || "").trim()) {
    contactPoint.push({
      "@type": "ContactPoint",
      telephone: String(phone).trim(),
      contactType: "customer service",
    });
  }

  if (String(email || "").trim()) {
    contactPoint.push({
      "@type": "ContactPoint",
      email: String(email).trim(),
      contactType: "customer support",
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "@id": canonical,
    name: siteName,
    url: canonical,
    description,
    priceRange,
    servesCuisine: "Pizza napolitaine",
    areaServed,
    sameAs,
    ...(resolvedImage
      ? {
          image: resolvedImage,
          logo: resolvedImage,
        }
      : {}),
    ...(resolvedAddress ? { address: resolvedAddress } : {}),
    ...(String(mapUrl || "").trim() ? { hasMap: String(mapUrl).trim() } : {}),
    ...(contactPoint.length > 0 ? { contactPoint } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
      name: pageName,
    },
    ...extra,
  };
}

export function buildFaqJsonLd(items = []) {
  const entities = (Array.isArray(items) ? items : [])
    .map((item) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer)
    .map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));

  if (entities.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  };
}

export function buildBreadcrumbJsonLd(items = [], siteUrl = SITE_URL) {
  const normalizedSiteUrl = normalizeBaseUrl(siteUrl) || SITE_URL;
  const entries = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const name = String(item?.name || "").trim();
      const path = String(item?.path || "").trim();
      if (!name || !path) return null;

      return {
        "@type": "ListItem",
        position: index + 1,
        name,
        item: buildAbsoluteUrl(path, normalizedSiteUrl),
      };
    })
    .filter(Boolean);

  if (entries.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries,
  };
}
