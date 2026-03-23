const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { app, resetServerCachesForTests } = require("../server");

async function withServer(run) {
  resetServerCachesForTests();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function requestServer(baseUrl, pathname, options = {}) {
  const targetUrl = new URL(pathname, baseUrl);
  const method = options.method || "GET";
  const headers = options.headers || {};

  return new Promise((resolve, reject) => {
    const request = http.request(
      targetUrl,
      {
        method,
        headers,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: Number(response.statusCode || 0),
            headers: response.headers,
            body,
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

async function withTemporaryEnv(overrides, run) {
  const previousValues = Object.entries(overrides).map(([key]) => ({
    key,
    existed: Object.prototype.hasOwnProperty.call(process.env, key),
    value: process.env[key],
  }));

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === undefined || value === "") {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  try {
    await run();
  } finally {
    for (const entry of previousValues) {
      if (entry.existed) {
        process.env[entry.key] = entry.value;
      } else {
        delete process.env[entry.key];
      }
    }
  }
}

function createMockResponse({ status = 200, text = "", json = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return text;
    },
    async json() {
      return json;
    },
  };
}

async function withMockedBackendFetch(run) {
  const originalFetch = global.fetch;
  let fetchCount = 0;

  global.fetch = async (url) => {
    fetchCount += 1;
    const target = String(url || "");

    if (target.endsWith("/sitemap.xml")) {
      return createMockResponse({
        text: '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      });
    }

    if (target.endsWith("/seo/locations")) {
      return createMockResponse({
        json: {
          locations: [{ slug: "yutz", label: "Yutz", locationId: 99 }],
        },
      });
    }

    if (target.endsWith("/seo/blog-articles")) {
      return createMockResponse({ json: { articles: [] } });
    }

    if (target.endsWith("/site-settings/public")) {
      return createMockResponse({ json: {} });
    }

    if (target.includes("/locations?active=true")) {
      return createMockResponse({ json: [] });
    }

    if (target.endsWith("/timeslots/public-weekly-settings")) {
      return createMockResponse({ json: [] });
    }

    return createMockResponse({ json: {} });
  };

  try {
    await run(() => fetchCount);
  } finally {
    global.fetch = originalFetch;
  }
}

test("health endpoint stays available", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.ok, true);
  });
});

test("front server sends baseline security headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(
      response.headers.get("permissions-policy"),
      "geolocation=(), microphone=(), camera=()"
    );
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
  });
});

test("sitemap endpoint stays available with local fallback", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(response.status, 200);
    assert.match(String(response.headers.get("content-type") || ""), /application\/xml/i);
    const xml = await response.text();
    assert.match(xml, /<urlset/i);
    assert.match(xml, /<loc>.*<\/loc>/i);
  });
});

test("robots endpoint points to configured backend or canonical sitemap source", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(response.status, 200);
    assert.match(String(response.headers.get("content-type") || ""), /text\/plain/i);
    const content = await response.text();
    const sitemapMatch = content.match(/Sitemap:\s+([^\r\n]+)/i);
    assert.ok(sitemapMatch?.[1], "robots.txt must contain a Sitemap entry");
    assert.match(
      String(sitemapMatch[1]).trim(),
      /^(https?:\/\/.+\/sitemap\.xml|\/sitemap\.xml)$/i
    );
  });
});

test("host header injection does not poison canonical or robots metadata", async () => {
  await withTemporaryEnv(
    {
      CANONICAL_SITE_URL: null,
      VITE_SITE_URL: null,
      REACT_APP_SITE_URL: null,
      SEO_BACKEND_API_URL: null,
      VITE_API_BASE_URL: null,
      REACT_APP_API_BASE_URL: null,
      SEO_ROBOTS_SITEMAP_URL: null,
    },
    async () => {
      await withServer(async (baseUrl) => {
        const hostileHeaders = {
          host: "127.0.0.1:65535",
          "x-forwarded-host": "evil.test",
          "x-forwarded-proto": "https",
        };

        const robotsResponse = await requestServer(baseUrl, "/robots.txt", {
          headers: hostileHeaders,
        });
        assert.equal(robotsResponse.status, 200);
        assert.doesNotMatch(robotsResponse.body, /evil\.test/i);
        assert.match(robotsResponse.body, /Sitemap:\s+http:\/\/127\.0\.0\.1:65535\/sitemap\.xml/i);

        const homeResponse = await requestServer(baseUrl, "/", {
          headers: hostileHeaders,
        });
        assert.equal(homeResponse.status, 200);
        assert.doesNotMatch(homeResponse.body, /evil\.test/i);
        assert.match(
          homeResponse.body,
          /<link rel="canonical" href="http:\/\/127\.0\.0\.1:65535\/"\s*\/>/i
        );
        assert.match(
          homeResponse.body,
          /<meta property="og:url" content="http:\/\/127\.0\.0\.1:65535\/"\s*\/>/i
        );
      });
    }
  );
});

test("sitemap endpoint reuses cached sitemap data between immediate requests", async () => {
  await withTemporaryEnv(
    {
      SEO_BACKEND_API_URL: "https://backend.example/api",
      CANONICAL_SITE_URL: "https://www.example.com",
    },
    async () => {
      await withMockedBackendFetch(async (getFetchCount) => {
        await withServer(async (baseUrl) => {
          const firstResponse = await requestServer(baseUrl, "/sitemap.xml");
          assert.equal(firstResponse.status, 200);
          const fetchesAfterFirstRequest = getFetchCount();
          assert.equal(fetchesAfterFirstRequest, 5);

          const secondResponse = await requestServer(baseUrl, "/sitemap.xml");
          assert.equal(secondResponse.status, 200);
          assert.equal(getFetchCount(), fetchesAfterFirstRequest);
        });
      });
    }
  );
});

test("dynamic SEO misses do not trigger an immediate forced refresh after a recent cache load", async () => {
  await withTemporaryEnv(
    {
      SEO_BACKEND_API_URL: "https://backend.example/api",
      CANONICAL_SITE_URL: "https://www.example.com",
    },
    async () => {
      await withMockedBackendFetch(async (getFetchCount) => {
        await withServer(async (baseUrl) => {
          const firstResponse = await requestServer(baseUrl, "/random-probe");
          assert.equal(firstResponse.status, 404);
          const fetchesAfterFirstRequest = getFetchCount();
          assert.equal(fetchesAfterFirstRequest, 3);

          const secondResponse = await requestServer(baseUrl, "/random-probe");
          assert.equal(secondResponse.status, 404);
          assert.equal(getFetchCount(), fetchesAfterFirstRequest);
        });
      });
    }
  );
});
