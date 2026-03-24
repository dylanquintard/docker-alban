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
          <span className={`launcher-icon ${app.comingSoon ? "launcher-icon-muted" : ""}`}>
            {app.icon}
          </span>
          <span className="launcher-name">{app.name}</span>
          <span className="launcher-subtitle">{app.subtitle}</span>
        </button>
      ))}
    </section>
  );
}
