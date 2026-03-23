const siteSettingsService = require("../services/site-settings.service");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const pngToIcoModule = require("png-to-ico");
const { UPLOAD_DIR, UPLOAD_PUBLIC_BASE_URL } = require("../lib/env");

const pngToIco = pngToIcoModule.default || pngToIcoModule;

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
}

function setPublicCacheHeaders(res) {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

function buildPublicAssetUrl(req, assetPath) {
  const normalizedPath = String(assetPath || "").trim();
  if (!normalizedPath) return normalizedPath;

  if (UPLOAD_PUBLIC_BASE_URL) {
    return `${UPLOAD_PUBLIC_BASE_URL}${normalizedPath}`;
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  if (!host) return normalizedPath;

  return `${protocol}://${host}${normalizedPath}`;
}

async function getPublicSiteSettings(_req, res) {
  try {
    setPublicCacheHeaders(res);
    const settings = await siteSettingsService.getPublicSiteSettings();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getAdminSiteSettings(_req, res) {
  try {
    setNoStoreHeaders(res);
    const settings = await siteSettingsService.getAdminSiteSettings();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateSiteSettings(req, res) {
  try {
    setNoStoreHeaders(res);
    const settings = await siteSettingsService.updateSiteSettings(req.body);
    res.json(settings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function translateSiteSettingsToEnglish(req, res) {
  try {
    setNoStoreHeaders(res);
    const translated = await siteSettingsService.translateSiteSettingsToEnglish(req.body);
    res.json(translated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function uploadSiteHeaderLogo(req, res) {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({
        error: "image file is required (multipart field name: image)",
      });
      return;
    }

    const outputDirectory = path.join(UPLOAD_DIR, "site-settings", "header-logo");
    await fs.mkdir(outputDirectory, { recursive: true });

    const fileName = `header-logo-${Date.now()}.webp`;
    const outputPath = path.join(outputDirectory, fileName);
    const faviconFileName = `favicon-${Date.now()}.ico`;
    const faviconOutputPath = path.join(outputDirectory, faviconFileName);

    await sharp(req.file.buffer, { failOn: "error" })
      .rotate()
      .resize({
        width: 112,
        height: 112,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toFile(outputPath);

    const faviconPngBuffer = await sharp(req.file.buffer, { failOn: "error" })
      .rotate()
      .resize({
        width: 64,
        height: 64,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const faviconIcoBuffer = await pngToIco(faviconPngBuffer);
    await fs.writeFile(faviconOutputPath, faviconIcoBuffer);

    const publicPath = `/uploads/site-settings/header-logo/${fileName}`;
    const faviconPublicPath = `/uploads/site-settings/header-logo/${faviconFileName}`;
    res.status(201).json({
      imageUrl: buildPublicAssetUrl(req, publicPath),
      faviconUrl: buildPublicAssetUrl(req, faviconPublicPath),
      width: 112,
      height: 112,
      mimeType: "image/webp",
    });
  } catch (err) {
    res.status(400).json({ error: err?.message || "Unable to upload header logo" });
  }
}

module.exports = {
  getAdminSiteSettings,
  getPublicSiteSettings,
  translateSiteSettingsToEnglish,
  uploadSiteHeaderLogo,
  updateSiteSettings,
};
