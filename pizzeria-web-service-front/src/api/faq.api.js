import api, { authConfig } from "./http";

export const getPublicFaqEntries = async (path) => {
  const response = await api.get("/faqs/public", {
    params: { path },
  });
  return response.data;
};

export const getAdminFaqTargets = async (token) => {
  const response = await api.get("/faqs/admin/targets", authConfig(token));
  return response.data;
};

export const getAdminFaqEntries = async (token, path) => {
  const response = await api.get("/faqs/admin", {
    ...authConfig(token),
    params: { path },
  });
  return response.data;
};

export const createFaqEntry = async (token, payload) => {
  const response = await api.post("/faqs/admin", payload, authConfig(token));
  return response.data;
};

export const updateFaqEntry = async (token, id, payload) => {
  const response = await api.put(`/faqs/admin/${id}`, payload, authConfig(token));
  return response.data;
};

export const deleteFaqEntry = async (token, id) => {
  await api.delete(`/faqs/admin/${id}`, authConfig(token));
};
