const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const baseEnv = {
  API_BASE_URL: "http://127.0.0.1:5000",
  AGENT_CODE: "agent-test",
  AGENT_NAME: "Agent Test",
  AGENT_TOKEN: "agent-token-test",
  PRINTER_CODE: "kitchen_main",
  PRINTER_IP: "127.0.0.1",
  PRINTER_PORT: "9100",
  SQLITE_PATH: "./data/test-agent.db",
};

function runConfigWithEnv(extraEnv = {}) {
  const mergedEnv = { ...process.env, ...baseEnv, ...extraEnv };
  return spawnSync(process.execPath, ["-e", "require('./src/config')"], {
    cwd: projectRoot,
    env: mergedEnv,
    encoding: "utf8",
  });
}

test("config rejects missing LOCAL_ADMIN_TOKEN in production", () => {
  const result = runConfigWithEnv({
    NODE_ENV: "production",
    LOCAL_ADMIN_TOKEN: "",
  });

  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stderr}\n${result.stdout}`,
    /LOCAL_ADMIN_TOKEN is required when NODE_ENV=production/i
  );
});

test("config accepts LOCAL_ADMIN_TOKEN in production", () => {
  const result = runConfigWithEnv({
    NODE_ENV: "production",
    LOCAL_ADMIN_TOKEN: "strong-local-token",
  });

  assert.equal(result.status, 0);
});
