import {
  formatTimeLabel,
  getOrderDisplayName,
  normalizeWorkflowStatus,
} from "../lib/formatters";

export function groupOrdersBySlot(orders) {
  return orders.reduce((groups, order) => {
    const label = order?.timeSlot?.startTime ? formatTimeLabel(order.timeSlot.startTime) : "Sans creneau";
    if (!groups[label]) groups[label] = [];
    groups[label].push(order);
    return groups;
  }, {});
}

export function matchesOrderQuery(order, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    order?.id,
    getOrderDisplayName(order),
    order?.user?.phone,
    order?.user?.email,
    order?.timeSlot?.location?.name,
    order?.timeSlot?.location?.city,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function buildStatusCounters(orders) {
  return orders.reduce(
    (accumulator, order) => {
      const workflowStatus = normalizeWorkflowStatus(order);
      accumulator.total += 1;
      accumulator[workflowStatus] += 1;
      return accumulator;
    },
    {
      total: 0,
      COMPLETED: 0,
      FINALIZED: 0,
      VALIDATE: 0,
      CANCELED: 0,
    }
  );
}

export function matchesTicketQuery(ticket, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    ticket?.id,
    ticket?.orderId,
    ticket?.printer?.code,
    ticket?.printer?.name,
    ticket?.order?.user?.name,
    ticket?.order?.user?.firstName,
    ticket?.order?.user?.lastName,
    ticket?.order?.user?.phone,
    ticket?.order?.timeSlot?.location?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function matchesStatusFilter(order, status) {
  const normalizedFilter = String(status || "").trim().toUpperCase();
  if (!normalizedFilter) return true;

  const workflowStatus = normalizeWorkflowStatus(order);

  switch (normalizedFilter) {
    case "IN_PROGRESS":
      return workflowStatus === "COMPLETED";
    case "PRINTED":
      return workflowStatus === "FINALIZED";
    case "VALIDATE":
      return workflowStatus === "VALIDATE";
    case "CANCELED":
      return workflowStatus === "CANCELED";
    default:
      return true;
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

export function getTicketMonitorState(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "FAILED") return "error";
  if (["RETRY_WAITING", "CLAIMED", "PRINTING", "PENDING"].includes(normalized)) return "warning";
  if (["READY", "PRINTED"].includes(normalized)) return "healthy";
  return "muted";
}

export function getTicketMonitorLabel(state) {
  switch (String(state || "").toLowerCase()) {
    case "error":
      return "Erreur ticket";
    case "warning":
      return "A surveiller";
    case "healthy":
      return "OK / reimprimable";
    default:
      return "Secondaire";
  }
}

export function getTicketStatusLabel(status) {
  switch (String(status || "").toUpperCase()) {
    case "PENDING":
      return "En attente";
    case "READY":
      return "Pret";
    case "CLAIMED":
      return "Reserve";
    case "PRINTING":
      return "En impression";
    case "PRINTED":
      return "Imprime";
    case "FAILED":
      return "Echec";
    case "RETRY_WAITING":
      return "Nouvel essai";
    case "CANCELLED":
      return "Annule";
    default:
      return "Inconnu";
  }
}

export function getTicketStatusClass(status) {
  const normalized = String(status || "").toUpperCase();
  if (["READY", "PRINTED"].includes(normalized)) return "success";
  if (["CLAIMED", "PRINTING", "PENDING", "RETRY_WAITING"].includes(normalized)) return "warning";
  if (["FAILED", "CANCELLED"].includes(normalized)) return "canceled";
  return "neutral";
}

export function formatCustomerDisplayName(customer) {
  const firstName = normalizeText(customer?.firstName);
  const lastName = normalizeText(customer?.lastName);
  const fullName = [lastName, firstName].filter(Boolean).join(" ");
  return fullName || normalizeText(customer?.name) || "Client";
}
