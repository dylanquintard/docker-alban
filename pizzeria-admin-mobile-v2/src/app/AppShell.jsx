import { useEffect, useMemo, useState } from "react";
import { APP_NAME } from "../config";
import { Launcher } from "./Launcher";
import { AppRouter } from "./AppRouter";
import { NotificationCenter } from "./NotificationCenter";
import { SystemMenu } from "./SystemMenu";
import { appRegistry, getAppDefinition } from "./app-registry";
import { readUrlState, writeUrlState } from "../shared/utils/url-state";
import { bootstrapSession, loginAdmin, logoutAdmin } from "../services/auth/session";
import {
  disablePushNotifications,
  enablePushNotifications,
  getBrowserNotificationPermission,
  syncPushStateWithBackend,
} from "../services/notifications/push";
import { clearCsrfToken } from "../shared/lib/api";
import { useSessionHeartbeat } from "../hooks/useSessionHeartbeat";

export function AppShell() {
  const [routeState, setRouteState] = useState(() => readUrlState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSession] = useState({ state: "loading", user: null });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    getBrowserNotificationPermission()
  );
  const [pushState, setPushState] = useState("unknown");
  const [pushActionPending, setPushActionPending] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);

  useEffect(() => {
    writeUrlState(routeState);
  }, [routeState]);

  useEffect(() => {
    let cancelled = false;

    bootstrapSession().then((result) => {
      if (!cancelled) {
        setSession(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setNotificationPermission(getBrowserNotificationPermission());
  }, [session.state]);

  useEffect(() => {
    if (session.state !== "authenticated") {
      setPushState("unknown");
      return;
    }

    let cancelled = false;
    syncPushStateWithBackend()
      .then((result) => {
        if (!cancelled) {
          setNotificationPermission(result.permission);
          setPushState(result.state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPushState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session.state]);

  const activeDefinition = useMemo(
    () => getAppDefinition(routeState.app),
    [routeState.app]
  );

  useSessionHeartbeat(session.state === "authenticated", async () => {
    const result = await bootstrapSession();
    if (result.state === "authenticated") {
      setSession(result);
      return;
    }

    clearCsrfToken();
    setSession({ state: "anonymous", user: null });
    setPushState("unknown");
    setNotificationPermission(getBrowserNotificationPermission());
    setRouteState({ app: "launcher", view: "", orderId: "", ticketId: "", source: "" });
  });

  function showStatusNotice(message, tone = "success") {
    const normalized = String(message || "").trim();
    if (!normalized) {
      setStatusNotice(null);
      return;
    }
    setStatusNotice({ message: normalized, tone });
    window.setTimeout(() => {
      setStatusNotice((current) => (current?.message === normalized ? null : current));
    }, 3000);
  }

  function openApp(appId, view = "") {
    setRouteState({ app: appId, view, orderId: "", ticketId: "", source: "" });
    setIsMenuOpen(false);
  }

  function goHome() {
    setRouteState({ app: "launcher", view: "", orderId: "", ticketId: "", source: "" });
    setIsMenuOpen(false);
  }

  function getNotificationLabel() {
    if (pushState === "active") return "Actives";
    if (pushState === "config-missing") return "Push non configure";
    if (pushState === "unsupported") return "Indisponibles ici";
    if (pushState === "denied" || notificationPermission === "denied") {
      return "Autoriser dans le navigateur";
    }
    if (pushState === "error") return "Erreur";
    return "Activer";
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      const nextSession = await loginAdmin(loginForm.email, loginForm.password);
      if (nextSession.state !== "authenticated") {
        setSession(nextSession);
        setLoginError("Ce compte n'a pas le role admin.");
        return;
      }

      setSession(nextSession);
      setRouteState((current) =>
        current.source === "push"
          ? { ...current, source: "" }
          : { app: "launcher", view: "", orderId: "", ticketId: "", source: "" }
      );
    } catch (error) {
      setLoginError(error.message || "Connexion impossible.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await disablePushNotifications().catch(() => undefined);
      await logoutAdmin();
    } catch (_error) {
      // no-op
    } finally {
      clearCsrfToken();
      setSession({ state: "anonymous", user: null });
      setPushState("unknown");
      setNotificationPermission(getBrowserNotificationPermission());
      setRouteState({ app: "launcher", view: "", orderId: "", ticketId: "", source: "" });
      setIsMenuOpen(false);
    }
  }

  async function handleToggleNotifications() {
    setPushActionPending(true);
    try {
      if (pushState === "active") {
        const result = await disablePushNotifications();
        setNotificationPermission(result.permission);
        setPushState(result.state);
        showStatusNotice("Notifications desactivees.");
      } else {
        const result = await enablePushNotifications();
        setNotificationPermission(result.permission);
        setPushState(result.state);
        showStatusNotice(result.message, result.ok ? "success" : "error");
      }
    } catch (error) {
      setPushState("error");
      showStatusNotice(error.message || "Impossible de gerer les notifications.", "error");
    } finally {
      setPushActionPending(false);
      setIsMenuOpen(false);
    }
  }

  if (session.state === "loading") {
    return <div className="screen-center">Chargement de l'application admin V2...</div>;
  }

  if (session.state === "anonymous" || session.state === "unauthorized") {
    return (
      <main className="mobile-os-shell login-shell-v2">
        <section className="login-card-v2">
          <p className="eyebrow">{APP_NAME}</p>
          <h1>Connexion admin</h1>
          <p className="login-copy-v2">
            Connectez-vous pour ouvrir le launcher V2, Click&Collect et Infos Clients dans la nouvelle structure mobile.
          </p>

          {session.state === "unauthorized" ? (
            <p className="inline-error">Ce compte est connecte mais n'a pas le role admin.</p>
          ) : null}

          <form className="login-form-v2" onSubmit={handleLoginSubmit}>
            <label>
              <span>Email admin</span>
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="admin@site.fr"
                required
              />
            </label>
            <label>
              <span>Mot de passe</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="********"
                required
              />
            </label>

            {loginError ? <p className="inline-error">{loginError}</p> : null}

            <button type="submit" className="primary-button" disabled={loggingIn}>
              {loggingIn ? "Connexion..." : "Entrer dans la V2"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="mobile-os-shell">
      <div className="mobile-device-frame">
        <header className="system-topbar">
          <div>
            <p className="eyebrow">{APP_NAME}</p>
            <h1>{routeState.app === "launcher" ? "Applications" : activeDefinition?.name || "Application"}</h1>
          </div>
          <div className="system-actions">
            {routeState.app !== "launcher" ? (
              <button type="button" className="icon-button" onClick={goHome}>
                Accueil
              </button>
            ) : null}
            <button type="button" className="icon-button" onClick={() => setIsMenuOpen((value) => !value)}>
              Menu
            </button>
          </div>
        </header>

        <main className="mobile-os-content">
          {statusNotice?.message ? (
            <p className={statusNotice.tone === "error" ? "inline-error" : "inline-success"}>
              {statusNotice.message}
            </p>
          ) : null}
          {routeState.app === "launcher" ? (
            <>
              <section className="hero-card">
                <p className="eyebrow">V2</p>
                <h2>Base mobile type mini OS</h2>
                <p>
                  Launcher central, apps separees, deep links et notifications dirigees vers la bonne vue.
                </p>
              </section>
              <Launcher apps={appRegistry} onOpenApp={openApp} />
              <NotificationCenter
                pushState={pushState}
                sessionState={session.state}
              />
            </>
          ) : (
            <AppRouter
              activeAppId={routeState.app}
              activeView={routeState.view}
              onChangeView={(view) =>
                setRouteState((current) => ({ ...current, view, orderId: "", ticketId: "", source: "" }))
              }
              routeState={routeState}
            />
          )}
        </main>
      </div>

      <SystemMenu
        isOpen={isMenuOpen}
        notificationLabel={getNotificationLabel()}
        onClose={() => setIsMenuOpen(false)}
        onToggleNotifications={handleToggleNotifications}
        onLogout={handleLogout}
        pushActionPending={pushActionPending}
        userLabel={session.user?.email || session.user?.name || "Admin"}
      />
    </div>
  );
}
