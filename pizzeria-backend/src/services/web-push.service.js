const webPush = require("web-push");
const { PrintLogLevel, OrderStatus } = require("@prisma/client");
const prisma = require("../lib/prisma");
const {
  WEB_PUSH_SUBJECT,
  WEB_PUSH_VAPID_PRIVATE_KEY,
  WEB_PUSH_VAPID_PUBLIC_KEY,
} = require("../lib/env");

const ORDER_PREP_WINDOW_MS = 30 * 60 * 1000;
const ORDER_PREP_SWEEP_INTERVAL_MS = 60 * 1000;
const ORDER_PREP_ACTIVITY_ACTION = "ORDER_PREP_PUSH_SENT";
const FAILED_TICKET_PUSH_LOG_EVENT = "push_ticket_failed_sent";
const FAILED_TICKET_PUSH_BATCH_EVENT = "push_ticket_failed_batch_sent";

let vapidConfigured = false;
let lastOrderPrepSweepAtMs = 0;

function isWebPushEnabled() {
  return Boolean(
    WEB_PUSH_VAPID_PUBLIC_KEY &&
      WEB_PUSH_VAPID_PRIVATE_KEY &&
      WEB_PUSH_SUBJECT
  );
}

function ensureWebPushConfigured() {
  if (!isWebPushEnabled()) {
    throw new Error("Web push is not configured");
  }

  if (vapidConfigured) return;

  webPush.setVapidDetails(
    WEB_PUSH_SUBJECT,
    WEB_PUSH_VAPID_PUBLIC_KEY,
    WEB_PUSH_VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

function getPublicVapidKey() {
  return WEB_PUSH_VAPID_PUBLIC_KEY || "";
}

function normalizeSubscription(subscription) {
  const endpoint = String(subscription?.endpoint || "").trim();
  const p256dh = String(subscription?.keys?.p256dh || "").trim();
  const auth = String(subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid push subscription payload");
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

async function upsertWebPushSubscription({ userId, role, subscription, userAgent }) {
  ensureWebPushConfigured();

  if (String(role || "").toUpperCase() !== "ADMIN") {
    throw new Error("Admin access only");
  }

  const normalized = normalizeSubscription(subscription);

  return prisma.webPushSubscription.upsert({
    where: { endpoint: normalized.endpoint },
    create: {
      userId: Number(userId),
      endpoint: normalized.endpoint,
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      userAgent: String(userAgent || "").trim() || null,
      active: true,
    },
    update: {
      userId: Number(userId),
      p256dh: normalized.keys.p256dh,
      auth: normalized.keys.auth,
      userAgent: String(userAgent || "").trim() || null,
      active: true,
    },
    select: {
      id: true,
      endpoint: true,
      active: true,
      updatedAt: true,
    },
  });
}

async function deleteWebPushSubscription({ userId, endpoint }) {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) {
    throw new Error("Endpoint is required");
  }

  await prisma.webPushSubscription.deleteMany({
    where: {
      userId: Number(userId),
      endpoint: normalizedEndpoint,
    },
  });

  return { success: true };
}

async function markInactive(endpoint) {
  await prisma.webPushSubscription.updateMany({
    where: { endpoint },
    data: { active: false },
  });
}

async function markNotified(endpoint) {
  await prisma.webPushSubscription.updateMany({
    where: { endpoint },
    data: { lastNotifiedAt: new Date(), active: true },
  });
}

async function getAdminSubscriptions() {
  return prisma.webPushSubscription.findMany({
    where: {
      active: true,
      user: {
        role: "ADMIN",
      },
    },
    select: {
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });
}

async function sendAdminPushNotification(notification, options = {}) {
  if (!isWebPushEnabled()) {
    return { delivered: 0, skipped: true, reason: "WEB_PUSH_DISABLED" };
  }

  ensureWebPushConfigured();

  const subscriptions = await getAdminSubscriptions();
  if (subscriptions.length === 0) {
    return { delivered: 0, skipped: true, reason: "NO_ACTIVE_SUBSCRIPTIONS" };
  }

  const payload = JSON.stringify(notification);
  const ttl = Number(options.ttl || 300);
  let delivered = 0;

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
        { TTL: ttl }
      );
      delivered += 1;
      await markNotified(subscription.endpoint);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if ([404, 410].includes(statusCode)) {
        await markInactive(subscription.endpoint);
      }
      console.error("[web-push] sendAdminPushNotification error:", error?.message || error);
    }
  }

  return { delivered, skipped: false };
}

function buildOrderPrepPushPayload(order) {
  const pickupAt = new Date(order?.timeSlot?.startTime || "");
  const pickupLabel = Number.isNaN(pickupAt.getTime())
    ? "--:--"
    : pickupAt.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });

  return {
    title: `Commande #${order?.id ?? "?"} - A PREPARER`,
    body: `Heure de retrait : ${pickupLabel}`,
    tag: `order-prep-${order?.id ?? "unknown"}`,
    url: order?.id
      ? `/?app=clickCollect&section=orders&orderId=${order.id}`
      : "/?app=clickCollect&section=orders",
  };
}

