import { useState } from "react";

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
  return (
    <section className="launcher-grid" aria-label="Applications">
      {apps.map((app) => (
        <button
          key={app.id}
          type="button"
          className="launcher-tile"
          onClick={() => onOpenApp(app.id, app.defaultView)}
        >
          <LauncherIcon app={app} />
          <span className="launcher-name">{app.name}</span>
          <span className="launcher-subtitle">{app.subtitle}</span>
        </button>
      ))}
    </section>
  );
}
