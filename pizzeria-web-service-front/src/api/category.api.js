import api, { authConfig } from "./http";

export const getCategories = async (filters = {}) => {
  const response = await api.get("/categories", { params: filters });
  return response.data;
};

export const getCategoryById = async (id) => {
  const response = await api.get(`/categories/${id}`);
  return response.data;
};

export const createCategory = async (token, data) => {
  const response = await api.post("/categories", data, authConfig(token));
  return response.data;
};

export const updateCategory = async (token, id, data) => {
  const response = await api.put(`/categories/${id}`, data, authConfig(token));
  return response.data;
};

export const activateCategory = async (token, id, active) => {
  const response = await api.patch(
    `/categories/${id}/activate`,
    { active },
    authConfig(token)
  );
  return response.data;
};

export const deleteCategory = async (token, id) => {
  const response = await api.delete(`/categories/${id}`, authConfig(token));
  return response.data;
};
