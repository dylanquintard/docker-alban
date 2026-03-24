const express = require("express");
const router = express.Router();
const realtimeController = require("../controllers/realtime.controller");
const webPushController = require("../controllers/web-push.controller");
const { authMiddleware } = require("../middlewares/auth");

router.get("/stream", authMiddleware, realtimeController.stream);
router.get("/push/public-key", authMiddleware, webPushController.getPublicVapidKey);
router.post("/push/subscriptions", authMiddleware, webPushController.upsertSubscription);
router.delete("/push/subscriptions", authMiddleware, webPushController.deleteSubscription);

module.exports = router;
