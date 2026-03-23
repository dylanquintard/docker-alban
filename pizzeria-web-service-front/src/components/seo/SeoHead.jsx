import { Helmet } from "react-helmet-async";
import { SITE_URL } from "../../config/env";
import { useLanguage } from "../../context/LanguageContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../../site/siteSettings";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildCanonical(pathname = "/", siteUrl = SITE_URL) {
  try {
    return new URL(pathname, `${siteUrl}/`).toString();
  } catch (_err) {
    return siteUrl;
  }
}

export default function SeoHead({
  title,
  description,
  pathname = "/",
  image = "",
  ogType = "website",
  robots = "index,follow",
  jsonLd = null,
}) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const canonicalBaseUrl = normalizeBaseUrl(settings.seo?.canonicalSiteUrl) || SITE_URL;
  const computedTitle =
    title ||
    getLocalizedSiteText(
      settings.seo?.defaultMetaTitle,
      language,
      settings.siteName || DEFAULT_SITE_SETTINGS.siteName
    );
  const computedDescription =
    description ||
    getLocalizedSiteText(settings.seo?.defaultMetaDescription, language, "");
  const resolvedImage =
    image || settings.seo?.defaultOgImageUrl || "/pizza-background-1920.webp";
  const resolvedFavicon =
    settings.seo?.faviconUrl || settings.seo?.headerLogoUrl || "/favicon.ico";
  const canonical = buildCanonical(pathname, canonicalBaseUrl);
  const absoluteImage = resolvedImage.startsWith("http")
    ? resolvedImage
    : `${canonicalBaseUrl}${resolvedImage.startsWith("/") ? resolvedImage : `/${resolvedImage}`}`;
  const absoluteFavicon = resolvedFavicon.startsWith("http")
    ? resolvedFavicon
    : `${canonicalBaseUrl}${resolvedFavicon.startsWith("/") ? resolvedFavicon : `/${resolvedFavicon}`}`;
  const jsonLdEntries = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <title>{computedTitle}</title>
      <meta name="description" content={computedDescription} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />
      <link rel="icon" href={absoluteFavicon} type="image/x-icon" />

      <meta property="og:type" content={ogType} />
      <meta
        property="og:site_name"
        content={settings.siteName || DEFAULT_SITE_SETTINGS.siteName}
      />
      <meta property="og:locale" content={language === "en" ? "en_US" : "fr_FR"} />
      <meta property="og:title" content={computedTitle} />
      <meta property="og:description" content={computedDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={absoluteImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={computedTitle} />
      <meta name="twitter:description" content={computedDescription} />
      <meta name="twitter:image" content={absoluteImage} />

      {jsonLdEntries.map((entry, index) => (
        <script
          key={`jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
    </Helmet>
  );
}
