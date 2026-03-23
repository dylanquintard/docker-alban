import api, { authConfig } from "./http";

function withCacheBust(config = {}) {
  return {
    ...config,
    params: {
      ...(config.params || {}),
      _ts: Date.now(),
    },
  };
}

export const getPublicSiteSettings = async () => {
  const response = await api.get("/site-settings/public", withCacheBust());
  return response.data;
};

export const getAdminSiteSettings = async (token) => {
  const response = await api.get("/site-settings/admin", withCacheBust(authConfig(token)));
  return response.data;
};

export const translateSiteSettingsToEnglish = async (token, payload) => {
  const response = await api.post(
    "/site-settings/translate-to-english",
    payload,
    authConfig(token)
  );
  return response.data;
};

export const updateSiteSettings = async (token, payload) => {
  const response = await api.put("/site-settings", payload, authConfig(token));
  return response.data;
};

export const uploadSiteHeaderLogo = async (token, file) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post(
    "/site-settings/upload-header-logo",
    formData,
    authConfig(token)
  );
  return response.data;
};
