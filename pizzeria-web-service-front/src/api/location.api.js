import api, { authConfig } from "./http";

export const getLocations = async (filters = {}) => {
  const response = await api.get("/locations", { params: filters });
  return response.data;
};

export const getLocationById = async (id) => {
  const response = await api.get(`/locations/${id}`);
  return response.data;
};

export const createLocation = async (token, data) => {
  const response = await api.post("/locations", data, authConfig(token));
  return response.data;
};

export const updateLocation = async (token, id, data) => {
  const response = await api.put(`/locations/${id}`, data, authConfig(token));
  return response.data;
};

export const activateLocation = async (token, id, active) => {
  const response = await api.patch(
    `/locations/${id}/activate`,
    { active },
    authConfig(token)
  );
  return response.data;
};

export const deleteLocation = async (token, id) => {
  const response = await api.delete(`/locations/${id}`, authConfig(token));
  return response.data;
};
