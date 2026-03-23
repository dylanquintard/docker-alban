import { apiRequest } from "../api";

export async function fetchTickets(filters) {
  const search = new URLSearchParams();
  if (filters.date) search.set("date", filters.date);
  search.set("limit", "80");
  return apiRequest(`/print/admin/jobs?${search.toString()}`);
}

export async function reprintTicket(jobId) {
  return apiRequest(`/print/admin/jobs/${jobId}/reprint`, {
    method: "POST",
    body: { copies: 1, reason: "mobile_admin_reprint" },
  });
}
