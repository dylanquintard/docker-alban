import { apiRequest } from "../api";

export async function login(email, password) {
  return apiRequest("/users/login", {
    method: "POST",
    skipCsrf: true,
    body: { email, password },
  });
}

export async function fetchMe() {
  return apiRequest("/users/me");
}

export async function logout() {
  return apiRequest("/users/logout", {
    method: "POST",
  });
}
