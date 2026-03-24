import { useEffect, useState } from "react";

function LauncherIcon({ app }) {
  const [hasError, setHasError] = useState(false);

  return (
    <span className={`launcher-icon ${app.comingSoon ? "launcher-icon-muted" : ""}`}>
      {!hasError && app.iconSrc ? (
        <img
          src={app.iconSrc}
          alt={app.name}
          className="launcher-icon-image"
          onError={() => setHasError(true)}
        />
      ) : (
        app.icon
      )}
    </span>
  );
}

export function Launcher({ apps, onOpenApp }) {
  const [visibleLimit, setVisibleLimit] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 640 ? 4 : 8
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateLimit = () => {
      setVisibleLimit(window.innerWidth <= 640 ? 4 : 8);
    };

    updateLimit();
    window.addEventListener("resize", updateLimit);
    return () => window.removeEventListener("resize", updateLimit);
  }, []);

  const visibleApps = apps.slice(0, visibleLimit);

  return (
    <section className="launcher-grid" aria-label="Applications">
      {visibleApps.map((app) => (
        <button
          key={app.id}
          type="button"
          className="launcher-tile"
          onClick={() => onOpenApp(app.id, app.defaultView)}
          aria-label={app.name}
          title={app.name}
        >
          <LauncherIcon app={app} />
        </button>
      ))}
    </section>
  );
}
