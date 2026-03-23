import { lazy } from "react";

const LAZY_IMPORT_RETRY_PREFIX = "lazy-import-retry:";

export function lazyWithSingleReload(importFactory, retryKey) {
  return lazy(async () => {
    try {
      const module = await importFactory();
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(`${LAZY_IMPORT_RETRY_PREFIX}${retryKey}`);
      }
      return module;
    } catch (error) {
      if (typeof window === "undefined" || !window.sessionStorage) {
        throw error;
      }

      const message = String(error?.message || error || "");
      const isDynamicImportFailure =
        message.includes("dynamically imported module") ||
        message.includes("ChunkLoadError") ||
        message.includes("Loading chunk") ||
        message.includes("MIME");
      const storageKey = `${LAZY_IMPORT_RETRY_PREFIX}${retryKey}`;
      const alreadyRetried = window.sessionStorage.getItem(storageKey) === "1";

      if (isDynamicImportFailure && !alreadyRetried) {
        window.sessionStorage.setItem(storageKey, "1");
        window.location.reload();
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
