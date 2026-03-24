export function readUrlState() {
  if (typeof window === "undefined") {
    return {
      app: "launcher",
      view: "",
      orderId: "",
      ticketId: "",
      source: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  const source = params.get("source") || "";
  const legacyApp = params.get("app") || "";
  const legacySection = params.get("section") || "";
  const explicitView = params.get("view") || "";

  if (source !== "push") {
    return {
      app: "launcher",
      view: "",
      orderId: "",
      ticketId: "",
      source: "",
    };
  }

  const app =
    legacyApp === "clickCollect"
      ? "click-collect"
      : legacyApp === "customerInfo"
        ? "customer-info"
        : legacyApp || "launcher";
  const view = explicitView || legacySection || "";

  return {
    app,
    view,
    orderId: params.get("orderId") || "",
    ticketId: params.get("ticketId") || "",
    source,
  };
}

export function writeUrlState({ app, view, orderId, ticketId, source }) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();

  if (app && app !== "launcher") {
    params.set("app", app);
  }

  if (view) {
    params.set("view", view);
  }

  if (orderId) {
    params.set("orderId", String(orderId));
  }

  if (ticketId) {
    params.set("ticketId", String(ticketId));
  }

  if (source) {
    params.set("source", String(source));
  }

  const next = params.toString();
  const nextUrl = next ? `/?${next}` : "/";
  window.history.replaceState({}, "", nextUrl);
}
