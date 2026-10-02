process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-at-least-32-characters";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/pizzeria?schema=public";
process.env.FRONTEND_SITE_URL =
  process.env.FRONTEND_SITE_URL || "http://127.0.0.1:8000";
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ||
  "http://127.0.0.1:8000,http://localhost:8000,http://localhost:4173,http://localhost:14174";
process.env.UPLOAD_PUBLIC_BASE_URL =
  process.env.UPLOAD_PUBLIC_BASE_URL || "http://127.0.0.1:5000";
