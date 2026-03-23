const { UPLOAD_PUBLIC_BASE_URL } = require("../lib/env");

function normalizePublicMediaUrl(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  if (!normalized) return normalized;

  let pathname = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathname = new URL(normalized).pathname;
    } catch (_error) {
      return normalized;
    }
  }

  if (!pathname.startsWith("/uploads/")) {
    return normalized;
  }

  if (!UPLOAD_PUBLIC_BASE_URL) {
    return normalized;
  }

  return `${UPLOAD_PUBLIC_BASE_URL}${pathname}`;
}

module.exports = {
  normalizePublicMediaUrl,
};
