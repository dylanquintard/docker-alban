require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const prisma = require("./lib/prisma");
const {
  NODE_ENV,
  CORS_ORIGINS,
  PORT,
  TRUST_PROXY,
  ENABLE_HSTS,
  HSTS_MAX_AGE,
  UPLOAD_DIR,
  GOOGLE_SITE_VERIFICATION_FILE,
  GOOGLE_SITE_VERIFICATION_CONTENT,
} = require("./lib/env");
const { normalizeOrigin, isDevLocalOrigin } = require("./lib/origin");
const { createOriginGuard } = require("./middlewares/csrf");

const app = express();
app.disable("x-powered-by");
if (TRUST_PROXY) app.set("trust proxy", 1);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (CORS_ORIGINS.includes(normalized)) return true;
  if (NODE_ENV !== "production" && isDevLocalOrigin(normalized)) return true;
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  exposedHeaders: ["X-CSRF-Token"],
};

app.use(express.json());
app.use(cors(corsOptions));
app.use(
  createOriginGuard({
    normalizeOrigin,
    isAllowedOrigin,
  })
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.secure || String(forwardedProto || "").toLowerCase() === "https";
  if (ENABLE_HSTS && isHttps) {
    res.setHeader("Strict-Transport-Security", `max-age=${HSTS_MAX_AGE}; includeSubDomains`);
  }
  next();
});

app.get("/uploads/gallery/thumbs/sm/:fileName", async (req, res) => {
  const requestedFileName = String(req.params?.fileName || "").trim();
  const safeFileName = path.basename(requestedFileName);
  if (!safeFileName || safeFileName !== requestedFileName) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }

  const galleryDir = path.join(UPLOAD_DIR, "gallery");
  const thumbDir = path.join(galleryDir, "thumbs");
  const targetDir = path.join(thumbDir, "sm");
  const targetPath = path.join(targetDir, safeFileName);
  const sourceThumbPath = path.join(thumbDir, safeFileName);
  const sourceMainPath = path.join(galleryDir, safeFileName);

  const exists = async (filePath) => {
    try {
      await fs.access(filePath);
      return true;
    } catch (_err) {
      return false;
    }
  };

  try {
    const targetExists = await exists(targetPath);
    if (!targetExists) {
      const sourcePath = (await exists(sourceThumbPath)) ? sourceThumbPath : sourceMainPath;
      if (!(await exists(sourcePath))) {
        res.status(404).json({ error: "Image not found" });
        return;
      }

      await fs.mkdir(targetDir, { recursive: true });
      await sharp(sourcePath)
        .resize({
          width: 192,
          height: 192,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFile(targetPath);
    }

    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.sendFile(targetPath);
  } catch (_err) {
    res.status(500).json({ error: "Unable to generate small thumbnail" });
  }
});

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const timeSlotRoutes = require("./routes/timeslot.routes");
const userRoutes = require("./routes/user.routes");
const categoryRoutes = require("./routes/category.routes");
const locationRoutes = require("./routes/location.routes");
const galleryRoutes = require("./routes/gallery.routes");
const blogRoutes = require("./routes/blog.routes");
const faqRoutes = require("./routes/faq.routes");
const reviewRoutes = require("./routes/review.routes");
const siteSettingsRoutes = require("./routes/site-settings.routes");
const contactRoutes = require("./routes/contact.routes");
const realtimeRoutes = require("./routes/realtime.routes");
const printRoutes = require("./routes/print.routes");
const seoRoutes = require("./routes/seo.routes");
const seoController = require("./controllers/seo.controller");

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/timeslots", timeSlotRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/site-settings", siteSettingsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/print", printRoutes);
app.use("/api/seo", seoRoutes);
app.get("/sitemap.xml", seoController.getSitemapXml);
if (GOOGLE_SITE_VERIFICATION_FILE && GOOGLE_SITE_VERIFICATION_CONTENT) {
  app.get(`/${GOOGLE_SITE_VERIFICATION_FILE}`, (_req, res) => {
    res.type("text/plain; charset=utf-8").send(GOOGLE_SITE_VERIFICATION_CONTENT);
  });
}

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "ok",
  });
});

app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      ok: true,
      status: "ready",
      checks: {
        db: "up",
      },
    });
  } catch (_err) {
    res.status(503).json({
      ok: false,
      status: "not_ready",
      checks: {
        db: "down",
      },
      error: "database_unreachable",
    });
  }
});

app.get("/", (_req, res) => {
  res.send("API Pizzeria running");
});

let server = null;
let shuttingDown = false;

function startServer() {
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  return server;
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  const timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);
  console.log(`[shutdown] Received ${signal}, stopping backend gracefully...`);

  if (!server) {
    process.exit(0);
    return;
  }

  const forceTimer = setTimeout(() => {
    console.error(`[shutdown] Forced exit after ${timeoutMs}ms`);
    process.exit(1);
  }, timeoutMs);
  if (typeof forceTimer.unref === "function") {
    forceTimer.unref();
  }

  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      console.error("[shutdown] Error while closing server:", error);
      process.exit(1);
      return;
    }
    process.exit(0);
  });
}

if (require.main === module) {
  startServer();

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
}

module.exports = {
  app,
  startServer,
  shutdown,
};
