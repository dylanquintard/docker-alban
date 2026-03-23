const seoService = require("../services/seo.service");
const blogService = require("../services/blog.service");

async function getSitemapXml(_req, res) {
  try {
    const xml = await seoService.buildSitemapXml();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // Always serve fresh sitemap content so new admin-created pages appear immediately.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ error: "Unable to generate sitemap" });
  }
}

async function getBlogSlugs(_req, res) {
  try {
    const slugs = await blogService.getPublishedBlogSlugs();
    res.json({ slugs });
  } catch (_err) {
    res.status(500).json({ error: "Unable to load blog slugs" });
  }
}

async function getSeoBlogArticles(_req, res) {
  try {
    const articles = await blogService.getSeoBlogArticles();
    res.json({ articles });
  } catch (_err) {
    res.status(500).json({ error: "Unable to load blog articles" });
  }
}

async function getSeoLocations(_req, res) {
  try {
    const locations = await seoService.getSeoLocationCatalog();
    res.json({ locations });
  } catch (_err) {
    res.status(500).json({ error: "Unable to load SEO locations" });
  }
}

module.exports = {
  getSitemapXml,
  getBlogSlugs,
  getSeoBlogArticles,
  getSeoLocations,
};
