import { apiRequest } from "../api";

export async function fetchMenuCategories() {
  const search = new URLSearchParams({
    active: "true",
    kind: "PRODUCT",
  });

  return apiRequest(`/categories?${search.toString()}`);
}

export async function fetchMenuProducts() {
  return apiRequest("/products");
}
