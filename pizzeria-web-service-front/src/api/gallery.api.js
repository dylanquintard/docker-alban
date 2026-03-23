import api, { authConfig } from "./http";

export const getPublicGallery = async (filters = {}) => {
  const response = await api.get("/gallery", { params: filters });
  return response.data;
};

export const getGalleryAdmin = async (token, filters = {}) => {
  const response = await api.get("/gallery/admin/all", {
    ...authConfig(token),
    params: filters,
  });
  return response.data;
};

export const createGalleryImage = async (token, data) => {
  const response = await api.post("/gallery", data, authConfig(token));
  return response.data;
};

export const uploadGalleryImage = async (token, file) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post("/gallery/upload", formData, authConfig(token));
  return response.data;
};

export const updateGalleryImage = async (token, id, data) => {
  const response = await api.put(`/gallery/${id}`, data, authConfig(token));
  return response.data;
};

export const activateGalleryImage = async (token, id, active) => {
  const response = await api.patch(
    `/gallery/${id}/activate`,
    { active },
    authConfig(token)
  );
  return response.data;
};

export const setGalleryHomeBackground = async (token, id) => {
  const response = await api.patch(
    `/gallery/${id}/home-background`,
    {},
    authConfig(token)
  );
  return response.data;
};

export const deleteGalleryImage = async (token, id) => {
  const response = await api.delete(`/gallery/${id}`, authConfig(token));
  return response.data;
};
