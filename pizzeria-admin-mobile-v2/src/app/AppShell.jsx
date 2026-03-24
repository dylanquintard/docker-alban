import { useEffect, useMemo, useState } from "react";
import { APP_NAME } from "../config";
import { Launcher } from "./Launcher";
import { AppRouter } from "./AppRouter";
import { NotificationCenter } from "./NotificationCenter";
import { SystemMenu } from "./SystemMenu";
import { appRegistry, getAppDefinition } from "./app-registry";
import { readUrlState, writeUrlState } from "../shared/utils/url-state";

export function AppShell() {
  const [routeState, setRouteState] = useState(() => readUrlState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    writeUrlState(routeState);
  }, [routeState]);

  const activeDefinition = useMemo(
    () => getAppDefinition(routeState.app),
    [routeState.app]
  );

  function openApp(appId, view = "") {
    setRouteState({ app: appId, view });
    setIsMenuOpen(false);
  }

  function goHome() {
    setRouteState({ app: "launcher", view: "" });
    setIsMenuOpen(false);
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
              <NotificationCenter activeAppId={routeState.app} />
            </>
          ) : (
            <AppRouter
              activeAppId={routeState.app}
              activeView={routeState.view}
              onChangeView={(view) => setRouteState((current) => ({ ...current, view }))}
            />
          )}
        </main>
      </div>

      <SystemMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
}
