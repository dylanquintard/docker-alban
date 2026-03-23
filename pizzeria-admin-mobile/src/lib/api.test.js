import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    const api = await import("./api");
    api.clearCsrfToken();
  });

  it("sends a basic GET request and returns JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
    global.fetch = fetchMock;

    const { apiRequest } = await import("./api");
    const payload = await apiRequest("/users/me");

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/api/users/me");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("includes CSRF token on mutating requests after token reception", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { ok: true },
          {
            headers: {
              "x-csrf-token": "csrf-123",
            },
          }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ saved: true }));
    global.fetch = fetchMock;

    const { apiRequest } = await import("./api");
    await apiRequest("/users/me");
    const payload = await apiRequest("/orders/1/status", {
      method: "PATCH",
      body: { status: "VALIDATE" },
    });

    expect(payload).toEqual({ saved: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1];
    expect(secondInit.headers["x-csrf-token"]).toBe("csrf-123");
    expect(secondInit.headers["Content-Type"]).toBe("application/json");
  });

  it("retries once after CSRF failure when refresh succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Invalid CSRF token" },
          {
            status: 403,
          }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { csrfToken: "fresh-token" },
          {
            headers: {
              "x-csrf-token": "fresh-token",
            },
          }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    global.fetch = fetchMock;

    const { apiRequest } = await import("./api");
    const payload = await apiRequest("/orders/1/status", {
      method: "PATCH",
      body: { status: "VALIDATE" },
    });

    expect(payload).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1];
    expect(refreshUrl).toBe("https://api.example.com/api/users/csrf-token");
    expect(refreshInit.method).toBe("GET");
  });

  it("throws with response status and payload on non-CSRF errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Forbidden" },
          {
            status: 403,
          }
        )
      );
    global.fetch = fetchMock;

    const { apiRequest } = await import("./api");

    await expect(
      apiRequest("/orders/1/status", {
        method: "PATCH",
        body: { status: "VALIDATE" },
      })
    ).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
      payload: { error: "Forbidden" },
    });
  });

  it("throws a readable error on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Load failed"));
    global.fetch = fetchMock;

    const { apiRequest } = await import("./api");

    await expect(apiRequest("/users/login", { method: "POST", skipCsrf: true })).rejects.toMatchObject({
      message:
        "Connexion API impossible (https://api.example.com/api/users/login). Verifie l'URL API et la configuration CORS.",
    });
  });
});
