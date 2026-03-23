function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function isLikelyLanOrLocalHostname(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) return false;
  if (["localhost", "127.0.0.1", "::1"].includes(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  return false;
}

function resolveDevApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5000/api";
  }

  const runtimeProtocol = window.location?.protocol === "https:" ? "https" : "http";
  const runtimeHost = String(window.location?.hostname || "localhost").trim() || "localhost";
  return `${runtimeProtocol}://${runtimeHost}:5000/api`;
}

function resolveRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:5000/api";
  }

  const runtimeProtocol = window.location?.protocol === "https:" ? "https" : "http";
  const runtimeHost = String(window.location?.hostname || "").trim();

  if (isLikelyLanOrLocalHostname(runtimeHost)) {
    return `${runtimeProtocol}://${runtimeHost || "localhost"}:5000/api`;
  }

  return `${window.location.origin.replace(/\/+$/, "")}/api`;
}

function stripKnownSubdomain(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (normalized.startsWith("api.")) return normalized.slice(4);
  if (normalized.startsWith("admin.")) return normalized.slice(6);
  return normalized;
}

function resolveRuntimePublicOrderUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:8000/order";
  }

  const runtimeProtocol = window.location?.protocol === "https:" ? "https" : "http";
  const runtimeHost = String(window.location?.hostname || "").trim();

  if (isLikelyLanOrLocalHostname(runtimeHost)) {
    return `${runtimeProtocol}://${runtimeHost || "localhost"}:8000/order`;
  }

  const cleanedHost = stripKnownSubdomain(runtimeHost);
  if (cleanedHost && cleanedHost !== runtimeHost) {
    return `${runtimeProtocol}://${cleanedHost}/order`;
  }

  return `${window.location.origin.replace(/\/+$/, "")}/order`;
}

export const APP_NAME = "Admin Pizzeria Mobile";
const DEFAULT_API_BASE_URL =
  typeof window === "undefined" ? resolveDevApiBaseUrl() : resolveRuntimeApiBaseUrl();

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
);
export const REALTIME_STREAM_URL =
  normalizeBaseUrl(import.meta.env.VITE_REALTIME_STREAM_URL) || `${API_BASE_URL}/realtime/stream`;
export const PUBLIC_ORDER_URL =
  normalizeBaseUrl(import.meta.env.VITE_PUBLIC_ORDER_URL) || resolveRuntimePublicOrderUrl();

export function buildApiUrl(pathname) {
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${API_BASE_URL}${suffix}`;
}
