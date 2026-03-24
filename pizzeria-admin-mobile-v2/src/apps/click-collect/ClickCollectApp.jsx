import { useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_ORDER_URL } from "../../config";
import { useRealtimeStream } from "../../hooks/useRealtimeStream";
import { fetchMenuCategories, fetchMenuProducts } from "../../shared/lib/api/menu";
import { fetchOrders, updateOrderStatus } from "../../shared/lib/api/orders";
import { fetchTickets, reprintTicket } from "../../shared/lib/api/tickets";
import {
  formatPrice,
  formatTimeLabel,
  getOrderDisplayName,
  getStatusLabel,
  normalizeWorkflowStatus,
  shiftIsoDate,
  toIsoDate,
} from "../../shared/lib/formatters";
import {
  buildStatusCounters,
  getTicketMonitorLabel,
  getTicketMonitorState,
  getTicketStatusClass,
  getTicketStatusLabel,
  groupOrdersBySlot,
  matchesOrderQuery,
  matchesStatusFilter,
  matchesTicketQuery,
} from "../../shared/utils/click-collect";
import { getRealtimeStreamUrl } from "../../services/realtime/client";

function NavArrow({ direction = "left", ...props }) {
  return (
    <button type="button" className="ghost-icon-button" {...props}>
      <span className={direction === "right" ? "arrow-right" : "arrow-left"} aria-hidden="true">
        ←
      </span>
    </button>
  );
}

