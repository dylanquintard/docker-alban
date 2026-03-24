const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { app } = require("../src/server");

async function withServer(run) {
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

test("server exposes /healthz endpoint", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.status, "ok");
  });
});

test("server exposes /readyz endpoint", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/readyz`);
    assert.ok([200, 503].includes(response.status));
    const payload = await response.json();
    assert.equal(typeof payload.ok, "boolean");
    assert.equal(typeof payload.status, "string");
    assert.equal(typeof payload.checks, "object");
    assert.equal(typeof payload.checks.db, "string");
  });
});

test("server sets baseline security headers", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(
      response.headers.get("permissions-policy"),
      "geolocation=(), microphone=(), camera=()"
    );
    assert.match(
      response.headers.get("content-security-policy") || "",
      /default-src 'none'/
    );
  });
});
