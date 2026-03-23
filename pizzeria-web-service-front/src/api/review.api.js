import api from "./http";

export const getPublicReviews = async (params = {}) => {
  const response = await api.get("/reviews/public", { params });
  return response.data;
};
