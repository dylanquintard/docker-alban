import { apiRequest } from "../api";

export async function fetchOrders(filters) {
  const search = new URLSearchParams();
  if (filters.date) search.set("date", filters.date);
  return apiRequest(`/orders?${search.toString()}`);
}

export async function updateOrderStatus(orderId, status) {
  return apiRequest(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
}
