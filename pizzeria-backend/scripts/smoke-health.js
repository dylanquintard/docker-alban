/* eslint-disable no-console */
const http = require("node:http");

process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "smoke-health-jwt-secret-with-at-least-32-characters";
process.env.PRINT_SCHEDULER_ENABLED = process.env.PRINT_SCHEDULER_ENABLED || "false";

const { app } = require("../src/server");

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

    const readyResponse = await fetch(`${baseUrl}/readyz`);
    if (![200, 503].includes(readyResponse.status)) {
      throw new Error(`/readyz returned unexpected status ${readyResponse.status}`);
    }

    const readyPayload = await readyResponse.json();
    if (typeof readyPayload?.ok !== "boolean") {
      throw new Error("/readyz payload missing boolean ok field");
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
