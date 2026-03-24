import { buildApiUrl } from "../../config";

const CSRF_HEADER_NAME = "x-csrf-token";
let csrfToken = "";

function setCsrfToken(nextToken) {
  csrfToken = String(nextToken || "").trim();
}

async function parseResponse(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function refreshCsrfToken() {
  const response = await fetch(buildApiUrl("/users/csrf-token"), {
    method: "GET",
    credentials: "include",
  });

  const nextToken = response.headers.get(CSRF_HEADER_NAME);
  if (nextToken) {
    setCsrfToken(nextToken);
  }

  return response.ok;
}

export async function apiRequest(pathname, options = {}) {
  const {
    method = "GET",
    body,
    skipCsrf = false,
    retryOnCsrf = true,
    headers = {},
  } = options;

  const upperMethod = String(method).toUpperCase();
  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (!skipCsrf && ["POST", "PUT", "PATCH", "DELETE"].includes(upperMethod) && csrfToken) {
    finalHeaders[CSRF_HEADER_NAME] = csrfToken;
  }

  const requestUrl = buildApiUrl(pathname);
  let response;

  try {
    response = await fetch(requestUrl, {
      method: upperMethod,
      credentials: "include",
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const networkError = new Error(
      `Connexion API impossible (${requestUrl}). Verifie l'URL API et la configuration CORS.`
    );
    networkError.cause = error;
    throw networkError;
  }

  const nextToken = response.headers.get(CSRF_HEADER_NAME);
  if (nextToken) {
    setCsrfToken(nextToken);
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    const errorMessage =
      (payload && typeof payload === "object" && payload.error) ||
      (typeof payload === "string" && payload) ||
      `HTTP ${response.status}`;

    const canRetry =
      retryOnCsrf &&
      !skipCsrf &&
      response.status === 403 &&
      /invalid csrf token/i.test(String(errorMessage || ""));

    if (canRetry) {
      const refreshed = await refreshCsrfToken();
      if (refreshed) {
        return apiRequest(pathname, {
          ...options,
          retryOnCsrf: false,
        });
      }
    }

    const error = new Error(String(errorMessage || "Unexpected error"));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function clearCsrfToken() {
  csrfToken = "";
}