function formatPickupTimeLabel(dateValue) {
  const pickupAt = new Date(dateValue || "");
  if (Number.isNaN(pickupAt.getTime())) return "--:--";
  return pickupAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildGroupedOrderPrepPushPayload(orders) {
  const normalizedOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (normalizedOrders.length === 0) return null;
  if (normalizedOrders.length === 1) {
    return buildOrderPrepPushPayload(normalizedOrders[0]);
  }

  const pickupLabel = formatPickupTimeLabel(normalizedOrders[0]?.timeSlot?.startTime);

  return {
    title: `${normalizedOrders.length} commandes a preparer pour ${pickupLabel}`,
    body: "Ouvrez Click&Collect pour traiter la file.",
    tag: `order-prep-batch-${pickupLabel.replace(/[^0-9]/g, "") || "unknown"}`,
    url: "/?app=clickCollect&section=orders",
  };
}

function buildTicketFailurePushPayload(job) {
  return {
    title: `IMPRESSION TICKET ECHEC #${job?.orderId ?? "?"}`,
    body: String(job?.lastErrorMessage || "").trim() || "Ticket en erreur",
    tag: `ticket-failed-${job?.id ?? "unknown"}`,
    url: job?.orderId
      ? `/?app=clickCollect&section=tickets&orderId=${job.orderId}`
      : "/?app=clickCollect&section=tickets",
  };
}

function buildGroupedTicketFailurePushPayload(jobs) {
  const normalizedJobs = Array.isArray(jobs) ? jobs.filter(Boolean) : [];
  if (normalizedJobs.length === 0) return null;
  if (normalizedJobs.length === 1) {
    return buildTicketFailurePushPayload(normalizedJobs[0]);
  }

  const uniqueOrderIds = [...new Set(normalizedJobs.map((job) => Number(job.orderId || 0)).filter(Boolean))];

  return {
    title: `${normalizedJobs.length} echecs impressions a verifier`,
    body:
      uniqueOrderIds.length > 0
        ? `${uniqueOrderIds.length} commandes concernees.`
        : "Ouvrez les tickets pour verifier les erreurs.",
    tag: "ticket-failed-batch",
    url: "/?app=clickCollect&section=tickets",
  };
}

async function sendTicketFailurePushesByJobIds(jobIds = []) {
  const normalizedIds = [...new Set((Array.isArray(jobIds) ? jobIds : []).filter(Boolean))];
  if (normalizedIds.length === 0) {
    return { delivered: 0, sent: 0, skipped: true, reason: "NO_JOBS" };
  }

  const jobs = await prisma.printJob.findMany({
    where: {
      id: { in: normalizedIds },
      status: "FAILED",
      logs: {
        none: {
          event: FAILED_TICKET_PUSH_LOG_EVENT,
        },
      },
    },
    select: {
      id: true,
      orderId: true,
      lastErrorMessage: true,
    },
  });

  if (jobs.length === 0) {
    return { delivered: 0, sent: 0, skipped: true, reason: "NO_MATCHING_FAILED_JOBS" };
  }

  const payload =
    jobs.length > 1
      ? buildGroupedTicketFailurePushPayload(jobs)
      : buildTicketFailurePushPayload(jobs[0]);
  const result = await sendAdminPushNotification(payload, { ttl: 600 });

  if (result.delivered > 0) {
    for (const job of jobs) {
      await prisma.printLog.create({
        data: {
          jobId: job.id,
          level: PrintLogLevel.INFO,
          event: jobs.length > 1 ? FAILED_TICKET_PUSH_BATCH_EVENT : FAILED_TICKET_PUSH_LOG_EVENT,
          payload: {
            delivered: result.delivered,
            orderId: job.orderId,
            grouped: jobs.length > 1,
            batchSize: jobs.length,
          },
        },
      });
    }
  }

  return {
    delivered: result.delivered,
    sent: result.delivered > 0 ? 1 : 0,
    skipped: false,
    grouped: jobs.length > 1,
    count: jobs.length,
  };
}

async function sendOrderPrepPushesForDueOrders(options = {}) {
  if (!isWebPushEnabled()) {
    return { delivered: 0, sent: 0, skipped: true, reason: "WEB_PUSH_DISABLED" };
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const nowMs = now.getTime();
  const force = Boolean(options.force);

  if (
    !force &&
    lastOrderPrepSweepAtMs > 0 &&
    nowMs - lastOrderPrepSweepAtMs < ORDER_PREP_SWEEP_INTERVAL_MS
  ) {
    return { delivered: 0, sent: 0, skipped: true, reason: "SWEEP_COOLDOWN" };
  }

  lastOrderPrepSweepAtMs = nowMs;

  const maxPickupAt = new Date(nowMs + ORDER_PREP_WINDOW_MS);
  const dueOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.COMPLETED,
      timeSlot: {
        startTime: {
          gt: now,
          lte: maxPickupAt,
        },
      },
      activities: {
        none: {
          action: ORDER_PREP_ACTIVITY_ACTION,
        },
      },
    },
    select: {
      id: true,
      timeSlot: {
        select: {
          startTime: true,
        },
      },
    },
    orderBy: {
      timeSlot: {
        startTime: "asc",
      },
    },
  });

  if (dueOrders.length === 0) {
    return { delivered: 0, sent: 0, skipped: true, reason: "NO_DUE_ORDERS" };
  }

  const groupedByPickupTime = new Map();

  for (const order of dueOrders) {
    const pickupTime = String(order?.timeSlot?.startTime || "");
    if (!groupedByPickupTime.has(pickupTime)) {
      groupedByPickupTime.set(pickupTime, []);
    }
    groupedByPickupTime.get(pickupTime).push(order);
  }

  let sent = 0;
  let delivered = 0;

  for (const ordersAtSameTime of groupedByPickupTime.values()) {
    const payload = buildGroupedOrderPrepPushPayload(ordersAtSameTime);
    const result = await sendAdminPushNotification(payload, {
      ttl: Math.max(300, Math.floor(ORDER_PREP_WINDOW_MS / 1000)),
    });

    if (result.delivered > 0) {
      sent += 1;
      delivered += result.delivered;

      for (const order of ordersAtSameTime) {
        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            action: ORDER_PREP_ACTIVITY_ACTION,
            metadata: {
              delivered: result.delivered,
              pickupTime: order.timeSlot?.startTime || null,
              source: "web-push",
              grouped: ordersAtSameTime.length > 1,
              batchSize: ordersAtSameTime.length,
            },
          },
        });
      }
    }
  }

  return { delivered, sent, skipped: false };
}

module.exports = {
  isWebPushEnabled,
  getPublicVapidKey,
  upsertWebPushSubscription,
  deleteWebPushSubscription,
  sendAdminPushNotification,
  sendTicketFailurePushesByJobIds,
  sendOrderPrepPushesForDueOrders,
};
