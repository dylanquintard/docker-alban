import api, { authConfig } from "./http";

export const getPublishedBlogArticles = async () => {
  const response = await api.get("/blog");
  return response.data;
};

export const getPublishedBlogArticleBySlug = async (slug) => {
  const response = await api.get(`/blog/slug/${slug}`);
  return response.data;
};

export const getAdminBlogArticles = async (token) => {
  const response = await api.get("/blog/admin/all", authConfig(token));
  return response.data;
};

export const createBlogArticle = async (token, payload) => {
  const response = await api.post("/blog", payload, authConfig(token));
  return response.data;
};

export const updateBlogArticle = async (token, id, payload) => {
  const response = await api.put(`/blog/${id}`, payload, authConfig(token));
  return response.data;
};

export const deleteBlogArticle = async (token, id) => {
  const response = await api.delete(`/blog/${id}`, authConfig(token));
  return response.data;
};
