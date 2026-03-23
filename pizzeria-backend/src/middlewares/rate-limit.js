const { createClient } = require("redis");

const buckets = new Map();
let redisClient = null;
let redisInitPromise = null;
let redisInitializationFailed = false;
let redisWarningPrinted = false;

function normalizeBackend(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "auto";
  if (["auto", "memory", "redis"].includes(normalized)) return normalized;
  return "auto";
}

function shouldUseRedis() {
  const backend = normalizeBackend(process.env.RATE_LIMIT_BACKEND);
  if (backend === "memory") return false;
  const redisUrl = String(process.env.REDIS_URL || "").trim();
  if (!redisUrl) return false;
  if (backend === "redis") return true;
  return process.env.NODE_ENV === "production" || backend === "auto";
}

function printRedisWarning(message, error) {
  if (redisWarningPrinted) return;
  redisWarningPrinted = true;
  const details = error?.message ? ` (${error.message})` : "";
  console.error(`[rate-limit] ${message}${details}`);
}

async function getRedisClient() {
  if (!shouldUseRedis()) return null;
  if (redisClient?.isOpen) return redisClient;
  if (redisInitializationFailed) return null;
  if (redisInitPromise) return redisInitPromise;

  const redisUrl = String(process.env.REDIS_URL || "").trim();
  redisInitPromise = (async () => {
    try {
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 3000,
        },
      });

      client.on("error", (err) => {
        printRedisWarning("Redis client error, falling back to in-memory limiter.", err);
      });

      await client.connect();
      redisClient = client;
      return redisClient;
    } catch (error) {
      redisInitializationFailed = true;
      printRedisWarning("Unable to connect to Redis, falling back to in-memory limiter.", error);
      return null;
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}

async function incrementRedisKey(key, windowMs) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const result = await client.eval(
      `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("PTTL", KEYS[1])
      return { current, ttl }
      `,
      {
        keys: [key],
        arguments: [String(windowMs)],
      }
    );

    const currentCount = Number(Array.isArray(result) ? result[0] : 0);
    const ttlMsRaw = Number(Array.isArray(result) ? result[1] : 0);
    const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? ttlMsRaw : windowMs;
    return {
      count: Number.isFinite(currentCount) && currentCount > 0 ? currentCount : 1,
      ttlMs,
    };
  } catch (error) {
    printRedisWarning("Redis limiter command failed, falling back to in-memory limiter.", error);
    return null;
  }
}

function cleanupExpiredEntries(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.expiresAt <= now) {
      buckets.delete(key);
    }
  }
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function buildLimiterKey(req, scope) {
  const ip = getClientIp(req);
  return `${scope}:${ip}`;
}

function incrementMemoryKey(key, windowMs) {
  const now = Date.now();
  cleanupExpiredEntries(now);
  const record = buckets.get(key);

  if (!record || record.expiresAt <= now) {
    const expiresAt = now + windowMs;
    buckets.set(key, {
      count: 1,
      expiresAt,
    });
    return {
      count: 1,
      ttlMs: windowMs,
    };
  }

  record.count += 1;
  buckets.set(key, record);
  return {
    count: record.count,
    ttlMs: Math.max(record.expiresAt - now, 1),
  };
}

function createRateLimiter({
  scope,
  windowMs,
  maxRequests,
  keyBuilder,
  message = "Too many requests. Please try again later.",
} = {}) {
  if (!scope) {
    throw new Error("Rate limiter scope is required");
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("Rate limiter windowMs must be a positive integer");
  }
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) {
    throw new Error("Rate limiter maxRequests must be a positive integer");
  }
  if (keyBuilder !== undefined && typeof keyBuilder !== "function") {
    throw new Error("Rate limiter keyBuilder must be a function when provided");
  }

  return async (req, res, next) => {
    const key =
      typeof keyBuilder === "function"
        ? `${scope}:${String(keyBuilder(req) || "unknown")}`
        : buildLimiterKey(req, scope);

    try {
      const distributed = await incrementRedisKey(key, windowMs);
      const state = distributed || incrementMemoryKey(key, windowMs);

      if (state.count > maxRequests) {
        const retryAfterSeconds = Math.ceil(state.ttlMs / 1000);
        res.setHeader("Retry-After", String(Math.max(retryAfterSeconds, 1)));
        return res.status(429).json({ error: message });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createRateLimiter,
};
