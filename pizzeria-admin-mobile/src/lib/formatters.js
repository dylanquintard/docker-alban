export function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "0,00 EUR";
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}

export function toIsoDate(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftIsoDate(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return toIsoDate();
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

export function normalizeWorkflowStatus(order) {
  const value = String(order?.workflowStatus || order?.status || "").trim().toUpperCase();
  if (value === "VALIDATE" || value === "VALIDATED") return "VALIDATE";
  if (value === "FINALIZED" || value === "PRINTED") return "FINALIZED";
  if (value === "CANCELED") return "CANCELED";
  return "COMPLETED";
}

export function getStatusLabel(status) {
  switch (String(status || "").toUpperCase()) {
    case "VALIDATE":
      return "Validee";
    case "FINALIZED":
      return "Finalisee";
    case "CANCELED":
      return "Annulee";
    default:
      return "En cours";
  }
}

export function getOrderDisplayName(order) {
  return order?.user?.firstName || order?.user?.name || order?.customerName || "Client";
}
