import api from "./http";

export const sendContactEmail = async (data) => {
  const response = await api.post("/contact/email", data);
  return response.data;
};
