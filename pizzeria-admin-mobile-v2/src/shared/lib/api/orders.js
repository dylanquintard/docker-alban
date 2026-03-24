import { apiRequest } from "../api";

export async function fetchOrders(filters, options = {}) {
  const search = new URLSearchParams();
  if (filters.date) search.set("date", filters.date);
  if (filters.status) search.set("status", filters.status);
  if (options.paginated) search.set("paginated", "1");
  if (options.page) search.set("page", String(options.page));
  if (options.limit) search.set("limit", String(options.limit));
  return apiRequest(`/orders?${search.toString()}`);
}

export async function updateOrderStatus(orderId, status) {
  return apiRequest(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
}
