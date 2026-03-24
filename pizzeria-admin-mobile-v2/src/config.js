function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export const APP_NAME = "Admin Mobile V2";
export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api");
export const REALTIME_STREAM_URL =
  normalizeBaseUrl(import.meta.env.VITE_REALTIME_STREAM_URL) || `${API_BASE_URL}/realtime/stream`;
export const PUBLIC_ORDER_URL =
  normalizeBaseUrl(import.meta.env.VITE_PUBLIC_ORDER_URL) || "http://localhost:8000/order";

export function buildApiUrl(pathname) {
  const suffix = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${API_BASE_URL}${suffix}`;
}
