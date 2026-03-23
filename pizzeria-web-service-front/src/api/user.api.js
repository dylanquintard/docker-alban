import api, { authConfig } from "./http";

export const registerUser = async ({
  firstName,
  lastName,
  name,
  email,
  phone,
  password,
}) => {
  const response = await api.post("/users/register", {
    firstName,
    lastName,
    name,
    email,
    phone,
    password,
  });
  return response.data;
};

export const loginUser = async ({ email, password }) => {
  const response = await api.post("/users/login", { email, password });
  return response.data;
};

export const verifyEmailCode = async ({ email, code }) => {
  const response = await api.post("/users/verify-email", { email, code });
  return response.data;
};

export const resendEmailVerificationCode = async ({ email }) => {
  const response = await api.post("/users/resend-verification", { email });
  return response.data;
};

export const forgotPassword = async ({ email }) => {
  const response = await api.post("/users/forgot-password", { email });
  return response.data;
};

export const resetPassword = async ({ email, token, password }) => {
  const response = await api.post("/users/reset-password", {
    email,
    token,
    password,
  });
  return response.data;
};

export const logoutUser = async (token) => {
  const response = await api.post("/users/logout", {}, authConfig(token));
  return response.data;
};

export const getMe = async (token) => {
  const response = await api.get("/users/me", authConfig(token));
  return response.data;
};

export const getCsrfToken = async (token) => {
  const response = await api.get("/users/csrf-token", authConfig(token));
  return response.data;
};

export const updateMe = async (token, data) => {
  const response = await api.put("/users/me", data, authConfig(token));
  return response.data;
};

export const getAllProductsClient = async () => {
  const response = await api.get("/products");
  return response.data;
};

export const getAllIngredients = async (token, filters = {}) => {
  const response = await api.get("/products/ingredients", {
    ...authConfig(token),
    params: filters,
  });
  return response.data;
};

export const getCart = async (token) => {
  const response = await api.get("/orders/cart", authConfig(token));
  return response.data;
};

export const addToCart = async (token, productId, quantity, customizations) => {
  const response = await api.post(
    "/orders/cart",
    { productId, quantity, customizations },
    authConfig(token)
  );
  return response.data;
};

export const removeFromCart = async (token, itemId) => {
  const response = await api.delete(`/orders/cart/${itemId}`, authConfig(token));
  return response.data;
};

export const finalizeOrder = async (token, pickupData) => {
  const response = await api.post("/orders/finalize", pickupData, authConfig(token));
  return response.data;
};

export const getUserOrders = async (token) => {
  const response = await api.get("/users/orders", authConfig(token));
  return response.data;
};

export const saveOrderReview = async (token, orderId, payload) => {
  const response = await api.put(
    `/users/orders/${orderId}/review`,
    payload,
    authConfig(token)
  );
  return response.data;
};
