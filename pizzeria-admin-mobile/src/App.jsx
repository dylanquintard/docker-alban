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
import { fetchTickets, reprintTicket } from "./lib/api/tickets";
import {
  formatPrice,
  formatTimeLabel,
  getOrderDisplayName,
  getStatusLabel,
  normalizeWorkflowStatus,
  shiftIsoDate,
  toIsoDate,
} from "./lib/formatters";
import { useRealtimeStream } from "./hooks/useRealtimeStream";
import { useSessionHeartbeat } from "./hooks/useSessionHeartbeat";
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

const APP_ICONS = {
  launcher: "OS",
  clickCollect: "CC",
  customerInfo: "CI",
};

const APP_LOGOS = {
  clickCollect: "/logo_click_collect.png",
  customerInfo: "/logo_infos_clients.png",
};

const MENU_ICON = "/params.png";

const APP_COPY = {
  clickCollect: {
    title: "Click&Collect",
    subtitle: "Commandes & tickets",
    description:
      "Tout ce qu'il faut pour suivre la file, valider les commandes et relancer les impressions.",
  },
  customerInfo: {
    title: "Infos Clients",
    subtitle: "Contacts & recherche",
    description:
      "Retrouvez rapidement les clients et leurs infos utiles deja presentes quand le service accelere.",
  },
};

