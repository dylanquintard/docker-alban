import { formatTimeLabel, getOrderDisplayName, normalizeWorkflowStatus } from "../lib/formatters";

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

export function matchesCustomerQuery(customer, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    customer?.name,
    customer?.firstName,
    customer?.lastName,
    customer?.phone,
    customer?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
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
