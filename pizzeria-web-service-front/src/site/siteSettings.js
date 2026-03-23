import {
  sanitizeAbsoluteHttpUrl,
  sanitizeInternalOrAbsoluteHttpUrl,
  sanitizeMediaUrl,
} from "../utils/url";

export const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteName: "Camion Pizza Italienne",
  siteTagline: {
    fr: "Pizza napolitaine au feu de bois en Moselle",
    en: "Wood-fired Neapolitan pizza in Moselle",
  },
  siteDescription: {
    fr: "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
    en: "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup.",
  },
  contact: {
    phone: "",
    email: "",
    address: "",
    mapsUrl: "",
    serviceArea: {
      fr: "Moselle et alentours",
      en: "Moselle and surrounding areas",
    },
  },
  social: {
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
  },
  seo: {
    defaultMetaTitle: {
      fr: "Camion Pizza Italienne | Pizza napolitaine au feu de bois en Moselle",
      en: "Italian Pizza Service | Wood-fired Neapolitan pizza in Moselle",
    },
    defaultMetaDescription: {
      fr: "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
      en: "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup.",
    },
    defaultOgImageUrl: "",
    headerLogoUrl: "",
    faviconUrl: "",
    canonicalSiteUrl: "",
  },
  home: {
    heroTitle: {
      fr: "Pizza napolitaine au feu de bois en Moselle",
      en: "Wood-fired Neapolitan pizza in Moselle",
    },
    heroSubtitle: {
      fr: "Une pizza travaillee pour l emporter: pâte souple, cuisson vive et recettes nettes a reçuperer en Moselle.",
      en: "Pizza built for pickup: supple dough, lively baking and cleaner recipes to collect in Moselle.",
    },
    primaryCtaLabel: {
      fr: "Commander",
      en: "Order now",
    },
    secondaryCtaLabel: {
      fr: "Voir le menu",
      en: "See menu",
    },
    reassuranceText: {
      fr: "Commande en ligne, retrait rapide, cuisson minute",
      en: "Online ordering, quick pickup, baked to order",
    },
    highlightedIngredients: {
      fr: [
        "farine Nuvola Super",
        "tomates San Marzano",
        "mozzarella fior di latte",
        "parmigiano reggiano",
        "jambon de Parme",
        "prosciutto italien",
      ].join("\n"),
      en: [
        "Nuvola Super flour",
        "San Marzano tomatoes",
        "fior di latte mozzarella",
        "Parmigiano Reggiano",
        "Parma ham",
        "Italian prosciutto",
      ].join("\n"),
    },
  },
  blog: {
    introTitle: {
      fr: "Farines, tomates, mozzarella & surtout la pizza !",
      en: "Flour, tomatoes, mozzarella and above all, pizza!",
    },
    introText: {
      fr: "Ici on parle d'italie, de saveurs, de savoir faire et de qualité !",
      en: "Here we talk about Italy, flavor, craft and quality!",
    },
  },
  contactPage: {
    pageTitle: {
      fr: "Nous contacter",
      en: "Get in touch",
    },
    introText: {
      fr: "Pour toute question sur la commande ou les horaires d'ouvertures, contacte-nous directement.",
      en: "For any question about ordering or opening hours, contact us directly.",
    },
    helperText: {
      fr: "Retrouvez ici nos coordonnées, nos réseaux et le formulaire de contact.",
      en: "Find our contact details, social links and contact form here.",
    },
  },
  order: {
    pickupIntroText: {
      fr: "Choisissez d'abord la date, l'horaire, puis l'adresse de retrait.",
      en: "Choose date first, then pickup time and location.",
    },
    pickupConfirmationText: {
      fr: "Vérifiez bien cette adresse avant de finaliser la commande.",
      en: "Please verify this address before finalizing your order.",
    },
    showMenuProductImages: true,
  },
  footer: {
    shortText: {
      fr: "Pizza napolitaine artisanale, commande en ligne et retrait rapide.",
      en: "Artisan Neapolitan pizza, online ordering and quick pickup.",
    },
    legalText: {
      fr: "Informations et disponibilités susceptibles d'évoluer selon la tournée.",
      en: "Information and availability may change depending on the weekly route.",
    },
    copyright: {
      fr: "Tous droits reserves.",
      en: "All rights reserved.",
    },
  },
  announcement: {
    enabled: false,
    text: {
      fr: "",
      en: "",
    },
    linkUrl: "",
    variant: "info",
  },
  pizzaPage: {
    sectionTitle: {
      fr: "Nos pizzas du moment",
      en: "Our featured pizzas",
    },
    sectionDescription: {
      fr: "Une sélection mise en avant par l'équipe. Commandez en ligne en quelques clics.",
      en: "A sélection highlighted by the team. Order online in just a few clicks.",
    },
    featuredProductIds: [],
  },
  createdAt: null,
  updatedAt: null,
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeLocalizedValue(defaultValue, nextValue) {
  const source = isPlainObject(nextValue) ? nextValue : {};
  return {
    fr:
      typeof source.fr === "string"
        ? source.fr
        : typeof defaultValue?.fr === "string"
          ? defaultValue.fr
          : "",
    en:
      typeof source.en === "string"
        ? source.en
        : typeof defaultValue?.en === "string"
          ? defaultValue.en
          : "",
  };
}

