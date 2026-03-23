import api from "./http";

export const getSeoLocations = async () => {
  const response = await api.get("/seo/locations");
  return response.data;
};

