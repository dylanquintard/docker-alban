import { apiRequest } from "../api";

export async function fetchCustomers() {
  return apiRequest("/users");
}