export function mergeSiteSettings(nextValue) {
  const defaults = cloneDefaults();
  const source = isPlainObject(nextValue) ? nextValue : {};

  return {
    siteName:
      typeof source.siteName === "string" && source.siteName.trim()
        ? source.siteName.trim()
        : defaults.siteName,
    siteTagline: mergeLocalizedValue(defaults.siteTagline, source.siteTagline),
    siteDescription: mergeLocalizedValue(defaults.siteDescription, source.siteDescription),
    contact: {
      phone:
        typeof source.contact?.phone === "string"
          ? source.contact.phone.trim()
          : defaults.contact.phone,
      email:
        typeof source.contact?.email === "string"
          ? source.contact.email.trim()
          : defaults.contact.email,
      address:
        typeof source.contact?.address === "string"
          ? source.contact.address.trim()
          : defaults.contact.address,
      mapsUrl:
        typeof source.contact?.mapsUrl === "string"
          ? sanitizeAbsoluteHttpUrl(source.contact.mapsUrl)
          : defaults.contact.mapsUrl,
      serviceArea: mergeLocalizedValue(
        defaults.contact.serviceArea,
        source.contact?.serviceArea
      ),
    },
    social: {
      instagramUrl:
        typeof source.social?.instagramUrl === "string"
          ? sanitizeAbsoluteHttpUrl(source.social.instagramUrl)
          : defaults.social.instagramUrl,
      facebookUrl:
        typeof source.social?.facebookUrl === "string"
          ? sanitizeAbsoluteHttpUrl(source.social.facebookUrl)
          : defaults.social.facebookUrl,
      tiktokUrl:
        typeof source.social?.tiktokUrl === "string"
          ? sanitizeAbsoluteHttpUrl(source.social.tiktokUrl)
          : defaults.social.tiktokUrl,
    },
    seo: {
      defaultMetaTitle: mergeLocalizedValue(
        defaults.seo.defaultMetaTitle,
        source.seo?.defaultMetaTitle
      ),
      defaultMetaDescription: mergeLocalizedValue(
        defaults.seo.defaultMetaDescription,
        source.seo?.defaultMetaDescription
      ),
      defaultOgImageUrl:
        typeof source.seo?.defaultOgImageUrl === "string"
          ? sanitizeMediaUrl(source.seo.defaultOgImageUrl)
          : defaults.seo.defaultOgImageUrl,
      headerLogoUrl:
        typeof source.seo?.headerLogoUrl === "string"
          ? sanitizeMediaUrl(source.seo.headerLogoUrl)
          : defaults.seo.headerLogoUrl,
      faviconUrl:
        typeof source.seo?.faviconUrl === "string"
          ? sanitizeMediaUrl(source.seo.faviconUrl)
          : defaults.seo.faviconUrl,
      canonicalSiteUrl:
        typeof source.seo?.canonicalSiteUrl === "string"
          ? sanitizeAbsoluteHttpUrl(source.seo.canonicalSiteUrl)
          : defaults.seo.canonicalSiteUrl,
    },
    home: {
      heroTitle: mergeLocalizedValue(defaults.home.heroTitle, source.home?.heroTitle),
      heroSubtitle: mergeLocalizedValue(defaults.home.heroSubtitle, source.home?.heroSubtitle),
      primaryCtaLabel: mergeLocalizedValue(
        defaults.home.primaryCtaLabel,
        source.home?.primaryCtaLabel
      ),
      secondaryCtaLabel: mergeLocalizedValue(
        defaults.home.secondaryCtaLabel,
        source.home?.secondaryCtaLabel
      ),
      reassuranceText: mergeLocalizedValue(
        defaults.home.reassuranceText,
        source.home?.reassuranceText
      ),
      highlightedIngredients: mergeLocalizedValue(
        defaults.home.highlightedIngredients,
        source.home?.highlightedIngredients
      ),
    },
    blog: {
      introTitle: mergeLocalizedValue(defaults.blog.introTitle, source.blog?.introTitle),
      introText: mergeLocalizedValue(defaults.blog.introText, source.blog?.introText),
    },
    contactPage: {
      pageTitle: mergeLocalizedValue(
        defaults.contactPage.pageTitle,
        source.contactPage?.pageTitle
      ),
      introText: mergeLocalizedValue(
        defaults.contactPage.introText,
        source.contactPage?.introText
      ),
      helperText: mergeLocalizedValue(
        defaults.contactPage.helperText,
        source.contactPage?.helperText
      ),
    },
    order: {
      pickupIntroText: mergeLocalizedValue(
        defaults.order.pickupIntroText,
        source.order?.pickupIntroText
      ),
      pickupConfirmationText: mergeLocalizedValue(
        defaults.order.pickupConfirmationText,
        source.order?.pickupConfirmationText
      ),
      showMenuProductImages:
        typeof source.order?.showMenuProductImages === "boolean"
          ? source.order.showMenuProductImages
          : defaults.order.showMenuProductImages,
    },
    footer: {
      shortText: mergeLocalizedValue(defaults.footer.shortText, source.footer?.shortText),
      legalText: mergeLocalizedValue(defaults.footer.legalText, source.footer?.legalText),
      copyright: mergeLocalizedValue(defaults.footer.copyright, source.footer?.copyright),
    },
    announcement: {
      enabled:
        typeof source.announcement?.enabled === "boolean"
          ? source.announcement.enabled
          : defaults.announcement.enabled,
      text: mergeLocalizedValue(defaults.announcement.text, source.announcement?.text),
      linkUrl:
        typeof source.announcement?.linkUrl === "string"
          ? sanitizeInternalOrAbsoluteHttpUrl(source.announcement.linkUrl)
          : defaults.announcement.linkUrl,
      variant:
        typeof source.announcement?.variant === "string" &&
        source.announcement.variant.trim()
          ? source.announcement.variant.trim()
          : defaults.announcement.variant,
    },
    pizzaPage: {
      sectionTitle: mergeLocalizedValue(
        defaults.pizzaPage.sectionTitle,
        source.pizzaPage?.sectionTitle
      ),
      sectionDescription: mergeLocalizedValue(
        defaults.pizzaPage.sectionDescription,
        source.pizzaPage?.sectionDescription
      ),
      featuredProductIds: Array.from(
        new Set(
          (Array.isArray(source.pizzaPage?.featuredProductIds)
            ? source.pizzaPage.featuredProductIds
            : defaults.pizzaPage.featuredProductIds
          )
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        )
      ),
    },
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}

export function getLocalizedSiteText(value, language, fallback = "") {
  const localized = mergeLocalizedValue({ fr: fallback, en: fallback }, value);
  if (language === "en") {
    return localized.en || localized.fr || fallback;
  }
  return localized.fr || localized.en || fallback;
}

