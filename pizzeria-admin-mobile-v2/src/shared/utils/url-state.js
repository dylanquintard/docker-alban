export function readUrlState() {
  if (typeof window === "undefined") {
    return {
      app: "launcher",
      view: "",
      orderId: "",
      ticketId: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    app: params.get("app") || "launcher",
    view: params.get("view") || "",
    orderId: params.get("orderId") || "",
    ticketId: params.get("ticketId") || "",
  };
}

export function writeUrlState({ app, view, orderId, ticketId }) {
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

  const next = params.toString();
  const nextUrl = next ? `/?${next}` : "/";
  window.history.replaceState({}, "", nextUrl);
}
