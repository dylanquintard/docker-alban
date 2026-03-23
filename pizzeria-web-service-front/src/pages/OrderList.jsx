import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  getOrdersAdmin,
  getAllUsers,
  deleteOrderAdmin,
  updateOrderStatusAdmin,
} from "../api/admin.api";
import { useRealtimeEvents } from "../hooks/useRealtimeEvents";
import { ActionIconButton, DeleteIcon } from "../components/ui/AdminActions";
import { getOrderNote } from "../utils/orderNote";
import { splitPersonName } from "../utils/personName";

function toLocalIsoDate(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getClientPhone(order) {
  return (
    order?.user?.phone ||
    order?.user?.phoneNumber ||
    order?.user?.telephone ||
    order?.user?.mobile ||
    order?.user?.tel ||
    order?.phoneNumber ||
    order?.telephone ||
    order?.mobile ||
    order?.contactPhone ||
    order?.phone ||
    null
  );
}

function getClientIdentity(order, tr) {
  const parsed = splitPersonName({
    firstName:
      order?.user?.firstName ??
      order?.firstName ??
      order?.customerFirstName ??
      order?.clientFirstName,
    lastName:
      order?.user?.lastName ??
      order?.lastName ??
      order?.customerLastName ??
      order?.clientLastName,
    name: order?.user?.name ?? order?.customerName ?? order?.clientName ?? "",
  });

  return {
    fullName: parsed.fullName || tr("Client inconnu", "Unknown client"),
  };
}

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? "0.00" : numeric.toFixed(2);
}

function getOrderItemProduct(item) {
  return item?.product || item?.menuItem || null;
}

function getOrderItemName(item, tr) {
  const product = getOrderItemProduct(item);
  return product?.name || item?.name || `${tr("Produit", "Product")} #${item?.id ?? "?"}`;
}

function getIngredientName(ingredient, tr) {
  return ingredient?.name || ingredient?.ingredient?.name || tr("Ingrédient", "Ingredient");
}

function normalizeWorkflowStatus(order) {
  const value = String(order?.workflowStatus || order?.status || "")
    .trim()
    .toUpperCase();
  if (value === "VALIDATED" || value === "VALIDATE") return "VALIDATED";
  if (value === "PRINTED" || value === "FINALIZED") return "PRINTED";
  if (value === "CANCELED") return "CANCELED";
  return "IN_PROGRESS";
}

