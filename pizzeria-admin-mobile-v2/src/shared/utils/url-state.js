export function readUrlState() {
  if (typeof window === "undefined") {
    return {
      app: "launcher",
      view: "",
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    app: params.get("app") || "launcher",
    view: params.get("view") || "",
  };
}

export function writeUrlState({ app, view }) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();

  if (app && app !== "launcher") {
    params.set("app", app);
  }

  if (view) {
    params.set("view", view);
  }

  const next = params.toString();
  const nextUrl = next ? `/?${next}` : "/";
  window.history.replaceState({}, "", nextUrl);
}