function AppLauncherIcon({ alt, fallback, muted = false, src }) {
  const [hasError, setHasError] = useState(false);

  return (
    <span className={`app-icon-badge ${muted ? "app-icon-badge-muted" : ""}`}>
      {!hasError && src ? (
        <img
          src={src}
          alt={alt}
          className="app-icon-image"
          onError={() => setHasError(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

function MenuTriggerIcon() {
  const [hasError, setHasError] = useState(false);

  return !hasError ? (
    <img
      src={MENU_ICON}
      alt="Ouvrir le menu"
      className="menu-trigger-image"
      onError={() => setHasError(true)}
    />
  ) : (
    <span className="menu-trigger-fallback" aria-hidden="true">
      ≡
    </span>
  );
}

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
  const [activeApp, setActiveApp] = useState("launcher");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [clickCollectSection, setClickCollectSection] = useState("orders");
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
    [filters.status, orders, searchQuery]
  );

  const selectedOrder = useMemo(
    () =>
      filteredOrders.find((entry) => String(entry.id) === String(selectedOrderId)) ||
      filteredOrders[0] ||
      null,
    [filteredOrders, selectedOrderId]
  );

  const groupedOrders = useMemo(() => groupOrdersBySlot(filteredOrders), [filteredOrders]);
  const groupedKeys = useMemo(
    () => Object.keys(groupedOrders).sort((left, right) => left.localeCompare(right)),
    [groupedOrders]
  );
  const statusCounters = useMemo(() => buildStatusCounters(orders), [orders]);
  const orderedOrderIds = useMemo(
    () => filteredOrders.map((entry) => String(entry.id)),
    [filteredOrders]
  );
  const selectedOrderIndex = useMemo(
    () => orderedOrderIds.findIndex((entry) => entry === String(selectedOrder?.id || "")),
    [orderedOrderIds, selectedOrder]
  );
  const shouldShowIosInstallHelp = isIosDevice() && !isStandaloneDisplay();
  const filteredTickets = useMemo(() => {
    const filteredBySearch = tickets.filter((entry) =>
      matchesTicketQuery(entry, ticketSearchQuery)
    );
    if (ticketFilter === "all") return filteredBySearch;
    if (ticketFilter === "error") {
      return filteredBySearch.filter((entry) => getTicketMonitorState(entry?.status) === "error");
    }
    if (ticketFilter === "healthy") {
      return filteredBySearch.filter(
        (entry) => getTicketMonitorState(entry?.status) === "healthy"
      );
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
  const ticketCounters = useMemo(
    () =>
      tickets.reduce(
        (accumulator, entry) => {
          const state = getTicketMonitorState(entry?.status);
          accumulator.total += 1;
          accumulator[state] += 1;
          return accumulator;
        },
        { total: 0, error: 0, warning: 0, healthy: 0 }
      ),
    [tickets]
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

  useEffect(() => {
    bootstrapSession();
  }, []);

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
    if (
      session.state === "authenticated" &&
      activeApp === "clickCollect" &&
      clickCollectSection === "tickets"
    ) {
      loadTickets();
    }
  }, [activeApp, clickCollectSection, session.state, filters.date]);

  useEffect(() => {
    if (session.state === "authenticated" && activeApp === "customerInfo" && customers.length === 0) {
      loadCustomers();
    }
  }, [activeApp, customers.length, session.state]);

  useSessionHeartbeat(session.state === "authenticated", () => {
    refreshAuthenticatedSession();
  });

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId(null);
      return;
    }

    if (
      !selectedOrderId ||
      !filteredOrders.some((entry) => String(entry.id) === String(selectedOrderId))
    ) {
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
  }, [notificationPermission, session.state]);

  useRealtimeStream({
    enabled: session.state === "authenticated",
    streamUrl: REALTIME_STREAM_URL,
    onConnectionChange: setStreamConnected,
    onOrdersUpdated: () => {
      loadOrders({ silent: true });
      if (activeApp === "clickCollect" && clickCollectSection === "tickets") {
        loadTickets({ silent: true });
      }
    },
  });

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
      setActiveApp("launcher");
      setIsMenuOpen(false);
      setClickCollectSection("orders");
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

  function handleOpenApp(nextApp, options = {}) {
    setActiveApp(nextApp);
    setIsMenuOpen(false);
    if (nextApp === "clickCollect" && options.section) {
      setClickCollectSection(options.section);
    }
    scrollToTop();
  }

  function handleHomeNavigation() {
    setActiveApp("launcher");
    setIsMenuOpen(false);
    scrollToTop();
  }

  function handleClickCollectSectionChange(nextSection) {
    setClickCollectSection(nextSection);
    scrollToTop();
  }

  function toggleMenu() {
    setIsMenuOpen((current) => !current);
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
              <p className="eyebrow">Application mobile admin</p>
              <h1>{APP_NAME}</h1>
            </div>
          </div>

          <p className="intro-copy">
            Connecte-toi pour retrouver un vrai poste mobile de service: home screen, app
            Click&Collect et app Infos Clients dans une interface pensee pour le terrain.
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
                autoComplete="current-password"
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
              {loggingIn ? "Connexion..." : "Entrer dans l'admin"}
            </button>
          </form>

          <div className="hint-card">
            <strong>Sur iPhone</strong>
            <p>
              Safari {"->"} Partager {"->"} Ajouter a l'ecran d'accueil, puis ouvre l'app
              comme un vrai raccourci mobile.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const selectedWorkflowStatus = normalizeWorkflowStatus(selectedOrder);
  const canValidate = !["VALIDATE", "CANCELED"].includes(selectedWorkflowStatus);
  const canCancel = selectedWorkflowStatus !== "CANCELED";

  return (
    <main className="app-shell mobile-os-shell">
      <section className="content mobile-os-content">
        <header className="mobile-os-topbar">
          <div className="mobile-os-brand">
            <span className="app-icon-badge launcher-badge">{APP_ICONS.launcher}</span>
            <div>
              <p className="eyebrow">Tableau mobile</p>
              <h1>{activeApp === "launcher" ? "Applications admin" : APP_COPY[activeApp].title}</h1>
              <p className="topbar-copy">{session.user?.email || session.user?.name}</p>
            </div>
          </div>

          <div className="topbar-actions topbar-actions-mobile">
            {activeApp === "clickCollect" ? (
              <div className="date-switcher compact">
                <button
                  type="button"
                  className="ghost-icon-button"
                  onClick={() =>
                    setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, -1) }))
                  }
                >
                  &lt;
                </button>
                <span>{filters.date}</span>
                <button
                  type="button"
                  className="ghost-icon-button"
                  onClick={() =>
                    setFilters((current) => ({ ...current, date: shiftIsoDate(current.date, 1) }))
                  }
                >
                  &gt;
                </button>
              </div>
            ) : null}
            <div className="menu-dropdown-shell">
              <button
                type="button"
                className={`ghost-button compact-button menu-trigger ${isMenuOpen ? "active" : ""}`}
                onClick={toggleMenu}
                aria-expanded={isMenuOpen ? "true" : "false"}
                aria-haspopup="menu"
                aria-label="Ouvrir le menu"
              >
                <MenuTriggerIcon />
              </button>

              {isMenuOpen ? (
                <section className="menu-panel panel-card" role="menu">
                  <div className="menu-panel-head">
                    <p className="eyebrow">Navigation</p>
                    <p className="muted-copy compact-copy">{session.user?.email || session.user?.name}</p>
                  </div>

                  <div className="menu-panel-actions">
                    {activeApp !== "launcher" ? (
                      <button
                        type="button"
                        className="menu-action-button"
                        onClick={handleHomeNavigation}
                        role="menuitem"
                      >
                        <span>Accueil</span>
                        <strong>Retour a l'accueil</strong>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="menu-action-button menu-action-button-danger"
                      onClick={handleLogout}
                      role="menuitem"
                    >
                      <span>Session</span>
                      <strong>Deconnecter</strong>
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </header>

        <section className="summary-strip panel-card">
          <article className="summary-chip">
            <span>Commandes actives</span>
            <strong>{statusCounters.COMPLETED}</strong>
          </article>
          <article className="summary-chip">
            <span>Tickets a suivre</span>
            <strong>{ticketCounters.error + ticketCounters.warning}</strong>
          </article>
          <article className="summary-chip">
            <span>Clients charges</span>
            <strong>{customers.length}</strong>
          </article>
        </section>

        {activeApp === "clickCollect" ? (
          <section className="status-strip mobile-status-strip">
            <div className="status-strip-item">
              <span>Temps reel</span>
              <strong className={`status-pill ${streamConnected ? "success" : "warning"}`}>
                {streamConnected ? "Connecte" : "Reconnexion"}
              </strong>
            </div>
            <div className="status-strip-item">
              <span>Notifications</span>
              <strong
                className={`status-pill ${pushState === "subscribed" ? "success" : "neutral"}`}
              >
                {getPushStateLabel(pushState)}
              </strong>
            </div>
            {pushState !== "subscribed" ? (
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={handleEnableNotifications}
              >
                Activer le push
              </button>
            ) : null}
          </section>
        ) : null}

        {shouldShowIosInstallHelp ? (
          <section className="install-card compact-install-card">
            <strong>Installer l'app sur iPhone</strong>
            <p>
              Ouvre le site dans Safari, touche Partager puis Ajouter a l'ecran d'accueil.
              L'app gardera ensuite son rendu mobile natif.
            </p>
          </section>
        ) : null}

        {statusMessage ? <p className="inline-success">{statusMessage}</p> : null}

        {activeApp === "launcher" ? (
          <>
            <section className="apps-grid">
              <button
                type="button"
                className="app-launch-card"
                onClick={() => handleOpenApp("clickCollect", { section: "orders" })}
              >
                <AppLauncherIcon
                  alt="Logo Click&Collect"
                  fallback={APP_ICONS.clickCollect}
                  src={APP_LOGOS.clickCollect}
                />
                <div className="app-launch-copy">
                  <p className="eyebrow">{APP_COPY.clickCollect.subtitle}</p>
                  <h2>{APP_COPY.clickCollect.title}</h2>
                  <p>{APP_COPY.clickCollect.description}</p>
                </div>
                <div className="app-launch-meta">
                  <span>{statusCounters.COMPLETED} en cours</span>
                  <strong>Ouvrir</strong>
                </div>
              </button>

              <button
                type="button"
                className="app-launch-card"
                onClick={() => handleOpenApp("customerInfo")}
              >
                <AppLauncherIcon
                  alt="Logo Infos Clients"
                  fallback={APP_ICONS.customerInfo}
                  muted
                  src={APP_LOGOS.customerInfo}
                />
                <div className="app-launch-copy">
                  <p className="eyebrow">{APP_COPY.customerInfo.subtitle}</p>
                  <h2>{APP_COPY.customerInfo.title}</h2>
                  <p>{APP_COPY.customerInfo.description}</p>
                </div>
                <div className="app-launch-meta">
                  <span>Recherche rapide</span>
                  <strong>Ouvrir</strong>
                </div>
              </button>
            </section>
          </>
        ) : null}

        {activeApp === "clickCollect" ? (
          <>
            <section className="app-shell-card panel-card">
              <div className="app-shell-head">
                <div>
                  <p className="eyebrow">{APP_COPY.clickCollect.subtitle}</p>
                  <h2>{APP_COPY.clickCollect.title}</h2>
                  <p className="muted-copy compact-copy">{APP_COPY.clickCollect.description}</p>
                  <p className="muted-copy compact-copy">Service du {filters.date}</p>
                </div>
                <div className="app-badge-row">
                  <span className="status-pill neutral">{statusCounters.total} commandes</span>
                  <span className="status-pill neutral">{ticketCounters.total} tickets</span>
                </div>
              </div>

              <section className="mobile-menu-switcher compact-switcher">
                <button
                  type="button"
                  className={`switcher-pill ${clickCollectSection === "orders" ? "active" : ""}`}
                  onClick={() => handleClickCollectSectionChange("orders")}
                >
                  Commandes
                </button>
                <button
                  type="button"
                  className={`switcher-pill ${clickCollectSection === "tickets" ? "active" : ""}`}
                  onClick={() => handleClickCollectSectionChange("tickets")}
                >
                  Tickets
                </button>
              </section>
            </section>

            <section className="toolbar app-toolbar panel-card">
              {clickCollectSection === "orders" ? (
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
                      onClick={() =>
                        setFilters((current) => ({ ...current, status: "IN_PROGRESS" }))
                      }
                    >
                      En cours {statusCounters.COMPLETED}
                    </button>
                    <button
                      type="button"
                      className={`switcher-pill ${filters.status === "PRINTED" ? "active" : ""}`}
                      onClick={() =>
                        setFilters((current) => ({ ...current, status: "PRINTED" }))
                      }
                    >
                      Finalisees {statusCounters.FINALIZED}
                    </button>
                    <button
                      type="button"
                      className={`switcher-pill ${filters.status === "VALIDATE" ? "active" : ""}`}
                      onClick={() =>
                        setFilters((current) => ({ ...current, status: "VALIDATE" }))
                      }
                    >
                      Validees {statusCounters.VALIDATE}
                    </button>
                    <button
                      type="button"
                      className={`switcher-pill ${filters.status === "CANCELED" ? "active" : ""}`}
                      onClick={() =>
                        setFilters((current) => ({ ...current, status: "CANCELED" }))
                      }
                    >
                      Annulees {statusCounters.CANCELED}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="ghost-button compact-button"
                    onClick={() => loadOrders({ silent: true })}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? "Actualisation..." : "Rafraichir"}
                  </button>
                </>
              ) : null}

              {clickCollectSection === "tickets" ? (
                <>
                  <label className="search-field">
                    <input
                      type="search"
                      value={ticketSearchQuery}
                      onChange={(event) => setTicketSearchQuery(event.target.value)}
                      placeholder="Commande, imprimante, client..."
                    />
                  </label>

                  <select
                    className="filter-select"
                    value={ticketFilter}
                    onChange={(event) => setTicketFilter(event.target.value)}
                  >
                    <option value="attention">Prioritaires</option>
                    <option value="error">Erreurs</option>
                    <option value="healthy">OK</option>
                    <option value="all">Tous</option>
                  </select>

                  <button
                    type="button"
                    className="ghost-button compact-button"
                    onClick={() => loadTickets({ silent: true })}
                    disabled={ticketsLoading}
                  >
                    {ticketsLoading ? "Actualisation..." : "Rafraichir"}
                  </button>
                </>
              ) : null}
            </section>

            {ordersError && clickCollectSection === "orders" ? (
              <p className="inline-error">{ordersError}</p>
            ) : null}
            {ticketsError && clickCollectSection === "tickets" ? (
              <p className="inline-error">{ticketsError}</p>
            ) : null}

            {clickCollectSection === "orders" ? (
              <section className="orders-layout mobile-orders-layout">
                <section className="orders-column panel-card">
                  <div className="column-head">
                    <div>
                      <p className="eyebrow">File active</p>
                      <h3>Commandes a traiter</h3>
                    </div>
                    <span className="status-pill neutral">{filteredOrders.length} visibles</span>
                  </div>
                  {ordersLoading ? (
                    <div className="subtle-empty-state">Chargement des commandes...</div>
                  ) : groupedKeys.length === 0 ? (
                    <div className="subtle-empty-state">
                      {searchQuery
                        ? "Aucune commande ne correspond a cette recherche."
                        : "Aucune commande pour cette date."}
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
                                className={`order-card ${
                                  String(selectedOrderId) === String(order.id) ? "selected" : ""
                                }`}
                                onClick={() => setSelectedOrderId(order.id)}
                              >
                                <div className="order-card-head">
                                  <strong>{getOrderDisplayName(order)}</strong>
                                  <span className={`status-pill ${workflowStatus.toLowerCase()}`}>
                                    {getStatusLabel(workflowStatus)}
                                  </span>
                                </div>
                                <div className="order-card-meta">
                                  <span>{order.timeSlot?.location?.name || "Lieu non renseigne"}</span>
                                  <span>
                                    {order.timeSlot?.startTime
                                      ? formatTimeLabel(order.timeSlot.startTime)
                                      : "Heure non renseignee"}
                                  </span>
                                </div>
                                <p className="muted-copy">
                                  {order.items?.length || 0} article(s) · {formatPrice(order.total)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))
                  )}
                </section>

                <div className="details-column">
                  {!selectedOrder ? (
                    <div className="panel-card">
                      Selectionne une commande pour voir son detail.
                    </div>
                  ) : (
                    <article className="detail-card">
                      <div className="detail-head">
                        <div>
                          <p className="eyebrow">Commande active</p>
                          <h2>Commande #{selectedOrder.id}</h2>
                          <p className="muted-copy compact-copy">
                            {selectedOrder.timeSlot?.location?.name || "Lieu non renseigne"} ·{" "}
                            {selectedOrder.timeSlot?.startTime
                              ? formatTimeLabel(selectedOrder.timeSlot.startTime)
                              : "Heure non renseignee"}
                          </p>
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
                              {selectedOrderIndex >= 0
                                ? `${selectedOrderIndex + 1}/${orderedOrderIds.length}`
                                : "--"}
                            </span>
                            <button
                              type="button"
                              className="ghost-icon-button"
                              onClick={() => navigateSelection(1)}
                              disabled={
                                selectedOrderIndex < 0 ||
                                selectedOrderIndex >= orderedOrderIds.length - 1
                              }
                            >
                              &gt;
                            </button>
                          </div>
                          <span className={`status-pill ${selectedWorkflowStatus.toLowerCase()}`}>
                            {getStatusLabel(selectedWorkflowStatus)}
                          </span>
                        </div>
                      </div>

                      <div className="detail-grid">
                        <div className="detail-block">
                          <span>Client</span>
                          <strong>{getOrderDisplayName(selectedOrder)}</strong>
                          <p>{selectedOrder.user?.phone || selectedOrder.user?.email || "Contact non renseigne"}</p>
                        </div>

                        <div className="detail-block">
                          <span>Retrait</span>
                          <strong>
                            {selectedOrder.timeSlot?.location?.name || "Lieu non renseigne"}
                          </strong>
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
                              <strong>
                                {item.quantity}x {item.product?.name || "Produit"}
                              </strong>
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
                          <button
                            type="button"
                            className="primary-button action-button-main"
                            onClick={() => handleStatusAction("VALIDATE")}
                          >
                            Valider la commande
                          </button>
                        ) : null}
                        {canCancel ? (
                          <button
                            type="button"
                            className="danger-button action-button-cancel"
                            onClick={() => handleStatusAction("CANCELED")}
                          >
                            Annuler la commande
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )}
                </div>
              </section>
            ) : null}

            {clickCollectSection === "tickets" ? (
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
                        <article
                          key={ticket.id}
                          className={`panel-card compact-card ticket-card ticket-card-${state}`}
                        >
                          <div className="order-card-head">
                            <div>
                              <strong>Commande #{ticket.orderId}</strong>
                              <p className="muted-copy">
                                {ticket?.printer?.code || "Imprimante -"} ·{" "}
                                {ticket?.order?.user?.name ||
                                  ticket?.order?.user?.firstName ||
                                  "Client"}
                              </p>
                            </div>
                            <div className="ticket-badges">
                              <span className={`status-pill ${getTicketStatusClass(ticket.status)}`}>
                                {getTicketStatusLabel(ticket.status)}
                              </span>
                              <span className="status-pill neutral">
                                {getTicketMonitorLabel(state)}
                              </span>
                            </div>
                          </div>
                          <p className="muted-copy">
                            {ticket?.order?.timeSlot?.location?.name || "Lieu non renseigne"} -{" "}
                            {ticket?.order?.timeSlot?.startTime
                              ? formatTimeLabel(ticket.order.timeSlot.startTime)
                              : "Heure non renseignee"}
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
          </>
        ) : null}

        {activeApp === "customerInfo" ? (
          <>
            <section className="app-shell-card panel-card">
              <div className="app-shell-head">
                <div>
                  <p className="eyebrow">{APP_COPY.customerInfo.subtitle}</p>
                  <h2>{APP_COPY.customerInfo.title}</h2>
                  <p className="muted-copy compact-copy">
                    {APP_COPY.customerInfo.description}
                  </p>
                </div>
                <div className="app-badge-row">
                  <span className="status-pill neutral">{customers.length} fiches</span>
                </div>
              </div>
            </section>

            <section className="toolbar app-toolbar">
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
                        <span className="status-pill neutral">
                          {customer?.role || "Client"}
                        </span>
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
          </>
        ) : null}
      </section>
    </main>
  );
}
