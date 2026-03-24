import { useEffect, useMemo, useState } from "react";
import { fetchCustomers } from "../../shared/lib/api/customers";
import { formatCustomerDisplayName } from "../../shared/utils/click-collect";

const views = [
  { id: "search", label: "Recherche" },
  { id: "profile", label: "Fiche client" },
];

function matchesCustomerQuery(customer, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    customer?.name,
    customer?.firstName,
    customer?.lastName,
    customer?.phone,
    customer?.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function CustomerInfoApp({ activeView, onChangeView }) {
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  const filteredCustomers = useMemo(
    () => customers.filter((entry) => matchesCustomerQuery(entry, customerSearchQuery)),
    [customerSearchQuery, customers]
  );

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      setCustomersLoading(true);
    }

    try {
      const payload = await fetchCustomers();
      setCustomers(Array.isArray(payload) ? payload : []);
      setCustomersError("");
    } catch (error) {
      setCustomersError(error.message || "Impossible de charger les clients.");
    } finally {
      setCustomersLoading(false);
    }
  }

  return (
    <section className="app-panel app-panel-spaced">
      <div className="panel-card">
        <div className="column-head">
          <div>
            <p className="eyebrow">Infos Clients</p>
            <h2>Recherche & fiches utiles</h2>
          </div>
          <span className="status-pill neutral">{customers.length} fiches</span>
        </div>

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

        <section className="toolbar app-toolbar panel-card">
          <label className="search-field">
            <input
              type="search"
              value={customerSearchQuery}
              onChange={(event) => setCustomerSearchQuery(event.target.value)}
              placeholder="Nom, prenom, numero ou email..."
            />
          </label>

          <button
            type="button"
            className="ghost-button compact-button"
            onClick={() => loadCustomers({ silent: true })}
            disabled={customersLoading}
          >
            {customersLoading ? "Actualisation..." : "Rafraichir"}
          </button>
        </section>

        {customersError ? <p className="inline-error">{customersError}</p> : null}

        <section className="stack-layout">
          {customersLoading && customers.length === 0 ? (
            <div className="panel-card">Chargement des clients...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="panel-card">Aucun client ne correspond a cette recherche.</div>
          ) : (
            <div className="stack-list">
              {filteredCustomers.map((customer) => (
                <article key={customer.id} className="panel-card compact-card customer-card">
                  <div className="customer-card-head">
                    <strong>{formatCustomerDisplayName(customer)}</strong>
                    <span className="status-pill neutral">{customer?.role || "Client"}</span>
                  </div>

                  <div className="customer-info-grid">
                    <div className="detail-block compact-detail-block">
                      <span>Telephone</span>
                      <strong>{customer.phone || "Numero non renseigne"}</strong>
                    </div>
                    <div className="detail-block compact-detail-block">
                      <span>Email</span>
                      <strong>{customer.email || "Email non renseigne"}</strong>
                    </div>
                    {customer.address ? (
                      <div className="detail-block compact-detail-block full-width">
                        <span>Adresse</span>
                        <strong>{customer.address}</strong>
                      </div>
                    ) : null}
                    {customer.notes ? (
                      <div className="detail-block compact-detail-block full-width">
                        <span>Notes utiles</span>
                        <p>{customer.notes}</p>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