export function ClickCollectApp({ activeView, onChangeView }) {
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [filters, setFilters] = useState({ date: toIsoDate(), status: "IN_PROGRESS" });
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState("attention");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ticketsError, setTicketsError] = useState("");
  const [streamConnected, setStreamConnected] = useState(false);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isOrderBuilderOpen, setIsOrderBuilderOpen] = useState(false);
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuProducts, setMenuProducts] = useState([]);
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState(null);
  const [orderBuilderLoading, setOrderBuilderLoading] = useState(false);
  const [orderBuilderError, setOrderBuilderError] = useState("");
  const [statusNotice, setStatusNotice] = useState(null);
  const noticeTimerRef = useRef(null);

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (entry) =>
          matchesStatusFilter(entry, filters.status) && matchesOrderQuery(entry, searchQuery)
      ),
    [orders, filters.status, searchQuery]
  );
  const groupedOrders = useMemo(() => groupOrdersBySlot(filteredOrders), [filteredOrders]);
  const groupedKeys = useMemo(() => Object.keys(groupedOrders).sort(), [groupedOrders]);
  const selectedOrder = useMemo(
    () =>
      filteredOrders.find((entry) => String(entry.id) === String(selectedOrderId)) ||
      filteredOrders[0] ||
      null,
    [filteredOrders, selectedOrderId]
  );
  const statusCounters = useMemo(() => buildStatusCounters(orders), [orders]);
  const orderedOrderIds = useMemo(() => filteredOrders.map((entry) => String(entry.id)), [filteredOrders]);
  const selectedOrderIndex = useMemo(
    () => orderedOrderIds.findIndex((entry) => entry === String(selectedOrder?.id || "")),
    [orderedOrderIds, selectedOrder]
  );
  const filteredTickets = useMemo(() => {
    const base = tickets.filter((entry) => matchesTicketQuery(entry, ticketSearchQuery));
    if (ticketFilter === "all") return base;
    if (ticketFilter === "error") return base.filter((entry) => getTicketMonitorState(entry?.status) === "error");
    if (ticketFilter === "healthy") return base.filter((entry) => getTicketMonitorState(entry?.status) === "healthy");
    return base.filter((entry) => ["error", "warning"].includes(getTicketMonitorState(entry?.status)));
  }, [ticketFilter, ticketSearchQuery, tickets]);
  const ticketCounters = useMemo(
    () =>
      tickets.reduce(
        (acc, entry) => {
          const state = getTicketMonitorState(entry?.status);
          acc.total += 1;
          acc[state] += 1;
          return acc;
        },
        { total: 0, error: 0, warning: 0, healthy: 0 }
      ),
    [tickets]
  );
  const filteredMenuProducts = useMemo(() => {
    if (!selectedMenuCategoryId) return menuProducts;
    return menuProducts.filter(
      (entry) => String(entry?.categoryId || entry?.category?.id || "") === String(selectedMenuCategoryId)
    );
  }, [menuProducts, selectedMenuCategoryId]);

  useEffect(() => {
    loadOrders();
  }, [filters.date]);

  useEffect(() => {
    if (activeView === "tickets") {
      loadTickets();
    }
  }, [activeView, filters.date]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !filteredOrders.some((entry) => String(entry.id) === String(selectedOrderId))) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (!statusNotice?.message) return undefined;
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setStatusNotice(null), 3000);
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, [statusNotice]);

  useRealtimeStream({
    enabled: true,
    streamUrl: getRealtimeStreamUrl(),
    onConnectionChange: setStreamConnected,
    onOrdersUpdated: () => {
      loadOrders({ silent: true });
      if (activeView === "tickets") loadTickets({ silent: true });
    },
    onTicketsUpdated: () => loadTickets({ silent: true }),
  });

  function showNotice(message, tone = "success") {
    setStatusNotice({ message: String(message || "").trim(), tone });
  }

  async function loadOrders(options = {}) {
    const silent = Boolean(options.silent);
    silent ? setIsRefreshing(true) : setOrdersLoading(true);
    try {
      const payload = await fetchOrders(filters);
      setOrders(Array.isArray(payload) ? payload : []);
      setOrdersError("");
    } catch (error) {
      setOrdersError(error.message || "Impossible de charger les commandes.");
    } finally {
      setOrdersLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadTickets(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) setTicketsLoading(true);
    try {
      const payload = await fetchTickets(filters);
      setTickets(Array.isArray(payload) ? payload : []);
      setTicketsError("");
    } catch (error) {
      setTicketsError(error.message || "Impossible de charger les tickets.");
    } finally {
      setTicketsLoading(false);
    }
  }

  async function handleStatusAction(nextStatus) {
    if (!selectedOrder) return;
    try {
      await updateOrderStatus(selectedOrder.id, nextStatus);
      await loadOrders({ silent: true });
      showNotice(nextStatus === "VALIDATE" ? "Commande validee." : "Commande annulee.");
    } catch (error) {
      showNotice(error.message || "Impossible de mettre a jour le statut.", "error");
    }
  }

  async function handleReprintTicket(jobId) {
    try {
      await reprintTicket(jobId);
      await loadTickets({ silent: true });
      showNotice("Ticket ajoute en reimpression.");
    } catch (error) {
      showNotice(error.message || "Impossible de reimprimer ce ticket.", "error");
    }
  }

  async function handleReprintAllFailedTickets() {
    const failedTickets = filteredTickets.filter((entry) => String(entry?.status || "").toUpperCase() === "FAILED");
    if (failedTickets.length === 0) {
      showNotice("Aucun ticket FAILED a reimprimer.", "error");
      return;
    }
    let successCount = 0;
    let failCount = 0;
    setTicketsLoading(true);
    try {
      for (const ticket of failedTickets) {
        try {
          await reprintTicket(ticket.id);
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }
      showNotice(`Reimpression lancee: ${successCount} OK${failCount ? `, ${failCount} en erreur` : ""}`, failCount ? "error" : "success");
      await loadTickets({ silent: true });
    } finally {
      setTicketsLoading(false);
    }
  }

  async function loadOrderBuilderData() {
    setOrderBuilderLoading(true);
    try {
      const [categories, products] = await Promise.all([fetchMenuCategories(), fetchMenuProducts()]);
      const nextCategories = Array.isArray(categories) ? categories : [];
      const nextProducts = Array.isArray(products) ? products : [];
      setMenuCategories(nextCategories);
      setMenuProducts(nextProducts);
      setSelectedMenuCategoryId(nextCategories[0]?.id || null);
      setOrderBuilderError("");
    } catch (error) {
      setOrderBuilderError(error.message || "Impossible de charger le menu admin.");
    } finally {
      setOrderBuilderLoading(false);
    }
  }

  function handleCreateOrder() {
    setIsOrderDetailOpen(false);
    setIsOrderBuilderOpen((current) => !current);
    if (menuCategories.length === 0 || menuProducts.length === 0) {
      loadOrderBuilderData();
    }
  }

  function navigateSelection(step) {
    if (!orderedOrderIds.length || selectedOrderIndex < 0) return;
    const nextIndex = selectedOrderIndex + step;
    if (nextIndex < 0 || nextIndex >= orderedOrderIds.length) return;
    setSelectedOrderId(orderedOrderIds[nextIndex]);
  }

  const selectedWorkflowStatus = normalizeWorkflowStatus(selectedOrder);
  const canValidate = !["VALIDATE", "CANCELED"].includes(selectedWorkflowStatus);
  const canCancel = selectedWorkflowStatus !== "CANCELED";

  return (
    <section className="app-panel app-panel-spaced">
      <div className="panel-card click-collect-v2-card">
        <div className="v2-live-line">
          <p className="eyebrow">Click&Collect</p>
          <p className={streamConnected ? "v2-live-ok" : "v2-live-off"}>
            Flux en direct : {streamConnected ? "connecte" : "inactif"}
          </p>
        </div>

        <section className="click-collect-topbar">
          <button type="button" className={`switcher-pill stretch-pill ${activeView === "orders" ? "active" : ""}`} onClick={() => onChangeView("orders")}>Commandes</button>
          <button type="button" className={`switcher-pill stretch-pill ${activeView === "tickets" ? "active" : ""}`} onClick={() => onChangeView("tickets")}>Tickets</button>
          <div className="date-switcher compact stretch-date-switcher">
            <NavArrow aria-label="Jour precedent" onClick={() => setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, -1) }))} />
            <span>{filters.date}</span>
            <NavArrow direction="right" aria-label="Jour suivant" onClick={() => setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, 1) }))} />
          </div>
        </section>

        {statusNotice?.message ? <p className={statusNotice.tone === "error" ? "inline-error" : "inline-success"}>{statusNotice.message}</p> : null}

        {activeView === "orders" ? (
          <>
            <section className="click-collect-actions-row">
              <button type="button" className="primary-button add-order-button add-order-button-highlight" onClick={handleCreateOrder}>Ajouter une commande</button>
            </section>

            {isOrderBuilderOpen ? (
              <section className="order-builder-card panel-card">
                <div className="column-head">
                  <div><p className="eyebrow">Nouveau ticket</p><h3>Menu categories plats</h3></div>
                  <button type="button" className="ghost-button compact-button" onClick={() => setIsOrderBuilderOpen(false)}>Fermer</button>
                </div>
                {orderBuilderError ? <p className="inline-error">{orderBuilderError}</p> : null}
                {orderBuilderLoading ? <div className="subtle-empty-state">Chargement du menu...</div> : (
                  <>
                    <div className="compact-filter-row category-picker-row">
                      {menuCategories.map((category) => (
                        <button key={category.id} type="button" className={`switcher-pill ${String(selectedMenuCategoryId) === String(category.id) ? "active" : ""}`} onClick={() => setSelectedMenuCategoryId(category.id)}>{category.name}</button>
                      ))}
                    </div>
                    {filteredMenuProducts.length === 0 ? <div className="subtle-empty-state">Aucun plat dans cette categorie.</div> : (
                      <div className="menu-products-list">
                        {filteredMenuProducts.map((product) => (
                          <button key={product.id} type="button" className="menu-product-row" onClick={() => window.open(PUBLIC_ORDER_URL, "_blank", "noopener,noreferrer")}>{product.name}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : (
              <>
                <section className="toolbar app-toolbar panel-card">
                  <label className="search-field"><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Commande, client, telephone..." /></label>
                  <div className="compact-filter-row">
                    <button type="button" className={`switcher-pill status-filter-pill ${filters.status === "IN_PROGRESS" ? "active" : ""}`} onClick={() => setFilters((current) => ({ ...current, status: "IN_PROGRESS" }))}>En cours {statusCounters.COMPLETED}</button>
                    <button type="button" className={`switcher-pill status-filter-pill ${filters.status === "PRINTED" ? "active" : ""}`} onClick={() => setFilters((current) => ({ ...current, status: "PRINTED" }))}>Finalisees {statusCounters.FINALIZED}</button>
                    <button type="button" className={`switcher-pill status-filter-pill ${filters.status === "VALIDATE" ? "active" : ""}`} onClick={() => setFilters((current) => ({ ...current, status: "VALIDATE" }))}>Validees {statusCounters.VALIDATE}</button>
                    <button type="button" className={`switcher-pill status-filter-pill ${filters.status === "CANCELED" ? "active" : ""}`} onClick={() => setFilters((current) => ({ ...current, status: "CANCELED" }))}>Annulees {statusCounters.CANCELED}</button>
                  </div>
                  <button type="button" className="ghost-button compact-button" onClick={() => loadOrders({ silent: true })} disabled={isRefreshing}>{isRefreshing ? "Actualisation..." : "Rafraichir"}</button>
                </section>
                {ordersError ? <p className="inline-error">{ordersError}</p> : null}
                <section className="orders-layout mobile-orders-layout">
                  <section className="orders-column panel-card">
                    <div className="column-head"><div><h3>Commandes a traiter</h3></div><span className="status-pill neutral">{filteredOrders.length} visibles</span></div>
                    {ordersLoading ? <div className="subtle-empty-state">Chargement des commandes...</div> : groupedKeys.length === 0 ? (
                      <div className="subtle-empty-state">{searchQuery ? "Aucune commande ne correspond a cette recherche." : "Aucune commande pour cette date."}</div>
                    ) : groupedKeys.map((slot) => (
                      <section key={slot} className="slot-group">
                        <header className="slot-header"><strong>{slot}</strong><span>{groupedOrders[slot].length} commande(s)</span></header>
                        <div className="slot-orders">
                          {groupedOrders[slot].map((order) => {
                            const workflowStatus = normalizeWorkflowStatus(order);
                            return (
                              <button type="button" key={order.id} className={`order-card ${String(selectedOrderId) === String(order.id) ? "selected" : ""}`} onClick={() => { setSelectedOrderId(order.id); setIsOrderDetailOpen(true); }}>
                                <div className="order-card-head"><strong>{getOrderDisplayName(order)}</strong><span className={`status-pill ${workflowStatus.toLowerCase()}`}>{getStatusLabel(workflowStatus)}</span></div>
                                <div className="order-card-meta"><span>{order.timeSlot?.location?.name || "Lieu non renseigne"}</span><span>{order.timeSlot?.startTime ? formatTimeLabel(order.timeSlot.startTime) : "Heure non renseignee"}</span></div>
                                <p className="muted-copy">{order.items?.length || 0} article(s) · {formatPrice(order.total)}</p>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </section>
                </section>
              </>
            )}

            {isOrderDetailOpen && selectedOrder ? (
              <div className="detail-modal-shell" role="dialog" aria-modal="true">
                <button type="button" className="detail-modal-backdrop" onClick={() => setIsOrderDetailOpen(false)} aria-label="Fermer le detail de commande" />
                <article className="detail-card detail-modal-card">
                  <div className="detail-head">
                    <div className="detail-modal-summary">
                      <h2>Commande #{selectedOrder.id}</h2>
                      <div className="inline-nav">
                        <NavArrow aria-label="Commande precedente" onClick={() => navigateSelection(-1)} disabled={selectedOrderIndex <= 0} />
                        <span>{selectedOrderIndex >= 0 ? `${selectedOrderIndex + 1}/${orderedOrderIds.length}` : "--"}</span>
                        <NavArrow direction="right" aria-label="Commande suivante" onClick={() => navigateSelection(1)} disabled={selectedOrderIndex < 0 || selectedOrderIndex >= orderedOrderIds.length - 1} />
                      </div>
                    </div>
                    <div className="detail-head-actions"><NavArrow aria-label="Fermer le detail de commande" onClick={() => setIsOrderDetailOpen(false)} /></div>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-block"><span>Client</span><strong>{getOrderDisplayName(selectedOrder)}</strong><p>{selectedOrder.user?.phone || selectedOrder.user?.email || "Contact non renseigne"}</p></div>
                    <div className="detail-block"><span>Retrait</span><strong>{selectedOrder.timeSlot?.location?.name || "Lieu non renseigne"}</strong><p>{selectedOrder.timeSlot?.startTime ? formatTimeLabel(selectedOrder.timeSlot.startTime) : "Creneau non renseigne"}</p></div>
                  </div>
                  <div className="detail-items">
                    {(selectedOrder.items || []).map((item) => (
                      <div key={item.id} className="detail-item-row">
                        <div>
                          <strong>{item.quantity}x {item.product?.name || "Produit"}</strong>
                          {item.addedIngredients?.length ? <p>+ {item.addedIngredients.map((entry) => entry.name).join(", ")}</p> : null}
                          {item.removedIngredients?.length ? <p>- {item.removedIngredients.map((entry) => entry.name).join(", ")}</p> : null}
                        </div>
                        <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="detail-footer">
                    {selectedOrder.customerNote ? <div className="detail-block compact-detail-block"><span>Note</span><p>{selectedOrder.customerNote}</p></div> : null}
                    <div className="detail-block compact-detail-block"><span>Total</span><strong>{formatPrice(selectedOrder.total)}</strong></div>
                  </div>
                  <div className="action-row">
                    {canValidate ? <button type="button" className="primary-button action-button-main" onClick={() => handleStatusAction("VALIDATE")}>Valider la commande</button> : null}
                    {canCancel ? <button type="button" className="danger-button action-button-cancel" onClick={() => handleStatusAction("CANCELED")}>Annuler la commande</button> : null}
                  </div>
                </article>
              </div>
            ) : null}
          </>
        ) : null}

        {activeView === "tickets" ? (
          <section className="stack-layout">
            <section className="panel-card ticket-summary-panel">
              <div className="ticket-summary-grid">
                <article className="ticket-summary-card ticket-summary-card-error"><span>Erreurs ticket</span><strong>{ticketCounters.error}</strong></article>
                <article className="ticket-summary-card ticket-summary-card-warning"><span>A surveiller</span><strong>{ticketCounters.warning}</strong></article>
                <article className="ticket-summary-card ticket-summary-card-healthy"><span>OK / reimprimable</span><strong>{ticketCounters.healthy}</strong></article>
                <article className="ticket-summary-card ticket-summary-card-neutral"><span>Tickets visibles</span><strong>{filteredTickets.length}</strong></article>
              </div>
              <div className="ticket-summary-actions">
                <button type="button" className="ghost-button compact-button ticket-bulk-reprint-button" onClick={handleReprintAllFailedTickets} disabled={ticketsLoading}>{ticketsLoading ? "Reimpression..." : "Reimprimer tous les failed"}</button>
              </div>
            </section>
            <section className="toolbar app-toolbar panel-card">
              <label className="search-field"><input type="search" value={ticketSearchQuery} onChange={(event) => setTicketSearchQuery(event.target.value)} placeholder="Commande, imprimante, client..." /></label>
              <select className="filter-select" value={ticketFilter} onChange={(event) => setTicketFilter(event.target.value)}>
                <option value="attention">Prioritaires</option>
                <option value="error">Erreurs</option>
                <option value="healthy">OK</option>
                <option value="all">Tous</option>
              </select>
              <button type="button" className="ghost-button compact-button" onClick={() => loadTickets({ silent: true })} disabled={ticketsLoading}>{ticketsLoading ? "Actualisation..." : "Rafraichir"}</button>
            </section>
            {ticketsError ? <p className="inline-error">{ticketsError}</p> : null}
            {ticketsLoading && tickets.length === 0 ? <div className="panel-card">Chargement des tickets...</div> : filteredTickets.length === 0 ? (
              <div className="panel-card">Aucun ticket dans cette vue.</div>
            ) : (
              <div className="stack-list">
                {filteredTickets.map((ticket) => {
                  const state = getTicketMonitorState(ticket?.status);
                  const canReprint = ["PRINTED", "FAILED", "RETRY_WAITING"].includes(String(ticket?.status || "").toUpperCase());
                  return (
                    <article key={ticket.id} className={`panel-card compact-card ticket-card ticket-card-${state}`}>
                      <div className="order-card-head">
                        <div><strong>Commande #{ticket.orderId}</strong><p className="muted-copy">{ticket?.printer?.code || "Imprimante -"} · {ticket?.order?.user?.name || ticket?.order?.user?.firstName || "Client"}</p></div>
                        <div className="ticket-badges">
                          <span className={`status-pill ${getTicketStatusClass(ticket.status)}`}>{getTicketStatusLabel(ticket.status)}</span>
                          <span className="status-pill neutral">{getTicketMonitorLabel(state)}</span>
                        </div>
                      </div>
                      <p className="muted-copy">{ticket?.order?.timeSlot?.location?.name || "Lieu non renseigne"} - {ticket?.order?.timeSlot?.startTime ? formatTimeLabel(ticket.order.timeSlot.startTime) : "Heure non renseignee"}</p>
                      {ticket?.lastErrorMessage ? <p className="inline-error">{ticket.lastErrorMessage}</p> : null}
                      <div className="action-row"><button type="button" className="ghost-button" onClick={() => handleReprintTicket(ticket.id)} disabled={!canReprint}>Reimprimer</button></div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </section>
  );
}
