const test = require("node:test");
const assert = require("node:assert/strict");

const { __testing } = require("../src/services/user.service");

test("getPasswordResetBaseUrl uses explicit URL when provided", () => {
  const result = __testing.getPasswordResetBaseUrl({
    passwordResetUrlBase: "https://reset.example.com/custom-reset/",
    frontendSiteUrl: "https://frontend.example.com",
    corsOrigins: ["https://cors.example.com"],
  });

  assert.equal(result, "https://reset.example.com/custom-reset");
});

test("getPasswordResetBaseUrl prefers FRONTEND_SITE_URL over CORS origins", () => {
  const result = __testing.getPasswordResetBaseUrl({
    frontendSiteUrl: "https://frontend.example.com/",
    corsOrigins: ["https://cors.example.com"],
  });

  assert.equal(result, "https://frontend.example.com/reset-password");
});

test("getPasswordResetBaseUrl falls back to first CORS origin when needed", () => {
  const result = __testing.getPasswordResetBaseUrl({
    frontendSiteUrl: "",
    corsOrigins: ["https://cors.example.com/"],
  });

  assert.equal(result, "https://cors.example.com/reset-password");
});

test("getPasswordResetBaseUrl ignores env base when explicit options are provided", () => {
  const previousValue = process.env.PASSWORD_RESET_URL_BASE;
  process.env.PASSWORD_RESET_URL_BASE = "https://www.eazytoolz.site/reset-password";

  try {
    const result = __testing.getPasswordResetBaseUrl({
      frontendSiteUrl: "https://frontend.example.com/",
      corsOrigins: ["https://cors.example.com/"],
    });

    assert.equal(result, "https://frontend.example.com/reset-password");
  } finally {
    if (previousValue === undefined) {
      delete process.env.PASSWORD_RESET_URL_BASE;
    } else {
      process.env.PASSWORD_RESET_URL_BASE = previousValue;
    }
  }
});

test("computeAdminFailureUpdate locks admin after configured threshold", () => {
  const result = __testing.computeAdminFailureUpdate(
    { failedLoginAttempts: 4 },
    new Date("2026-03-24T10:00:00.000Z")
  );

  assert.equal(result.failedLoginAttempts, 0);
  assert.ok(result.lockedUntil instanceof Date);
  assert.equal(result.lockedUntil.toISOString(), "2026-03-24T10:15:00.000Z");
});

test("isAdminLockActive only returns true while lock is still in the future", () => {
  const now = new Date("2026-03-24T10:00:00.000Z");

  assert.equal(
    __testing.isAdminLockActive(
      { role: "ADMIN", lockedUntil: "2026-03-24T10:05:00.000Z" },
      now
    ),
    true
  );
  assert.equal(
    __testing.isAdminLockActive(
      { role: "ADMIN", lockedUntil: "2026-03-24T09:59:59.000Z" },
      now
    ),
    false
  );
});
