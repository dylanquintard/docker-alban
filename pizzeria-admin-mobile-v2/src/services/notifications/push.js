export async function ensurePushReady() {
  return {
    supported: typeof window !== "undefined" && "Notification" in window,
    permission:
      typeof window !== "undefined" && "Notification" in window
        ? window.Notification.permission
        : "unsupported",
  };
}
