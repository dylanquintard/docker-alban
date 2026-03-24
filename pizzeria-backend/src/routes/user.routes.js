const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { createRateLimiter } = require("../middlewares/rate-limit");

function normalizeEmailForKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "no-email";
}

function buildAuthKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const email = normalizeEmailForKey(req.body?.email);
  return `${ip}:${email}`;
}

function buildAuthIpKey(req) {
  return req.ip || req.socket?.remoteAddress || "unknown-ip";
}

const authRegisterRateLimit = createRateLimiter({
  scope: "auth-register",
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyBuilder: buildAuthKey,
});

const authRegisterGlobalRateLimit = createRateLimiter({
  scope: "auth-register-ip",
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  keyBuilder: buildAuthIpKey,
});

const authLoginRateLimit = createRateLimiter({
  scope: "auth-login",
  windowMs: 15 * 60 * 1000,
  maxRequests: 12,
  keyBuilder: buildAuthKey,
});

const authLoginGlobalRateLimit = createRateLimiter({
  scope: "auth-login-ip",
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  keyBuilder: buildAuthIpKey,
});

const authVerifyEmailRateLimit = createRateLimiter({
  scope: "auth-verify-email",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyBuilder: buildAuthKey,
});

const authVerifyEmailGlobalRateLimit = createRateLimiter({
  scope: "auth-verify-email-ip",
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
  keyBuilder: buildAuthIpKey,
});

const authResendRateLimit = createRateLimiter({
  scope: "auth-resend-verification",
  windowMs: 10 * 60 * 1000,
  maxRequests: 10,
  keyBuilder: buildAuthKey,
});

const authResendGlobalRateLimit = createRateLimiter({
  scope: "auth-resend-verification-ip",
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyBuilder: buildAuthIpKey,
});

const authForgotPasswordRateLimit = createRateLimiter({
  scope: "auth-forgot-password",
  windowMs: 15 * 60 * 1000,
  maxRequests: 8,
  keyBuilder: buildAuthKey,
});

const authForgotPasswordGlobalRateLimit = createRateLimiter({
  scope: "auth-forgot-password-ip",
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  keyBuilder: buildAuthIpKey,
});

router.post(
  "/register",
  authRegisterGlobalRateLimit,
  authRegisterRateLimit,
  userController.register
);
router.post(
  "/verify-email",
  authVerifyEmailGlobalRateLimit,
  authVerifyEmailRateLimit,
  userController.verifyEmail
);
router.post(
  "/resend-verification",
  authResendGlobalRateLimit,
  authResendRateLimit,
  userController.resendEmailVerification
);
router.post(
  "/forgot-password",
  authForgotPasswordGlobalRateLimit,
  authForgotPasswordRateLimit,
  userController.forgotPassword
);
router.post(
  "/reset-password",
  authForgotPasswordGlobalRateLimit,
  authForgotPasswordRateLimit,
  userController.resetPassword
);
router.post("/login", authLoginGlobalRateLimit, authLoginRateLimit, userController.login);
router.post("/logout", authMiddleware, userController.logout);

router.get("/me", authMiddleware, userController.me);
router.get("/csrf-token", authMiddleware, userController.csrfToken);
router.put("/me", authMiddleware, userController.updateMe);
router.get("/orders", authMiddleware, userController.getUserOrders);
router.put("/orders/:orderId/review", authMiddleware, userController.upsertOrderReview);

router.get("/", authMiddleware, adminMiddleware, userController.getAllUsers);
router.get("/:id", authMiddleware, adminMiddleware, userController.getUserById);
router.put(
  "/:id/role",
  authMiddleware,
  adminMiddleware,
  userController.adminUpdateUserRole
);
router.delete("/:id", authMiddleware, adminMiddleware, userController.adminDeleteUser);

module.exports = router;
