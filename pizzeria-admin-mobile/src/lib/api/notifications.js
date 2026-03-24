import { apiRequest } from "../api";

export async function getPushPublicKey() {
  return apiRequest("/realtime/push/public-key");
}

export async function savePushSubscription(subscription) {
  return apiRequest("/realtime/push/subscriptions", {
    method: "POST",
    body: { subscription },
  });
}

export async function removePushSubscription(endpoint) {
  return apiRequest("/realtime/push/subscriptions", {
    method: "DELETE",
    body: { endpoint },
  });
}
