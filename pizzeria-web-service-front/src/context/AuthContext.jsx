import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { getCsrfToken, getMe, logoutUser } from "../api/user.api";
import { clearCsrfToken } from "../api/http";
import {
  clearLastActivity,
  INACTIVITY_TIMEOUT_MS,
  isSessionInactive,
  readLastActivity,
  shouldWriteActivity,
  writeLastActivity,
} from "./authSession";

export const AuthContext = createContext();
const INVALID_TOKEN_VALUES = new Set(["", "undefined", "null"]);
const SESSION_COOKIE_TOKEN = "__cookie_session__";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"];
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;
const SESSION_HYDRATION_DELAY_MS = 1200;
const PROTECTED_ROUTE_PREFIXES = ["/admin", "/order"];
const PROTECTED_EXACT_ROUTES = new Set(["/profile", "/userorders"]);

function hasValidToken(token) {
  if (typeof token !== "string") return false;
  return !INVALID_TOKEN_VALUES.has(token.trim());
}

function getCurrentPathname() {
  if (typeof window === "undefined") {
    return "/";
  }
  return String(window.location?.pathname || "/").toLowerCase();
}

function isProtectedPath(pathname) {
  const currentPath = String(pathname || "").toLowerCase();
  if (!currentPath) return false;

  if (PROTECTED_ROUTE_PREFIXES.some((prefix) => currentPath.startsWith(prefix))) {
    return true;
  }
  return PROTECTED_EXACT_ROUTES.has(currentPath);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);
  const logoutInProgressRef = useRef(false);
  const lastActivityWriteRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionHydrationPromiseRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const clearLocalSession = useCallback(() => {
    setUser(null);
    setToken(null);
    clearCsrfToken();
    clearLastActivity();
    lastActivityWriteRef.current = null;
  }, []);

  const writeActivity = useCallback((force = false) => {
    const now = Date.now();
    if (!force && !shouldWriteActivity(lastActivityWriteRef.current, now)) {
      return;
    }
    const saved = writeLastActivity(now);
    if (saved !== null) {
      lastActivityWriteRef.current = saved;
    }
  }, []);

  const runLogout = useCallback(
    async ({ notifyServer = true } = {}) => {
      if (logoutInProgressRef.current) return;
      logoutInProgressRef.current = true;

      try {
        if (notifyServer) {
          try {
            await logoutUser(tokenRef.current);
          } catch (_err) {
            // Always clear local state even if server logout fails.
          }
        }
      } finally {
        clearLocalSession();
        logoutInProgressRef.current = false;
      }
    },
    [clearLocalSession]
  );

  const hydrateSession = useCallback(async () => {
    if (sessionHydrationPromiseRef.current) {
      return sessionHydrationPromiseRef.current;
    }

    const hydrationTask = (async () => {
      const lastActivity = readLastActivity();
      if (isSessionInactive(lastActivity, Date.now(), INACTIVITY_TIMEOUT_MS)) {
        await runLogout({ notifyServer: true });
        if (mountedRef.current) {
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await getMe();
        if (!mountedRef.current) return;
        setUser(profile);
        setToken(SESSION_COOKIE_TOKEN);
        writeActivity(true);
      } catch (_err) {
        if (!mountedRef.current) return;
        clearLocalSession();
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    sessionHydrationPromiseRef.current = hydrationTask;
    try {
      await hydrationTask;
    } finally {
      sessionHydrationPromiseRef.current = null;
    }
    return hydrationTask;
  }, [clearLocalSession, runLogout, writeActivity]);

  useEffect(() => {
    const path = getCurrentPathname();
    if (isProtectedPath(path)) {
      void hydrateSession();
      return undefined;
    }

    let idleRequestId = null;
    let timeoutId = null;
    let cancelled = false;

    const startHydration = () => {
      if (!cancelled) {
        void hydrateSession();
      }
    };

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleRequestId = window.requestIdleCallback(startHydration, {
        timeout: SESSION_HYDRATION_DELAY_MS,
      });
    } else {
      timeoutId = window.setTimeout(startHydration, SESSION_HYDRATION_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined" && idleRequestId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleRequestId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [hydrateSession]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const syncCsrfToken = async () => {
      try {
        await getCsrfToken(token);
      } catch (_err) {
        if (!cancelled) {
          clearCsrfToken();
        }
      }
    };

    syncCsrfToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    writeActivity(true);

    const checkInactivity = () => {
      const lastActivity = readLastActivity();
      if (!isSessionInactive(lastActivity, Date.now(), INACTIVITY_TIMEOUT_MS)) {
        return false;
      }
      void runLogout({ notifyServer: true });
      return true;
    };

    const recordActivity = () => {
      writeActivity(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const inactive = checkInactivity();
      if (inactive) return;
      writeActivity(true);
    };

    const intervalId = window.setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL_MS);

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token, runLogout, writeActivity]);

  const login = (userData, jwtToken) => {
    if (!userData) {
      return;
    }

    setUser(userData);
    const normalizedToken = hasValidToken(jwtToken) ? jwtToken.trim() : SESSION_COOKIE_TOKEN;
    setToken(normalizedToken);
    writeActivity(true);
  };

  const logout = useCallback(async () => {
    await runLogout({ notifyServer: true });
  }, [runLogout]);

  const updateUserContext = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUserContext,
        loading,
        forceSessionHydration: hydrateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
