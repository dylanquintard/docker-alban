import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getPublicSiteSettings } from "../api/site-settings.api";
import { DEFAULT_SITE_SETTINGS, mergeSiteSettings } from "../site/siteSettings";

const defaultValue = {
  settings: mergeSiteSettings(DEFAULT_SITE_SETTINGS),
  loading: true,
  refresh: async () => {},
  applySettings: () => {},
};

export const SiteSettingsContext = createContext(defaultValue);

export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => mergeSiteSettings(DEFAULT_SITE_SETTINGS));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getPublicSiteSettings();
      setSettings(mergeSiteSettings(data));
    } catch (_err) {
      setSettings(mergeSiteSettings(DEFAULT_SITE_SETTINGS));
    } finally {
      setLoading(false);
    }
  }, []);

  const applySettings = useCallback((nextSettings) => {
    setSettings(mergeSiteSettings(nextSettings));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const rawFaviconUrl =
      String(settings?.seo?.faviconUrl || "").trim() ||
      String(settings?.seo?.headerLogoUrl || "").trim() ||
      "/favicon.ico";
    const cacheToken = String(settings?.updatedAt || "").trim();
    const faviconHref = cacheToken
      ? `${rawFaviconUrl}${rawFaviconUrl.includes("?") ? "&" : "?"}_ts=${encodeURIComponent(cacheToken)}`
      : rawFaviconUrl;

    const ensureLink = (rel) => {
      let node = document.querySelector(`link[rel='${rel}']`);
      if (!node) {
        node = document.createElement("link");
        node.setAttribute("rel", rel);
        document.head.appendChild(node);
      }
      node.setAttribute("href", faviconHref);
      return node;
    };

    ensureLink("icon");
    ensureLink("shortcut icon");
  }, [settings?.seo?.faviconUrl, settings?.seo?.headerLogoUrl, settings?.updatedAt]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      refresh,
      applySettings,
    }),
    [applySettings, loading, refresh, settings]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
