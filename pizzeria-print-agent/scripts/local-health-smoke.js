/* eslint-disable no-console */
const { createHealthServer } = require("../src/health-server");

async function waitForAddress(healthServer, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const address = healthServer.address();
    if (address && typeof address.port === "number" && address.port > 0) {
      return address;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Unable to resolve health server address");
}

async function main() {
  const config = {
    nodeEnv: "test",
    localHttpHost: "127.0.0.1",
    localHttpPort: 0,
    localAdminToken: "smoke-local-token",
  };

  const agent = {
    getHealth() {
      return { ok: true, service: "print-agent" };
    },
    async runTestPrint() {
      return true;
    },
    async reprintLastTicket() {
      return true;
    },
  };

  const logger = {
    info() {},
    warn() {},
    error() {},
  };

  const healthServer = createHealthServer({ config, agent, logger });
  const address = await waitForAddress(healthServer);
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.status !== 200) {
      throw new Error(`/health returned ${healthResponse.status}`);
    }

    const unauthorizedResponse = await fetch(`${baseUrl}/test-print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Smoke test" }),
    });
    if (unauthorizedResponse.status !== 401) {
      throw new Error(`/test-print without token returned ${unauthorizedResponse.status}`);
    }

    const authorizedResponse = await fetch(`${baseUrl}/test-print`, {
      method: "POST",
      headers: {
        "x-local-token": config.localAdminToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Smoke test" }),
    });
    if (authorizedResponse.status !== 200) {
      throw new Error(`/test-print with token returned ${authorizedResponse.status}`);
    }

    console.log("Smoke health checks passed.");
  } finally {
    healthServer.close();
  }
}

main().catch((error) => {
  console.error("Smoke health checks failed:", error?.message || error);
  process.exit(1);
});
