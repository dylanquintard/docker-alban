const test = require("node:test");
const assert = require("node:assert/strict");

process.env.RATE_LIMIT_BACKEND = "memory";

const { createRateLimiter } = require("../src/middlewares/rate-limit");

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function runLimiter(limiter, req) {
  const res = createMockResponse();
  let nextCalled = false;

  await limiter(req, res, (error) => {
    if (error) throw error;
    nextCalled = true;
  });

  return {
    nextCalled,
    res,
  };
}

test("rate limiter allows requests under limit", async () => {
  const limiter = createRateLimiter({
    scope: "test-allow",
    windowMs: 10_000,
    maxRequests: 2,
    keyBuilder: () => "user-a",
  });

  const first = await runLimiter(limiter, { ip: "127.0.0.1" });
  const second = await runLimiter(limiter, { ip: "127.0.0.1" });

  assert.equal(first.nextCalled, true);
  assert.equal(first.res.statusCode, 200);
  assert.equal(second.nextCalled, true);
  assert.equal(second.res.statusCode, 200);
});

test("rate limiter blocks requests above limit and sets retry-after", async () => {
  const limiter = createRateLimiter({
    scope: "test-block",
    windowMs: 10_000,
    maxRequests: 1,
    keyBuilder: () => "user-b",
    message: "Too many test requests",
  });

  const first = await runLimiter(limiter, { ip: "127.0.0.1" });
  const second = await runLimiter(limiter, { ip: "127.0.0.1" });

  assert.equal(first.nextCalled, true);
  assert.equal(first.res.statusCode, 200);

  assert.equal(second.nextCalled, false);
  assert.equal(second.res.statusCode, 429);
  assert.equal(second.res.payload?.error, "Too many test requests");
  assert.ok(Number(second.res.headers["retry-after"]) >= 1);
});
