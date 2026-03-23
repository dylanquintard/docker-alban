import axios from "axios";
import { API_BASE_URL } from "../config/env";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_REFRESH_ENDPOINT = "/users/csrf-token";
const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);
const PUBLIC_MUTATING_PATHS = new Set([
  "/users/login",
  "/users/register",
  "/users/verify-email",
  "/users/resend-verification",
  "/users/forgot-password",
]);
let csrfToken = "";
let csrfRefreshPromise = null;

function isJwtLike(value) {
  if (typeof value !== "string") return false;
  const token = value.trim();
  if (!token) return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function normalizeCsrfToken(value) {
  const token = String(value || "").trim();
  return token || "";
}

function setCsrfToken(token) {
  csrfToken = normalizeCsrfToken(token);
}

export function clearCsrfToken() {
  csrfToken = "";
}

function getRequestPath(config) {
  return String(config?.url || "").split("?")[0].trim();
}

function isPublicMutatingRequest(config) {
  const path = getRequestPath(config);
  return PUBLIC_MUTATING_PATHS.has(path);
}

async function refreshCsrfToken() {
  if (csrfRefreshPromise) return csrfRefreshPromise;

  csrfRefreshPromise = api
    .get(CSRF_REFRESH_ENDPOINT)
    .catch(() => undefined)
    .finally(() => {
      csrfRefreshPromise = null;
    });

  return csrfRefreshPromise;
}

api.interceptors.request.use((config) => {
  const withPotentialCsrfRefresh = async () => {
    const method = String(config?.method || "get").toLowerCase();
    if (!MUTATING_METHODS.has(method)) return config;
    if (isPublicMutatingRequest(config)) return config;

    if (!csrfToken) {
      await refreshCsrfToken();
    }

    if (!csrfToken) return config;

    const nextConfig = { ...config };
    nextConfig.headers = {
      ...(config.headers || {}),
      [CSRF_HEADER_NAME]: csrfToken,
    };
    return nextConfig;
  };

  return withPotentialCsrfRefresh();
});

api.interceptors.response.use(
  (response) => {
    const nextToken = normalizeCsrfToken(response?.headers?.[CSRF_HEADER_NAME]);
    if (nextToken) {
      setCsrfToken(nextToken);
    }
    return response;
  },
  async (error) => {
    const status = Number(error?.response?.status || 0);
    const responseError = String(error?.response?.data?.error || "");
    const originalRequest = error?.config;
    const method = String(originalRequest?.method || "get").toLowerCase();

    const canRetryCsrf =
      status === 403 &&
      /invalid csrf token/i.test(responseError) &&
      originalRequest &&
      !originalRequest.__csrfRetried &&
      MUTATING_METHODS.has(method) &&
      !isPublicMutatingRequest(originalRequest);

    if (!canRetryCsrf) {
      return Promise.reject(error);
    }

    originalRequest.__csrfRetried = true;
    await refreshCsrfToken();

    if (csrfToken) {
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        [CSRF_HEADER_NAME]: csrfToken,
      };
    }

    return api.request(originalRequest);
  }
);

export function authConfig(token) {
  if (!isJwtLike(token)) {
    return {};
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export default api;
