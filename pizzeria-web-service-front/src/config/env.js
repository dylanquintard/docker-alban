const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

const normalizeUrl = (value) => {
  if (!value) return "";

  const trimmed = value.trim();
  const isHttpUrl = /^https?:\/\/.+/i.test(trimmed);

  if (!isHttpUrl) return "";
  return stripTrailingSlash(trimmed);
};

const normalizeBrandLogoUrl = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  if (/^https?:\/\/.+/i.test(trimmed)) return trimmed;
  return "";
};

const isLoopbackOrPrivateHostname = (hostname) => {
  const normalizedHost = String(hostname || "").trim().toLowerCase();
  if (!normalizedHost) return false;

  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    normalizedHost === "host.docker.internal"
  ) {
    return true;
  }

  if (normalizedHost.endsWith(".local")) {
    return true;
  }

  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalizedHost) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalizedHost) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalizedHost)
  );
};

const isAllowedProductionApiUrl = (value) => {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || isLoopbackOrPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const clientEnv =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const nodeEnv =
  typeof process !== "undefined" && process.env ? process.env : {};

const readClientEnv = (viteKey, legacyKey) => {
  const viteValue = clientEnv[viteKey];
  if (typeof viteValue === "string" && viteValue.trim()) return viteValue;

  const legacyValue = nodeEnv[legacyKey];
  if (typeof legacyValue === "string" && legacyValue.trim()) return legacyValue;

  return "";
};

const localApiBaseUrl = "http://localhost:5000/api";
const isProduction = Boolean(clientEnv.PROD) || nodeEnv.NODE_ENV === "production";
const configuredApiBaseUrl = normalizeUrl(
  readClientEnv("VITE_API_BASE_URL", "REACT_APP_API_BASE_URL")
);
const configuredSiteUrl = normalizeUrl(
  readClientEnv("VITE_SITE_URL", "REACT_APP_SITE_URL")
);
const runtimeSiteUrl =
  typeof window !== "undefined" ? normalizeUrl(window.location.origin) : "";
const fallbackSiteUrl = "https://example.invalid";

if (isProduction) {
  if (!configuredApiBaseUrl) {
    throw new Error("VITE_API_BASE_URL is required in production.");
  }

  if (!isAllowedProductionApiUrl(configuredApiBaseUrl)) {
    throw new Error(
      "VITE_API_BASE_URL must use HTTPS in production unless it targets a local development host."
    );
  }
}

export const API_BASE_URL =
  configuredApiBaseUrl || localApiBaseUrl;

export const SITE_URL = configuredSiteUrl || runtimeSiteUrl || fallbackSiteUrl;

export const REALTIME_STREAM_URL = `${API_BASE_URL}/realtime/stream`;

export const BRAND_LOGO_URL =
  normalizeBrandLogoUrl(readClientEnv("VITE_BRAND_LOGO_URL", "REACT_APP_BRAND_LOGO_URL"));

