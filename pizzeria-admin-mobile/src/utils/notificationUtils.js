import { formatTimeLabel, normalizeWorkflowStatus } from "../lib/formatters";

export const ORDER_PREP_WINDOW_MS = 30 * 60 * 1000;

export function getNotificationPermission() {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  return window.Notification.permission || "default";
}

export function buildOrderPrepNotification(order, now = new Date()) {
  const orderId = Number(order?.id || 0);
  const pickupAt = new Date(order?.timeSlot?.startTime || "");
  const workflowStatus = normalizeWorkflowStatus(order);

  if (!orderId || Number.isNaN(pickupAt.getTime())) return null;
  if (workflowStatus !== "COMPLETED") return null;

  const msUntilPickup = pickupAt.getTime() - now.getTime();
  if (msUntilPickup <= 0 || msUntilPickup > ORDER_PREP_WINDOW_MS) return null;

  const pickupLabel = formatTimeLabel(pickupAt);
  const locationName = String(order?.timeSlot?.location?.name || "").trim();

  return {
    key: `order-prep:${orderId}:${pickupAt.toISOString()}`,
    tag: `order-prep-${orderId}`,
    title: `Commande #${orderId} - A PREPARER`,
    body: locationName
      ? `Heure de retrait : ${pickupLabel} · ${locationName}`
      : `Heure de retrait : ${pickupLabel}`,
  };
}

export function buildFailedTicketNotification(ticket) {
  const status = String(ticket?.status || "").trim().toUpperCase();
  const ticketId = String(ticket?.id || "").trim();
  const orderId = Number(ticket?.orderId || ticket?.order?.id || 0);

  if (status !== "FAILED" || !ticketId || !orderId) return null;

  const printerCode = String(ticket?.printer?.code || "").trim();
  const errorMessage = String(ticket?.lastErrorMessage || "").trim();
  const details = [printerCode ? `Imprimante ${printerCode}` : "", errorMessage]
    .filter(Boolean)
    .join(" · ");

  return {
    key: `ticket-failed:${ticketId}`,
    tag: `ticket-failed-${ticketId}`,
    title: `IMPRESSION TICKET ECHEC #${orderId}`,
    body: details || "Ticket en erreur",
  };
}
