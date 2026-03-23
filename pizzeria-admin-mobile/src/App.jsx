import { useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME, REALTIME_STREAM_URL } from "./config";
import { clearCsrfToken } from "./lib/api";
import { fetchMe, login, logout } from "./lib/api/auth";
import { fetchCustomers } from "./lib/api/customers";
import {
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "./lib/api/notifications";
import { fetchOrders, updateOrderStatus } from "./lib/api/orders";
import { reprintTicket, fetchTickets } from "./lib/api/tickets";
import {
  formatPrice,
  formatTimeLabel,
  getOrderDisplayName,
  getStatusLabel,
  normalizeWorkflowStatus,
  shiftIsoDate,
  toIsoDate,
} from "./lib/formatters";
import {
  buildStatusCounters,
  groupOrdersBySlot,
  matchesCustomerQuery,
  matchesOrderQuery,
  matchesStatusFilter,
  matchesTicketQuery,
} from "./utils/filterUtils";
import {
  formatCustomerDisplayName,
  getPushStateLabel,
  getTicketMonitorLabel,
  getTicketMonitorState,
  getTicketStatusClass,
  getTicketStatusLabel,
} from "./utils/formatters";
import { isIosDevice, isStandaloneDisplay, urlBase64ToUint8Array } from "./utils/pushUtils";
import { useRealtimeStream } from "./hooks/useRealtimeStream";
import { useSessionHeartbeat } from "./hooks/useSessionHeartbeat";

export default function App() {
  const [session, setSession] = useState({ state: "loading", user: null });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ticketsError, setTicketsError] = useState("");
  const [customersError, setCustomersError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSearchQuery, setTicketSearchQuery] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState("attention");
  const [filters, setFilters] = useState({
    date: toIsoDate(),
    status: "IN_PROGRESS",
  });
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [pushState, setPushState] = useState("idle");
  const [streamConnected, setStreamConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const seenOrderIdsRef = useRef(new Set());
  const snapshotReadyRef = useRef(false);
  const pendingOrderIdRef = useRef(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("orderId")
      : null
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (entry) =>
          matchesStatusFilter(entry, filters.status) && matchesOrderQuery(entry, searchQuery)
      ),
    [orders, filters.status, searchQuery]
  );

  const selectedOrder = useMemo(
    () =>
      filteredOrders.find((entry) => String(entry.id) === String(selectedOrderId)) ||
      filteredOrders[0] ||
      null,
    [filteredOrders, selectedOrderId]
  );

  const groupedOrders = useMemo(() => groupOrdersBySlot(filteredOrders), [filteredOrders]);
  const groupedKeys = useMemo(() => Object.keys(groupedOrders).sort((left, right) => left.localeCompare(right)), [groupedOrders]);
  const statusCounters = useMemo(() => buildStatusCounters(orders), [orders]);
  const orderedOrderIds = useMemo(() => filteredOrders.map((entry) => String(entry.id)), [filteredOrders]);
  const selectedOrderIndex = useMemo(
    () => orderedOrderIds.findIndex((entry) => entry === String(selectedOrder?.id || "")),
    [orderedOrderIds, selectedOrder]
  );
  const shouldShowIosInstallHelp = isIosDevice() && !isStandaloneDisplay();
  const filteredTickets = useMemo(() => {
    const filteredBySearch = tickets.filter((entry) => matchesTicketQuery(entry, ticketSearchQuery));
    if (ticketFilter === "all") return filteredBySearch;
    if (ticketFilter === "error") {
      return filteredBySearch.filter((entry) => getTicketMonitorState(entry?.status) === "error");
    }
    if (ticketFilter === "healthy") {
      return filteredBySearch.filter((entry) => getTicketMonitorState(entry?.status) === "healthy");
    }
    return filteredBySearch.filter((entry) => {
      const state = getTicketMonitorState(entry?.status);
      return state === "error" || state === "warning";
    });
  }, [ticketFilter, ticketSearchQuery, tickets]);
  const filteredCustomers = useMemo(
    () => customers.filter((entry) => matchesCustomerQuery(entry, customerSearchQuery)),
    [customerSearchQuery, customers]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setPushState("unsupported");
      return;
    }
    setNotificationPermission(window.Notification.permission);
    if (!("serviceWorker" in window.navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    setPushState("available");
  }, []);

  async function bootstrapSession() {
    try {
      const me = await fetchMe();
      if (me?.role !== "ADMIN") {
        setSession({ state: "unauthorized", user: me || null });
        return;
      }
      setSession({ state: "authenticated", user: me });
    } catch (_error) {
      setSession({ state: "anonymous", user: null });
    }
  }

  async function refreshAuthenticatedSession(options = {}) {
    const { quiet = true } = options;

    try {
      const me = await fetchMe();
      if (me?.role !== "ADMIN") {
        setSession({ state: "unauthorized", user: me || null });
        return false;
      }

      setSession((current) => ({
        state: "authenticated",
        user: me || current.user,
      }));
      return true;
    } catch (error) {
      if (!quiet) {
        setStatusMessage(error.message || "Session admin indisponible.");
      }

      if (error?.status === 401) {
        clearCsrfToken();
        setSession({ state: "anonymous", user: null });
        setOrders([]);
        setSelectedOrderId(null);
        setStatusMessage("Session expiree, reconnectez-vous.");
      }

      return false;
    }
  }

  useEffect(() => {
    bootstrapSession();
  }, []);

  async function loadOrders(options = {}) {
    if (session.state !== "authenticated") return;
    const silent = Boolean(options.silent);
    if (silent) {
      setIsRefreshing(true);
    } else {
      setOrdersLoading(true);
    }

    try {
      const payload = await fetchOrders(filters);
      const nextOrders = Array.isArray(payload) ? payload : [];
      const nextIds = new Set(nextOrders.map((order) => String(order.id)));

      if (!snapshotReadyRef.current) {
        snapshotReadyRef.current = true;
        seenOrderIdsRef.current = nextIds;
      } else {
        const freshOrders = nextOrders.filter(
          (order) => !seenOrderIdsRef.current.has(String(order.id))
        );
        if (freshOrders.length > 0) {
          setStatusMessage(
            freshOrders.length === 1
              ? `Nouvelle commande recue : #${freshOrders[0].id}`
              : `${freshOrders.length} nouvelles commandes recues.`
          );
        }
        seenOrderIdsRef.current = nextIds;
      }

      setOrders(nextOrders);
      setSelectedOrderId((current) => {
        if (
          pendingOrderIdRef.current &&
          nextOrders.some((entry) => String(entry.id) === String(pendingOrderIdRef.current))
        ) {
          const matchedId = pendingOrderIdRef.current;
          pendingOrderIdRef.current = null;
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("orderId");
            window.history.replaceState({}, "", url.toString());
          }
          return matchedId;
        }
        if (current && nextOrders.some((entry) => String(entry.id) === String(current))) {
          return current;
        }
        return nextOrders[0]?.id || null;
      });
      setOrdersError("");
    } catch (error) {
      setOrdersError(error.message || "Impossible de charger les commandes.");
    } finally {
      setOrdersLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadTickets(options = {}) {
    if (session.state !== "authenticated") return;
    const silent = Boolean(options.silent);
    if (!silent) {
      setTicketsLoading(true);
    }

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

  async function loadCustomers(options = {}) {
    if (session.state !== "authenticated") return;
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

  useEffect(() => {
    snapshotReadyRef.current = false;
    seenOrderIdsRef.current = new Set();
  }, [filters.date]);

  useEffect(() => {
    if (session.state === "authenticated") {
      loadOrders();
    }
  }, [session.state, filters.date]);

  useEffect(() => {
    if (session.state === "authenticated" && activeMenu === "tickets") {
      loadTickets();
    }
  }, [activeMenu, session.state, filters.date]);

  useEffect(() => {
    if (session.state === "authenticated" && activeMenu === "customers" && customers.length === 0) {
      loadCustomers();
    }
  }, [activeMenu, customers.length, session.state]);

  useSessionHeartbeat(session.state === "authenticated", () => {
    refreshAuthenticatedSession();
  });

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
    if (
      session.state !== "authenticated" ||
      notificationPermission !== "granted" ||
      typeof window === "undefined" ||
      !("serviceWorker" in window.navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    let cancelled = false;

    async function syncExistingSubscription() {
      try {
        const registration = await window.navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          if (!cancelled) {
            setPushState("available");
          }
          return;
        }

        await savePushSubscription(subscription.toJSON());
        if (!cancelled) {
          setPushState("subscribed");
        }
      } catch (_error) {
        if (!cancelled) {
          setPushState("available");
        }
      }
    }

    syncExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, [session.state, notificationPermission]);

  useRealtimeStream({
    enabled: session.state === "authenticated",
    streamUrl: REALTIME_STREAM_URL,
    onConnectionChange: setStreamConnected,
    onOrdersUpdated: () => {
      loadOrders({ silent: true });
      if (activeMenu === "tickets") {
        loadTickets({ silent: true });
      }
    },
  });

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");

    try {
      await login(loginForm.email, loginForm.password);
      const me = await fetchMe();
      if (me?.role !== "ADMIN") {
        setSession({ state: "unauthorized", user: me || null });
        return;
      }
      setSession({ state: "authenticated", user: me });
    } catch (error) {
      setLoginError(error.message || "Connexion impossible.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in window.navigator &&
      "PushManager" in window
    ) {
      try {
        const registration = await window.navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
      } catch (_error) {
        // no-op
      }
    }

    try {
      await logout();
    } catch (_error) {
      // no-op
    } finally {
      clearCsrfToken();
      setSession({ state: "anonymous", user: null });
      setOrders([]);
      setTickets([]);
      setCustomers([]);
      setSelectedOrderId(null);
    }
  }

  async function handleStatusAction(nextStatus) {
    if (!selectedOrder) return;
    try {
      setStatusMessage("");
      await updateOrderStatus(selectedOrder.id, nextStatus);
      await loadOrders({ silent: true });
      setStatusMessage(
        nextStatus === "FINALIZED"
          ? "Commande terminee."
          : nextStatus === "VALIDATE"
            ? "Commande validee et mail client declenche."
            : nextStatus === "CANCELED"
              ? "Commande annulee."
              : "Statut de commande mis a jour."
      );
    } catch (error) {
      setStatusMessage(error.message || "Impossible de mettre a jour le statut.");
    }
  }

  function navigateSelection(step) {
    if (!orderedOrderIds.length || selectedOrderIndex < 0) return;
    const nextIndex = selectedOrderIndex + step;
    if (nextIndex < 0 || nextIndex >= orderedOrderIds.length) return;
    setSelectedOrderId(orderedOrderIds[nextIndex]);
  }

  async function handleEnableNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in window.navigator) ||
      !("PushManager" in window)
    ) {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "denied") {
        setPushState("denied");
        setStatusMessage(
          "Notifications refusees par le navigateur. Si besoin, reautorise-les depuis les reglages du site ou de l'iPhone."
        );
        return;
      }
      if (permission !== "granted") {
        setPushState("available");
        setStatusMessage("Autorisation notifications non accordee.");
        return;
      }

      setPushState("subscribing");
      const registration = await window.navigator.serviceWorker.ready;
      const vapidConfig = await getPushPublicKey();
      if (!vapidConfig?.enabled || !vapidConfig?.publicKey) {
        throw new Error("Web push non configure cote backend.");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidConfig.publicKey),
        });
      }

      await savePushSubscription(subscription.toJSON());
      setPushState("subscribed");
      setStatusMessage("Notifications push activees pour les nouvelles commandes.");
    } catch (error) {
      setPushState("error");
      setStatusMessage(
        error?.message ||
          "Autorisation accordee, mais l'abonnement push a echoue. Verifie la configuration backend web push."
      );
    }
  }

  async function handleReprintTicket(jobId) {
    try {
      setStatusMessage("");
      await reprintTicket(jobId);
      await loadTickets({ silent: true });
      setStatusMessage("Ticket ajoute en reimpression.");
    } catch (error) {
      setStatusMessage(error.message || "Impossible de reimprimer ce ticket.");
    }
  }

  function scrollToTop() {
    if (typeof window === "undefined") return;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
    try {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    } catch (_error) {
      window.scrollTo(0, 0);
    }
  }

  function handleMenuChange(nextMenu) {
    setActiveMenu(nextMenu);
    scrollToTop();
  }

  if (session.state === "loading") {
    return <div className="screen-center">Chargement de l'application admin...</div>;
  }

  if (session.state === "anonymous" || session.state === "unauthorized") {
    return (
      <main className="app-shell login-shell">
        <section className="login-card">
          <div className="brand-lockup">
            <img src="/icon.svg" alt="" className="brand-icon" />
            <div>
              <p className="eyebrow">Application web mobile admin / PWA</p>
              <h1>{APP_NAME}</h1>
            </div>
          </div>

          <p className="intro-copy">
            Connecte-toi pour acceder directement aux commandes, au detail d'une commande et a la mise a jour de statut depuis l'ecran d'accueil de l'iPhone.
          </p>

          {session.state === "unauthorized" ? (
            <p className="inline-error">Ce compte est connecte mais n'a pas le role admin.</p>
          ) : null}

          <form className="login-form" onSubmit={handleLoginSubmit}>
            <label>
              <span>Email admin</span>
              <input
                type="email"
                autoComplete="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="admin@site.fr"
                required
              />
            </label>

            <label>
              <span>Mot de passe</span>
              <input
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="********"
                required
              />
            </label>

            {loginError ? <p className="inline-error">{loginError}</p> : null}

            <button type="submit" className="primary-button" disabled={loggingIn}>
              {loggingIn ? "Connexion..." : "Entrer dans l'admin"}
            </button>
          </form>

          <div className="hint-card">
            <strong>Sur iPhone</strong>
            <p>Safari {"->"} Partager {"->"} Ajouter a l'ecran d'accueil, puis lance l'app depuis l'icone.</p>
          </div>
        </section>
      </main>
    );
  }

  const selectedWorkflowStatus = normalizeWorkflowStatus(selectedOrder);
  const canValidate = !["VALIDATE", "CANCELED"].includes(selectedWorkflowStatus);
  const canCancel = selectedWorkflowStatus !== "CANCELED";
  return (
    <main className="app-shell">
      <section className="content">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Admin mobile</p>
            <h1>Gestion rapide</h1>
            <p className="topbar-copy">{session.user?.email || session.user?.name}</p>
          </div>
          <div className="topbar-actions">
            <div className="date-switcher compact">
              <button type="button" className="ghost-icon-button" onClick={() => setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, -1) }))}>
                &lt;
              </button>
              <span>{filters.date}</span>
              <button type="button" className="ghost-icon-button" onClick={() => setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, 1) }))}>
                &gt;
              </button>
            </div>
            <button type="button" className="ghost-button compact-button" onClick={handleLogout}>
              Sortir
            </button>
          </div>
        </header>

        <section className="status-strip">
          <div className="status-strip-item">
            <span>TEMPS REEL</span>
            <strong className={`status-pill ${streamConnected ? "success" : "warning"}`}>
              {streamConnected ? "Connecte" : "Reconnexion"}
            </strong>
          </div>
          <div className="status-strip-item">
            <span>Notifications</span>
            <strong className={`status-pill ${pushState === "subscribed" ? "success" : "neutral"}`}>
              {getPushStateLabel(pushState)}
            </strong>
          </div>
          {pushState !== "subscribed" ? (
            <button type="button" className="ghost-button compact-button" onClick={handleEnableNotifications}>
              Activer le push
            </button>
          ) : null}
        </section>

        <section className="mobile-menu-switcher compact-switcher">
          <button
            type="button"
            className={`switcher-pill ${activeMenu === "orders" ? "active" : ""}`}
            onClick={() => handleMenuChange("orders")}
          >
            Commandes
          </button>
          <button
            type="button"
            className={`switcher-pill ${activeMenu === "tickets" ? "active" : ""}`}
            onClick={() => handleMenuChange("tickets")}
          >
            Tickets
          </button>
          <button
            type="button"
            className={`switcher-pill ${activeMenu === "customers" ? "active" : ""}`}
            onClick={() => handleMenuChange("customers")}
          >
            Clients
          </button>
        </section>

        {shouldShowIosInstallHelp ? (
          <section className="install-card compact-install-card">
            <strong>Installer l'app sur iPhone</strong>
            <p>Ouvre le site dans Safari, touche Partager puis Ajouter a l'ecran d'accueil. L'app s'ouvrira ensuite comme une vraie appli admin.</p>
          </section>
        ) : null}

        <section className="toolbar">
          {activeMenu === "orders" ? (
            <>
              <label className="search-field">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Commande, client, telephone..."
                />
              </label>

              <div className="compact-filter-row">
                <button
                  type="button"
                  className={`switcher-pill ${filters.status === "IN_PROGRESS" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, status: "IN_PROGRESS" }))}
                >
                  En cours {statusCounters.COMPLETED}
                </button>
                <button
                  type="button"
                  className={`switcher-pill ${filters.status === "PRINTED" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, status: "PRINTED" }))}
                >
                  Finalisees {statusCounters.FINALIZED}
                </button>
                <button
                  type="button"
                  className={`switcher-pill ${filters.status === "VALIDATE" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, status: "VALIDATE" }))}
                >
                  Validees {statusCounters.VALIDATE}
                </button>
                <button
                  type="button"
                  className={`switcher-pill ${filters.status === "CANCELED" ? "active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, status: "CANCELED" }))}
                >
                  Annulees {statusCounters.CANCELED}
                </button>
              </div>

              <button type="button" className="ghost-button compact-button" onClick={() => loadOrders({ silent: true })} disabled={isRefreshing}>
                {isRefreshing ? "Actualisation..." : "Rafraichir"}
              </button>
            </>
          ) : null}

          {activeMenu === "tickets" ? (
            <>
              <label className="search-field">
                <input
                  type="search"
                  value={ticketSearchQuery}
                  onChange={(event) => setTicketSearchQuery(event.target.value)}
                  placeholder="Commande, imprimante, client..."
                />
              </label>

              <select className="filter-select" value={ticketFilter} onChange={(event) => setTicketFilter(event.target.value)}>
                <option value="attention">Prioritaires</option>
                <option value="error">Erreurs</option>
                <option value="healthy">OK</option>
                <option value="all">Tous</option>
              </select>

              <button type="button" className="ghost-button compact-button" onClick={() => loadTickets({ silent: true })} disabled={ticketsLoading}>
                {ticketsLoading ? "Actualisation..." : "Rafraichir"}
              </button>
            </>
          ) : null}

          {activeMenu === "customers" ? (
            <>
              <label className="search-field">
                <input
                  type="search"
                  value={customerSearchQuery}
                  onChange={(event) => setCustomerSearchQuery(event.target.value)}
                  placeholder="Nom, prenom, numero ou email..."
                />
              </label>

              <button type="button" className="ghost-button compact-button" onClick={() => loadCustomers({ silent: true })} disabled={customersLoading}>
                {customersLoading ? "Actualisation..." : "Rafraichir"}
              </button>
            </>
          ) : null}
        </section>

        {activeMenu === "orders" && ordersError ? <p className="inline-error">{ordersError}</p> : null}
        {activeMenu === "tickets" && ticketsError ? <p className="inline-error">{ticketsError}</p> : null}
        {activeMenu === "customers" && customersError ? <p className="inline-error">{customersError}</p> : null}
        {statusMessage ? <p className="inline-success">{statusMessage}</p> : null}

        {activeMenu === "orders" ? (
        <section className="orders-layout">
          <div className="orders-column">
            {ordersLoading ? (
              <div className="panel-card">Chargement des commandes...</div>
            ) : groupedKeys.length === 0 ? (
              <div className="panel-card">
                {searchQuery ? "Aucune commande ne correspond a cette recherche." : "Aucune commande pour cette date."}
              </div>
            ) : (
              groupedKeys.map((slot) => (
                <section key={slot} className="slot-group">
                  <header className="slot-header">
                    <strong>{slot}</strong>
                    <span>{groupedOrders[slot].length} commande(s)</span>
                  </header>
                  <div className="slot-orders">
                    {groupedOrders[slot].map((order) => {
                      const workflowStatus = normalizeWorkflowStatus(order);
                      return (
                        <button
                          type="button"
                          key={order.id}
                          className={`order-card ${String(selectedOrderId) === String(order.id) ? "selected" : ""}`}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <div className="order-card-head">
                            <strong>{getOrderDisplayName(order)}</strong>
                            <span className={`status-pill ${workflowStatus.toLowerCase()}`}>{getStatusLabel(workflowStatus)}</span>
                          </div>
                          <p>{order.timeSlot?.location?.name || "Lieu non renseigne"}</p>
                          <p>{order.timeSlot?.startTime ? formatTimeLabel(order.timeSlot.startTime) : "Heure non renseignee"}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          <div className="details-column">
            {!selectedOrder ? (
              <div className="panel-card">Selectionne une commande pour voir son detail.</div>
            ) : (
              <article className="detail-card">
                <div className="detail-head">
                  <div>
                    <p className="eyebrow">Detail commande</p>
                    <h2>Commande #{selectedOrder.id}</h2>
                  </div>
                  <div className="detail-head-actions">
                    <div className="inline-nav">
                      <button
                        type="button"
                        className="ghost-icon-button"
                        onClick={() => navigateSelection(-1)}
                        disabled={selectedOrderIndex <= 0}
                      >
                        &lt;
                      </button>
                      <span>
                        {selectedOrderIndex >= 0 ? `${selectedOrderIndex + 1}/${orderedOrderIds.length}` : "--"}
                      </span>
                      <button
                        type="button"
                        className="ghost-icon-button"
                        onClick={() => navigateSelection(1)}
                        disabled={selectedOrderIndex < 0 || selectedOrderIndex >= orderedOrderIds.length - 1}
                      >
                        &gt;
                      </button>
                    </div>
                    <span className={`status-pill ${selectedWorkflowStatus.toLowerCase()}`}>{getStatusLabel(selectedWorkflowStatus)}</span>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-block">
                    <span>Client</span>
                    <strong>{getOrderDisplayName(selectedOrder)}</strong>
                  </div>

                  <div className="detail-block">
                    <span>Retrait</span>
                    <strong>{selectedOrder.timeSlot?.location?.name || "Lieu non renseigne"}</strong>
                    <p>
                      {selectedOrder.timeSlot?.startTime
                        ? formatTimeLabel(selectedOrder.timeSlot.startTime)
                        : "Creneau non renseigne"}
                    </p>
                  </div>
                </div>

                <div className="detail-items">
                  {(selectedOrder.items || []).map((item) => (
                    <div key={item.id} className="detail-item-row">
                      <div>
                        <strong>{item.quantity}x {item.product?.name || "Produit"}</strong>
                        {item.addedIngredients?.length ? (
                          <p>+ {item.addedIngredients.map((entry) => entry.name).join(", ")}</p>
                        ) : null}
                        {item.removedIngredients?.length ? (
                          <p>- {item.removedIngredients.map((entry) => entry.name).join(", ")}</p>
                        ) : null}
                      </div>
                      <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="detail-footer">
                  {selectedOrder.customerNote ? (
                    <div className="detail-block compact-detail-block">
                      <span>Note</span>
                      <p>{selectedOrder.customerNote}</p>
                    </div>
                  ) : null}
                  <div className="detail-block compact-detail-block">
                    <span>Total</span>
                    <strong>{formatPrice(selectedOrder.total)}</strong>
                  </div>
                </div>

                <div className="action-row">
                  {canValidate ? (
                    <button type="button" className="primary-button action-button-main" onClick={() => handleStatusAction("VALIDATE")}>
                      Valider la commande
                    </button>
                  ) : null}
                  {canCancel ? (
                    <button type="button" className="danger-button action-button-cancel" onClick={() => handleStatusAction("CANCELED")}>
                      Annuler la commande
                    </button>
                  ) : null}
                </div>
              </article>
            )}
          </div>
        </section>
        ) : null}

        {activeMenu === "tickets" ? (
          <section className="stack-layout">
            {ticketsLoading && tickets.length === 0 ? (
              <div className="panel-card">Chargement des tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="panel-card">Aucun ticket dans cette vue.</div>
            ) : (
              <div className="stack-list">
                {filteredTickets.map((ticket) => {
                  const state = getTicketMonitorState(ticket?.status);
                  const canReprint = ["PRINTED", "FAILED", "RETRY_WAITING"].includes(
                    String(ticket?.status || "").toUpperCase()
                  );
                  return (
                    <article key={ticket.id} className={`panel-card compact-card ticket-card ticket-card-${state}`}>
                      <div className="order-card-head">
                        <div>
                          <strong>Commande #{ticket.orderId}</strong>
                          <p className="muted-copy">
                            {ticket?.printer?.code || "Imprimante -"} · {ticket?.order?.user?.name || ticket?.order?.user?.firstName || "Client"}
                          </p>
                        </div>
                        <div className="ticket-badges">
                          <span className={`status-pill ${getTicketStatusClass(ticket.status)}`}>
                            {getTicketStatusLabel(ticket.status)}
                          </span>
                          <span className="status-pill neutral">{getTicketMonitorLabel(state)}</span>
                        </div>
                      </div>
                      <p className="muted-copy">
                        {ticket?.order?.timeSlot?.location?.name || "Lieu non renseigne"} -{" "}
                        {ticket?.order?.timeSlot?.startTime ? formatTimeLabel(ticket.order.timeSlot.startTime) : "Heure non renseignee"}
                      </p>
                      {ticket?.lastErrorMessage ? (
                        <p className="inline-error">{ticket.lastErrorMessage}</p>
                      ) : null}
                      <div className="action-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleReprintTicket(ticket.id)}
                          disabled={!canReprint}
                        >
                          Reimprimer
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {activeMenu === "customers" ? (
          <section className="stack-layout">
            {customersLoading && customers.length === 0 ? (
              <div className="panel-card">Chargement des clients...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="panel-card">Aucun client ne correspond a cette recherche.</div>
            ) : (
              <div className="stack-list">
                {filteredCustomers.map((customer) => (
                  <article key={customer.id} className="panel-card compact-card customer-card">
                    <strong>{formatCustomerDisplayName(customer)}</strong>
                    <p className="muted-copy">{customer.phone || "Numero non renseigne"}</p>
                    <p className="muted-copy">{customer.email || "Email non renseigne"}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
