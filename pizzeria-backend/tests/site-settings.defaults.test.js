const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_SUPPORTS_LOCAL_SEO,
} = require("../src/services/site-settings.service");

test("site settings defaults no longer expose legacy Pizza Truck branding", () => {
  assert.equal(DEFAULT_SITE_SETTINGS.siteName, "Camion Pizza Italienne");
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr, /Pizza Truck/i);
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.seo.defaultMetaDescription.fr, /Pizza Truck/i);
});

test("site settings defaults no longer hardcode Metz in generic service area copy", () => {
  assert.equal(DEFAULT_SITE_SETTINGS.contact.serviceArea.fr, "Moselle et alentours");
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.siteDescription.fr, /Metz/i);
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.home.heroSubtitle.fr, /Metz/i);
  assert.equal(DEFAULT_SITE_SETTINGS.order.showMenuProductImages, true);
});

test("site settings Prisma compatibility flag reflects current generated client", () => {
  assert.equal(typeof SITE_SETTINGS_SUPPORTS_LOCAL_SEO, "boolean");
});