export default function OrderList() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { tr, locale } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(toLocalIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("IN_PROGRESS");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [usersById, setUsersById] = useState({});
  const [usersByEmail, setUsersByEmail] = useState({});
  const [usersByName, setUsersByName] = useState({});
  const [usersLookupReady, setUsersLookupReady] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const seenOrderIdsRef = useRef(new Set());
  const snapshotInitializedRef = useRef(false);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  const changeDate = (days) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalIsoDate(d));
  };

  const fetchOrders = useCallback(async () => {
    if (!token || !user || user.role !== "ADMIN") return;

    setLoading(true);
    try {
      const data = await getOrdersAdmin(token, {
        date: selectedDate,
        status: selectedStatus,
      });
      const nextOrders = Array.isArray(data) ? data : [];
      setOrders(nextOrders);

      const nextIds = new Set(nextOrders.map((entry) => String(entry.id)));
      if (!snapshotInitializedRef.current) {
        seenOrderIdsRef.current = nextIds;
        snapshotInitializedRef.current = true;
      } else {
        const newOrders = nextOrders.filter((entry) => !seenOrderIdsRef.current.has(String(entry.id)));
        if (newOrders.length > 0) {
          setNewOrdersCount((prev) => prev + newOrders.length);
        }
        seenOrderIdsRef.current = nextIds;
      }
      setMessage("");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || tr("Erreur lors du chargement des commandes", "Error while loading orders"));
    } finally {
      setLoading(false);
    }
  }, [token, user, selectedDate, selectedStatus, tr]);

  useEffect(() => {
    snapshotInitializedRef.current = false;
    seenOrderIdsRef.current = new Set();
    setNewOrdersCount(0);
  }, [selectedDate, selectedStatus]);

  useEffect(() => {
    if (authLoading) return;
    fetchOrders();
  }, [authLoading, fetchOrders]);

  const handleRealtimeEvent = useCallback(
    (eventName) => {
      if (eventName === "orders:admin-updated") {
        fetchOrders();
      }
    },
    [fetchOrders]
  );

  useRealtimeEvents({
    enabled: Boolean(token && user?.role === "ADMIN"),
    onEvent: handleRealtimeEvent,
    onConnectionChange: setRealtimeConnected,
  });

  useEffect(() => {
    if (!token || !user || user.role !== "ADMIN") return;

    let cancelled = false;

    async function fetchUsersForPhoneLookup() {
      try {
        const users = await getAllUsers(token);
        if (cancelled) return;

        const byId = {};
        const byEmail = {};
        const byName = {};
        (Array.isArray(users) ? users : []).forEach((entry) => {
          const phone = entry?.phone || entry?.phoneNumber || entry?.telephone || null;
          if (!phone) return;

          if (entry?.id !== undefined && entry?.id !== null) {
            byId[String(entry.id)] = String(phone);
          }
          if (entry?.email) {
            byEmail[String(entry.email).toLowerCase()] = String(phone);
          }
          if (entry?.name) {
            const parsed = splitPersonName(entry);
            const nameKeys = [String(entry.name).trim(), parsed.fullName]
              .map((value) => String(value || "").trim().toLowerCase())
              .filter(Boolean);

            nameKeys.forEach((key) => {
              if (!byName[key]) {
                byName[key] = String(phone);
              }
            });
          }
        });

        setUsersById(byId);
        setUsersByEmail(byEmail);
        setUsersByName(byName);
      } catch (_err) {
        if (!cancelled) {
          setUsersById({});
          setUsersByEmail({});
          setUsersByName({});
        }
      } finally {
        if (!cancelled) {
          setUsersLookupReady(true);
        }
      }
    }

    fetchUsersForPhoneLookup();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const handleDelete = async (orderId) => {
    if (!window.confirm(tr("Voulez-vous vraiment supprimer cette commande ?", "Do you really want to delete this order?"))) return;

    try {
      await deleteOrderAdmin(token, orderId);
      fetchOrders();
      setMessage(tr("Commande supprimée", "Order deleted"));
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.error || tr("Impossible de supprimer la commande", "Unable to delete order"));
    }
  };

  const handleValidateOrder = async (orderId) => {
    try {
      setUpdatingOrderId(orderId);
      await updateOrderStatusAdmin(token, orderId, "VALIDATE");
      await fetchOrders();
      setMessage(tr("Commande validée et email envoyé.", "Order validated and email sent."));
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.error ||
          tr("Impossible de valider la commande.", "Unable to validate the order.")
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const resolveClientPhone = (order) => {
    const directPhone = getClientPhone(order);
    if (directPhone) return String(directPhone);

    const userId = order?.user?.id ?? order?.userId ?? order?.customerId ?? order?.clientId ?? null;
    if (userId !== null && userId !== undefined) {
      const byIdPhone = usersById[String(userId)];
      if (byIdPhone) return String(byIdPhone);
    }

    const email = order?.user?.email || order?.email || order?.userEmail || order?.clientEmail || null;
    if (email) {
      const byEmailPhone = usersByEmail[String(email).toLowerCase()];
      if (byEmailPhone) return String(byEmailPhone);
    }

    const clientIdentity = getClientIdentity(order, tr);
    const nameCandidates = [
      order?.user?.name,
      order?.customerName,
      order?.clientName,
      clientIdentity.fullName,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    for (const key of nameCandidates) {
      const byNamePhone = usersByName[key];
      if (byNamePhone) return String(byNamePhone);
    }

    return null;
  };

  const isErrorMessage = /erreur|impossible|acces refus|inconnu|error|unable|denied|unknown|failed/i.test(String(message).toLowerCase());

  const groupedOrders = orders.reduce((acc, order) => {
    const slotKey = order.timeSlot ? formatTime(order.timeSlot.startTime) : "-";
    if (!acc[slotKey]) acc[slotKey] = [];
    acc[slotKey].push(order);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">{tr("Gestion des commandes", "Order management")}</h2>
        <div className="flex items-center gap-2">
          {newOrdersCount > 0 && (
            <span className="rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
              +{newOrdersCount} {tr("nouvelle(s)", "new")}
            </span>
          )}
          <p className="text-xs uppercase tracking-wider text-stone-400">
            {orders.length} {tr("commande", "order")}{orders.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-300">
        <span>
          {tr("Flux temps réel", "Realtime stream")}:{" "}
          <strong className={realtimeConnected ? "text-emerald-300" : "text-amber-300"}>
            {realtimeConnected ? tr("connecté", "connected") : tr("reconnexion...", "reconnecting...")}
          </strong>
        </span>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            isErrorMessage
              ? "border-red-400/40 bg-red-500/10 text-red-200"
              : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        <div className="flex w-full items-center gap-2 sm:flex-1">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/5 text-stone-100 transition hover:bg-white/15"
            aria-label={tr("Jour precedent", "Previous day")}
          >
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>

          <span className="min-w-0 flex-1 rounded-xl border border-white/20 bg-charcoal/50 px-3 py-2 text-center text-sm font-semibold text-stone-100">
            {selectedDate}
          </span>

          <button
            type="button"
            onClick={() => changeDate(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/5 text-stone-100 transition hover:bg-white/15"
            aria-label={tr("Jour suivant", "Next day")}
          >
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="statusSelect" className="text-[11px] font-semibold uppercase tracking-wide text-stone-300 sm:text-xs">
            {tr("Statut", "Status")}
          </label>
          <select
            id="statusSelect"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="h-8 rounded-lg border border-white/20 bg-charcoal/70 px-2 text-xs text-stone-100 focus:border-saffron focus:outline-none sm:h-9 sm:px-3 sm:text-sm"
          >
            <option value="IN_PROGRESS">{tr("En cours", "In progress")}</option>
            <option value="PRINTED">{tr("Termine", "Finished")}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-300">{tr("Chargement des commandes...", "Loading orders...")}</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-300">
          {tr("Aucune commande prevue a cette date.", "No order planned for this date.")}
        </p>
      ) : (
        Object.keys(groupedOrders)
          .sort((a, b) => a.localeCompare(b))
          .map((slot) => (
            <section key={slot} className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">{tr("Heure", "Time")} {slot}</h3>
                <span className="text-xs text-stone-300">
                  {groupedOrders[slot].length} {tr("commande", "order")}{groupedOrders[slot].length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {groupedOrders[slot].map((order) => {
                  const workflowStatus = normalizeWorkflowStatus(order);
                  const rawStatus = String(order?.status || "").trim().toUpperCase();
                  const orderTotal = formatPrice(order.total ?? order.totalPrice);
                  const clientPhone = resolveClientPhone(order);
                  const clientIdentity = getClientIdentity(order, tr);
                  const hasPhone = Boolean(clientPhone);
                  const phoneDisplay = clientPhone || (usersLookupReady ? tr("Numéro non renseigne", "No phone provided") : tr("Chargement...", "Loading..."));
                  const orderNote = getOrderNote(order);

                  return (
                    <article key={order.id} className="rounded-xl border border-white/10 bg-charcoal/45 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold uppercase tracking-wide text-white">
                            {clientIdentity.fullName}
                          </p>
                          <p className={`theme-light-keep-dark mt-0.5 text-[11px] font-medium ${hasPhone ? "text-sky-200" : "text-stone-400"}`}>
                            {phoneDisplay}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-300">
                            <span>#{order.id}</span>
                            <span className="text-stone-500">|</span>
                            <span>{orderTotal} EUR</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                workflowStatus === "VALIDATED"
                                  ? "bg-saffron text-charcoal"
                                  : workflowStatus === "PRINTED"
                                  ? "bg-emerald-500/20 text-black"
                                  : "bg-amber-500/20 text-black"
                              }`}
                            >
                              {workflowStatus === "VALIDATED"
                                ? tr("VALIDEE", "VALIDATED")
                                : workflowStatus === "PRINTED"
                                  ? tr("IMPRIMEE", "PRINTED")
                                  : workflowStatus === "CANCELED"
                                    ? tr("ANNULEE", "CANCELED")
                                    : tr("EN COURS", "IN PROGRESS")}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {rawStatus === "FINALIZED" ? (
                            <button
                              type="button"
                              onClick={() => handleValidateOrder(order.id)}
                              disabled={updatingOrderId === order.id}
                              className="rounded-full bg-saffron px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingOrderId === order.id
                                ? tr("Validation...", "Validating...")
                                : tr("Valider", "Validate")}
                            </button>
                          ) : null}
                          <ActionIconButton
                            onClick={() => handleDelete(order.id)}
                            label={tr("Supprimer la commande", "Delete order")}
                            variant="danger"
                          >
                            <DeleteIcon />
                          </ActionIconButton>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="space-y-2">
                          {order.items?.length > 0 ? (
                            order.items.map((item, index) => {
                              const added = (item.addedIngredients || []).map((entry) => getIngredientName(entry, tr)).filter(Boolean);
                              const removed = (item.removedIngredients || []).map((entry) => getIngredientName(entry, tr)).filter(Boolean);

                              return (
                                <div key={item.id ?? `${order.id}-${index}`} className="text-sm text-stone-200">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex min-w-[34px] justify-center rounded-md bg-saffron/20 px-1.5 py-0.5 text-xs font-bold text-saffron">
                                      {item.quantity}x
                                    </span>
                                    <span className="text-sm font-semibold text-white sm:text-[15px]">
                                      {getOrderItemName(item, tr)}
                                    </span>
                                  </div>

                                  {(added.length > 0 || removed.length > 0) && (
                                    <div className="ml-9 mt-1 space-y-0.5">
                                      {added.length > 0 && <p className="text-xs text-emerald-300 sm:text-sm">+ {added.join(", ")}</p>}
                                      {removed.length > 0 && <p className="text-xs text-red-300 sm:text-sm">- {removed.join(", ")}</p>}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-stone-400">{tr("Aucun détail de produit.", "No product detail.")}</p>
                          )}
                        </div>

                        {orderNote && (
                          <div className="mt-3 grid gap-1 rounded-md border border-white/10 bg-charcoal/40 px-2.5 py-2 text-xs text-stone-300 sm:grid-cols-2">
                            <p className="sm:col-span-2">
                              <strong className="text-stone-100">{tr("Note", "Note")}:</strong> {orderNote}
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
