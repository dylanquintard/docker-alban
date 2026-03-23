function normalizeText(value) {
  return String(value || "").trim();
}

export function formatCustomerDisplayName(customer) {
  const firstName = normalizeText(customer?.firstName);
  const lastName = normalizeText(customer?.lastName);
  const fullName = [lastName, firstName].filter(Boolean).join(" ");
  return fullName || normalizeText(customer?.name) || "Client";
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

export function getPushStateLabel(pushState) {
  switch (String(pushState || "").toLowerCase()) {
    case "subscribed":
      return "Actif";
    case "subscribing":
      return "Activation...";
    case "denied":
      return "Refuse";
    case "error":
      return "Erreur";
    case "unsupported":
      return "Indisponible";
    default:
      return "Disponible";
  }
}
