import {
  DEFAULT_SITE_SETTINGS,
  getLocalizedSiteText,
  mergeSiteSettings,
} from "./siteSettings";

test("site settings defaults use the generic site identity", () => {
  expect(DEFAULT_SITE_SETTINGS.siteName).toBe("Camion Pizza Italienne");
  expect(DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr).not.toMatch(/Pizza Truck/i);
  expect(DEFAULT_SITE_SETTINGS.siteDescription.fr).not.toMatch(/Metz/i);
});

test("mergeSiteSettings falls back to the default site identity", () => {
  const merged = mergeSiteSettings({});

  expect(merged.siteName).toBe(DEFAULT_SITE_SETTINGS.siteName);
  expect(merged.contact.serviceArea.fr).toBe("Moselle et alentours");
  expect(merged.order.showMenuProductImages).toBe(true);
});

test("getLocalizedSiteText returns the requested language when available", () => {
  const value = { fr: "Bonjour", en: "Hello" };

  expect(getLocalizedSiteText(value, "fr", "")).toBe("Bonjour");
  expect(getLocalizedSiteText(value, "en", "")).toBe("Hello");
});

test("mergeSiteSettings sanitizes external and announcement urls", () => {
  const merged = mergeSiteSettings({
    contact: {
      mapsUrl: "javascript:alert(1)",
    },
    social: {
      instagramUrl: "https://instagram.com/example",
      facebookUrl: "javascript:alert(1)",
    },
    announcement: {
      linkUrl: "javascript:alert(1)",
    },
  });

  expect(merged.contact.mapsUrl).toBe("");
  expect(merged.social.instagramUrl).toBe("https://instagram.com/example");
  expect(merged.social.facebookUrl).toBe("");
  expect(merged.announcement.linkUrl).toBe("");
});

test("mergeSiteSettings accepts the menu image visibility toggle", () => {
  const merged = mergeSiteSettings({
    order: {
      showMenuProductImages: false,
    },
  });

  expect(merged.order.showMenuProductImages).toBe(false);
});

test("mergeSiteSettings normalizes local seo entries", () => {
  const merged = mergeSiteSettings({
    localSeo: {
      entries: {
        3: {
          locationId: "3",
          locationName: "Hayange",
          title: { fr: "Pizza Hayange" },
          paragraphs: [{ fr: "Premier paragraphe" }, { en: "Second paragraph" }],
        },
      },
    },
  });

  expect(merged.localSeo.entries["3"]).toEqual({
    locationId: 3,
    locationName: "Hayange",
    title: {
      fr: "Pizza Hayange",
      en: "",
    },
    paragraphs: [
      {
        fr: "Premier paragraphe",
        en: "",
      },
      {
        fr: "",
        en: "Second paragraph",
      },
    ],
  });
});
