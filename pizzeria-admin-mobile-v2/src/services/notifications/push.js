import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "../../shared/lib/api/notifications";
import { isStandaloneDisplay, supportsWebPush, urlBase64ToUint8Array } from "../../shared/utils/push";

export function getBrowserNotificationPermission() {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  return window.Notification.permission || "default";
}

export async function getCurrentPushSubscription() {
  if (!supportsWebPush()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function syncPushStateWithBackend() {
  const permission = getBrowserNotificationPermission();
  if (!supportsWebPush()) {
    return { permission, state: "unsupported" };
  }

  if (permission !== "granted") {
    return {
      permission,
      state: permission === "denied" ? "denied" : "inactive",
    };
  }

  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    return { permission, state: "inactive" };
  }

  await savePushSubscription(
    typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription
  );

  return {
    permission,
    state: "active",
    subscription,
  };
}

export async function enablePushNotifications() {
  if (!supportsWebPush()) {
    return {
      ok: false,
      permission: "unsupported",
      state: "unsupported",
      message: "Notifications indisponibles sur cet appareil.",
    };
  }

  const permission = await window.Notification.requestPermission();
  if (permission === "default") {
    return {
      ok: false,
      permission,
      state: "inactive",
      message: "Notifications non activees.",
    };
  }

  if (permission === "denied") {
    return {
      ok: false,
      permission,
      state: "denied",
      message: "Notifications bloquees. Autorisez-les dans le navigateur.",
    };
  }

  const pushConfig = await getPushPublicKey();
  if (!pushConfig?.enabled || !pushConfig?.publicKey) {
    return {
      ok: false,
      permission,
      state: "config-missing",
      message: "Push non configure cote serveur.",
    };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
    });
  }

  await savePushSubscription(
    typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription
  );

  return {
    ok: true,
    permission,
    state: "active",
    subscription,
    message: isStandaloneDisplay()
      ? "Notifications actives sur cet appareil."
      : "Notifications actives. Sur iPhone, ajoutez aussi l'app a l'ecran d'accueil.",
  };
}

export async function disablePushNotifications() {
  const subscription = await getCurrentPushSubscription();
  const endpoint = subscription?.endpoint || "";

  if (endpoint) {
    await removePushSubscription(endpoint);
  }

  if (subscription) {
    await subscription.unsubscribe();
  }

  return {
    permission: getBrowserNotificationPermission(),
    state: "inactive",
  };
}
