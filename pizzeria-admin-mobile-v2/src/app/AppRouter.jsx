import { getAppDefinition } from "./app-registry";

export function AppRouter({ activeAppId, activeView, onChangeView }) {
  const definition = getAppDefinition(activeAppId);

  if (!definition) {
    return (
      <section className="app-panel">
        <div className="panel-card">
          <p className="eyebrow">Application introuvable</p>
          <h2>Cette application n&apos;existe pas encore.</h2>
        </div>
      </section>
    );
  }

  if (definition.comingSoon || !definition.component) {
    return (
      <section className="app-panel">
        <div className="panel-card">
          <p className="eyebrow">Bientot</p>
          <h2>{definition.name}</h2>
          <p>{definition.subtitle}</p>
        </div>
      </section>
    );
  }

  const Component = definition.component;
  return <Component activeView={activeView || definition.defaultView} onChangeView={onChangeView} />;
}
