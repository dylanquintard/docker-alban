import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfigModule() {
  vi.resetModules();
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete global.window;
  vi.resetModules();
});

describe("mobile config", () => {
  it("uses local API fallback when no env is provided in non-production mode", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_REALTIME_STREAM_URL", "");

    const config = await loadConfigModule();
    expect(config.API_BASE_URL).toBe("http://localhost:5000/api");
    expect(config.REALTIME_STREAM_URL).toBe("http://localhost:5000/api/realtime/stream");
  });

  it("uses explicit API and stream URLs when provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/");
    vi.stubEnv("VITE_REALTIME_STREAM_URL", "https://stream.example.com/realtime/");

    const config = await loadConfigModule();
    expect(config.API_BASE_URL).toBe("https://api.example.com/api");
    expect(config.REALTIME_STREAM_URL).toBe("https://stream.example.com/realtime");
  });

  it("builds API URL from configured base", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api");
    vi.stubEnv("VITE_REALTIME_STREAM_URL", "");

    const config = await loadConfigModule();
    expect(config.buildApiUrl("orders")).toBe("https://api.example.com/api/orders");
    expect(config.buildApiUrl("/orders")).toBe("https://api.example.com/api/orders");
  });

  it("uses current hostname in non-production mode to support LAN mobile testing", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_REALTIME_STREAM_URL", "");
    global.window = {
      location: {
        protocol: "http:",
        hostname: "192.168.1.24",
      },
    };

    const config = await loadConfigModule();
    expect(config.API_BASE_URL).toBe("http://192.168.1.24:5000/api");
    expect(config.REALTIME_STREAM_URL).toBe("http://192.168.1.24:5000/api/realtime/stream");
  });

  it("falls back to same-origin /api on non-local domains when no env is provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_REALTIME_STREAM_URL", "");
    global.window = {
      location: {
        origin: "https://admin.example.com",
        protocol: "https:",
        hostname: "admin.example.com",
      },
    };

    const config = await loadConfigModule();
    expect(config.API_BASE_URL).toBe("https://admin.example.com/api");
    expect(config.REALTIME_STREAM_URL).toBe("https://admin.example.com/api/realtime/stream");
  });
});
