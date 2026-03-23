/* eslint-disable no-console */
const http = require("node:http");
const { app } = require("../server");

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/healthz`);
    if (healthResponse.status !== 200) {
      throw new Error(`/healthz returned ${healthResponse.status}`);
    }

    const healthPayload = await healthResponse.json();
    if (!healthPayload?.ok) {
      throw new Error("/healthz payload is not ok");
    }

    const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
    if (robotsResponse.status !== 200) {
      throw new Error(`/robots.txt returned ${robotsResponse.status}`);
    }

    const robotsText = await robotsResponse.text();
    if (!/Sitemap:\s+/i.test(robotsText)) {
      throw new Error("/robots.txt does not expose a sitemap entry");
    }

    console.log("Smoke health checks passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error("Smoke health checks failed:", error?.message || error);
  process.exit(1);
});
