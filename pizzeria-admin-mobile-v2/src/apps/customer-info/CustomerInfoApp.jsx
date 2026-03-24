const views = [
  { id: "search", label: "Recherche" },
  { id: "profile", label: "Fiche client" },
];

export function CustomerInfoApp({ activeView, onChangeView }) {
  return (
    <section className="app-panel">
      <div className="panel-card">
        <p className="eyebrow">Infos Clients</p>
        <h2>Base V2 de l&apos;app clients</h2>
        <div className="inline-tabs">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`inline-tab ${activeView === view.id ? "inline-tab-active" : ""}`}
              onClick={() => onChangeView(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
        <div className="placeholder-block">
          <strong>Vue active :</strong> {activeView}
        </div>
        <p>
          Cette app accueillera la recherche client, les fiches utiles et les raccourcis de service.
        </p>
      </div>
    </section>
  );
}
