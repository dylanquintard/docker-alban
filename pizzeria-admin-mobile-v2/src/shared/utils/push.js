export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const decoder =
    globalThis.atob ||
    ((value) => Buffer.from(value, "base64").toString("binary"));
  const rawData = decoder(normalized);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

export function supportsWebPush() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.isSecureContext &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
  );
}
