export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const version =
      typeof __SW_VERSION__ === "string" && __SW_VERSION__.trim()
        ? __SW_VERSION__.trim()
        : "dev";
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(version)}`;
    navigator.serviceWorker.register(serviceWorkerUrl).catch(() => undefined);
  });
}
