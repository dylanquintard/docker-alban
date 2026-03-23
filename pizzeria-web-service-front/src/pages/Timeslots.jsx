import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getLocations } from "../api/location.api";
import { getPrintAgentsAdmin } from "../api/admin.api";
import {
  createTruckClosure,
  deleteTruckClosure,
  deleteWeeklyService,
  getConcreteSlots,
  getTruckClosures,
  getWeeklySettings,
  updateConcreteSlotActiveState,
  upsertWeeklySetting,
} from "../api/timeslot.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getLocationDisplayName } from "../utils/location";
import LocationManagerSection from "../components/common/LocationManagerSection";

const WEEK_DAYS = [
  { key: "MONDAY", labelFr: "Lundi", labelEn: "Monday" },
  { key: "TUESDAY", labelFr: "Mardi", labelEn: "Tuesday" },
  { key: "WEDNESDAY", labelFr: "Mercredi", labelEn: "Wednesday" },
  { key: "THURSDAY", labelFr: "Jeudi", labelEn: "Thursday" },
  { key: "FRIDAY", labelFr: "Vendredi", labelEn: "Friday" },
  { key: "SATURDAY", labelFr: "Samedi", labelEn: "Saturday" },
  { key: "SUNDAY", labelFr: "Dimanche", labelEn: "Sunday" },
];

const DAY_INDEX_BY_KEY = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const DEFAULT_FORM = {
  startTime: "18:00",
  endTime: "22:00",
  slotDuration: 15,
  maxPizzas: 10,
  locationId: "",
  agentId: "",
};

const DEFAULT_CLOSURE_FORM = {
  agentId: "",
  startDate: "",
  endDate: "",
  reason: "",
};

function formatLocation(location, tr) {
  if (!location) return tr("Sans emplacement", "No location");
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [getLocationDisplayName(location, tr("Emplacement", "Location")), location.addressLine1, cityLine]
    .filter(Boolean)
    .join(" - ");
}

function closedSetting(dayOfWeek) {
  return {
    dayOfWeek,
    isOpen: false,
    services: [],
  };
}

function normalizeServices(setting = {}) {
  if (Array.isArray(setting.services) && setting.services.length > 0) {
    return setting.services;
  }

  if (setting.isOpen && setting.startTime && setting.endTime) {
    return [
      {
        id: `${setting.dayOfWeek || "DAY"}-${setting.locationId || "none"}-${setting.startTime}-${setting.endTime}`,
        serviceId: null,
        startTime: setting.startTime,
        endTime: setting.endTime,
        slotDuration: setting.slotDuration,
        maxPizzas: setting.maxPizzas,
        locationId: setting.locationId,
        location: setting.location || null,
        slotsCount: setting.slotsCount || 0,
      },
    ];
  }

  return [];
}

function formatDateValue(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalIsoDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateValue(date);
}

function getNextDateForDay(dayOfWeek) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDayIndex = DAY_INDEX_BY_KEY[String(dayOfWeek || "").toUpperCase()];
  if (targetDayIndex === undefined) {
    return toLocalIsoDate(today);
  }

  const next = new Date(today.getTime());
  const dayOffset = (targetDayIndex - today.getDay() + 7) % 7;
  next.setDate(today.getDate() + dayOffset);
  return toLocalIsoDate(next);
}

function buildServiceManagerKey(dayOfWeek, service) {
  return `${dayOfWeek}:${service?.locationId || "none"}:${service?.startTime || "start"}:${service?.endTime || "end"}`;
}

function buildDeleteServicePayload(service) {
  const numericLocationId = Number(service?.locationId);
  return {
    serviceId: service?.serviceId || undefined,
    startTime: service?.startTime,
    endTime: service?.endTime,
    locationId: Number.isFinite(numericLocationId) ? numericLocationId : undefined,
  };
}

export default function TimeslotsAdmin() {
  const { token } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [locations, setLocations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [closures, setClosures] = useState([]);
  const [weeklySettings, setWeeklySettings] = useState([]);
  const [activeDay, setActiveDay] = useState("MONDAY");
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [editingService, setEditingService] = useState(null);
  const [closureForm, setClosureForm] = useState({ ...DEFAULT_CLOSURE_FORM });
  const [managedService, setManagedService] = useState(null);
  const [managedServiceDate, setManagedServiceDate] = useState("");
  const [managedConcreteSlots, setManagedConcreteSlots] = useState([]);
  const [concreteSlotsLoading, setConcreteSlotsLoading] = useState(false);
  const [updatingConcreteSlotKey, setUpdatingConcreteSlotKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const settingsByDay = useMemo(
    () => new Map(weeklySettings.map((setting) => [setting.dayOfWeek, setting])),
    [weeklySettings]
  );

  const activeDaySetting = settingsByDay.get(activeDay) || closedSetting(activeDay);
  const activeDayServices = useMemo(
    () => normalizeServices(activeDaySetting),
    [activeDaySetting]
  );

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [locationData, settingsData, agentsData, closuresData] = await Promise.all([
        getLocations({ active: true }),
        getWeeklySettings(token),
        getPrintAgentsAdmin(token),
        getTruckClosures(token),
      ]);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setWeeklySettings(Array.isArray(settingsData) ? settingsData : []);
      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setClosures(Array.isArray(closuresData) ? closuresData : []);
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error ||
          tr(
            "Impossible de charger les horaires hebdomadaires",
            "Unable to load weekly opening hours"
          )
      );
    } finally {
      setLoading(false);
    }
  }, [token, tr]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const firstService = normalizeServices(activeDaySetting)[0];
    setForm((prev) => ({
      ...prev,
      locationId:
        prev.locationId ||
        (firstService?.locationId ? String(firstService.locationId) : ""),
      agentId:
        prev.agentId ||
        (firstService?.agentId ? String(firstService.agentId) : ""),
    }));
  }, [activeDaySetting]);

  useEffect(() => {
    setEditingService(null);
    setManagedService(null);
    setManagedServiceDate("");
    setManagedConcreteSlots([]);
  }, [activeDay]);

  const upsertWeeklySettingInState = (dayKey, setting) => {
    setWeeklySettings((prev) => {
      const byDay = new Map(prev.map((entry) => [entry.dayOfWeek, entry]));
      byDay.set(dayKey, setting || closedSetting(dayKey));
      return WEEK_DAYS.map((day) => byDay.get(day.key) || closedSetting(day.key));
    });
  };

  const loadConcreteSlots = useCallback(
    async (service, dateValue) => {
      if (!service?.locationId || !service?.startTime || !service?.endTime || !dateValue) {
        setManagedConcreteSlots([]);
        return;
      }

      setConcreteSlotsLoading(true);
      try {
        const response = await getConcreteSlots(token, {
          dayOfWeek: activeDay,
          date: dateValue,
          locationId: Number(service.locationId),
          startTime: service.startTime,
          endTime: service.endTime,
        });

        setManagedConcreteSlots(Array.isArray(response?.slots) ? response.slots : []);
      } catch (err) {
        console.error(err);
        setManagedConcreteSlots([]);
        alert(
          err.response?.data?.error ||
            tr(
              "Impossible de charger les créneaux générés",
              "Unable to load generated slots"
            )
        );
      } finally {
        setConcreteSlotsLoading(false);
      }
    },
    [activeDay, token, tr]
  );

  const handleAddService = async (event) => {
    event.preventDefault();

    if (!form.locationId) {
      alert(tr("Sélectionnez un emplacement", "Select a location"));
      return;
    }

    setSaving(true);
    try {
      const nextPayload = {
        isOpen: true,
        startTime: form.startTime,
        endTime: form.endTime,
        slotDuration: Number(form.slotDuration),
        maxPizzas: Number(form.maxPizzas),
        locationId: Number(form.locationId),
        agentId: form.agentId ? Number(form.agentId) : null,
      };

      let savedSetting;

      if (editingService) {
        await deleteWeeklyService(token, activeDay, buildDeleteServicePayload(editingService));

        try {
          savedSetting = await upsertWeeklySetting(token, activeDay, nextPayload);
        } catch (err) {
          // Best-effort rollback to avoid losing the original service on save failure.
          try {
            await upsertWeeklySetting(token, activeDay, {
              isOpen: true,
              startTime: editingService.startTime,
              endTime: editingService.endTime,
              slotDuration: Number(editingService.slotDuration),
              maxPizzas: Number(editingService.maxPizzas),
              locationId: Number(editingService.locationId),
              agentId: editingService.agentId ? Number(editingService.agentId) : null,
            });
          } catch (_rollbackErr) {
            // Ignore rollback errors here, primary error will be shown to user.
          }
          throw err;
        }
      } else {
        savedSetting = await upsertWeeklySetting(token, activeDay, nextPayload);
      }

      upsertWeeklySettingInState(activeDay, savedSetting);
      setEditingService(null);
      setManagedService(null);
      setManagedServiceDate("");
      setManagedConcreteSlots([]);
      alert(
        editingService
          ? tr("Service mis à jour", "Service updated")
          : tr("Service ajoute", "Service added")
      );
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditService = (service) => {
    if (!service) return;

    setManagedService(null);
    setManagedServiceDate("");
    setManagedConcreteSlots([]);
    setEditingService({
      serviceId: service.serviceId || null,
      startTime: service.startTime,
      endTime: service.endTime,
      slotDuration: Number(service.slotDuration || DEFAULT_FORM.slotDuration),
      maxPizzas: Number(service.maxPizzas || DEFAULT_FORM.maxPizzas),
      locationId: Number(service.locationId),
      agentId: service.agentId ? Number(service.agentId) : null,
    });

    setForm({
      startTime: service.startTime || DEFAULT_FORM.startTime,
      endTime: service.endTime || DEFAULT_FORM.endTime,
      slotDuration: Number(service.slotDuration || DEFAULT_FORM.slotDuration),
      maxPizzas: Number(service.maxPizzas || DEFAULT_FORM.maxPizzas),
      locationId: service.locationId ? String(service.locationId) : "",
      agentId: service.agentId ? String(service.agentId) : "",
    });
  };

  const handleCancelEdit = () => {
    setEditingService(null);
    setForm((prev) => ({
      ...DEFAULT_FORM,
      locationId: prev.locationId || "",
      agentId: prev.agentId || "",
    }));
  };

  const handleToggleServiceManager = async (service) => {
    const serviceKey = buildServiceManagerKey(activeDay, service);
    const isCurrentlyOpen =
      managedService &&
      buildServiceManagerKey(activeDay, managedService) === serviceKey;

    if (isCurrentlyOpen) {
      setManagedService(null);
      setManagedServiceDate("");
      setManagedConcreteSlots([]);
      return;
    }

    const nextDate = getNextDateForDay(activeDay);
    setManagedService(service);
    setManagedServiceDate(nextDate);
    setEditingService(null);
    await loadConcreteSlots(service, nextDate);
  };

  const handleManagedServiceDateChange = async (value) => {
    setManagedServiceDate(value);
    if (!managedService || !value) {
      setManagedConcreteSlots([]);
      return;
    }

    await loadConcreteSlots(managedService, value);
  };

  const handleToggleConcreteSlot = async (slot) => {
    if (!managedService || !managedServiceDate || !slot?.pickupTime) return;

    const nextActiveState = !slot.active;
    const actionKey = `${managedServiceDate}:${slot.pickupTime}`;
    setUpdatingConcreteSlotKey(actionKey);

    try {
      await updateConcreteSlotActiveState(token, {
        date: managedServiceDate,
        pickupTime: slot.pickupTime,
        locationId: Number(managedService.locationId),
        active: nextActiveState,
      });

      await loadConcreteSlots(managedService, managedServiceDate);
      alert(
        nextActiveState
          ? tr("Créneau réactivé", "Slot reactivated")
          : tr("Créneau désactivé", "Slot disabled")
      );
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setUpdatingConcreteSlotKey("");
    }
  };

  const handleCloseDay = async () => {
    if (
      !window.confirm(
        tr(
          "Fermer ce jour supprimera tous les services planifies. Continuer ?",
          "Closing this day will remove all planned services. Continue?"
        )
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const savedSetting = await upsertWeeklySetting(token, activeDay, { isOpen: false });
      upsertWeeklySettingInState(activeDay, savedSetting);
      setManagedService(null);
      setManagedServiceDate("");
      setManagedConcreteSlots([]);
      alert(tr("Jour ferme", "Day closed"));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (service) => {
    if (!service?.locationId || !service?.startTime || !service?.endTime) return;
    if (
      !window.confirm(
        tr("Supprimer ce service ?", "Delete this service?")
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const savedSetting = await deleteWeeklyService(
        token,
        activeDay,
        buildDeleteServicePayload(service)
      );
      upsertWeeklySettingInState(activeDay, savedSetting);
      if (
        managedService &&
        buildServiceManagerKey(activeDay, managedService) ===
          buildServiceManagerKey(activeDay, service)
      ) {
        setManagedService(null);
        setManagedServiceDate("");
        setManagedConcreteSlots([]);
      }
      alert(tr("Service supprime", "Service deleted"));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddClosure = async (event) => {
    event.preventDefault();

    if (!closureForm.agentId) {
      alert(tr("Sélectionnez un camion", "Select a truck"));
      return;
    }

    if (!closureForm.startDate || !closureForm.endDate) {
      alert(tr("Sélectionnez une plage de dates", "Select a date range"));
      return;
    }

    setSaving(true);
    try {
      const created = await createTruckClosure(token, {
        agentId: Number(closureForm.agentId),
        startDate: closureForm.startDate,
        endDate: closureForm.endDate,
        reason: closureForm.reason || null,
      });
      setClosures((prev) => [...prev, created]);
      setClosureForm({ ...DEFAULT_CLOSURE_FORM, agentId: closureForm.agentId });
      alert(tr("Fermeture enregistree", "Closure saved"));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClosure = async (closureId) => {
    if (!window.confirm(tr("Supprimer cette fermeture ?", "Delete this closure?"))) {
      return;
    }

    setSaving(true);
    try {
      await deleteTruckClosure(token, closureId);
      setClosures((prev) => prev.filter((entry) => Number(entry.id) !== Number(closureId)));
      alert(tr("Fermeture supprimée", "Closure deleted"));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  const sortedClosures = useMemo(
    () =>
      [...closures].sort((left, right) =>
        String(left?.startDate || "").localeCompare(String(right?.startDate || ""))
      ),
    [closures]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display uppercase tracking-wide text-white">
          {tr("Horaires & Emplacements", "Schedules & Locations")}
        </h2>
        <p className="mt-1 text-sm text-stone-300">
          {tr(
            "Ajoutez plusieurs services par jour: horaires, capacité par créneau et emplacement.",
            "Add multiple services per day: hours, per-slot capacity and location."
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="space-y-2">
              {WEEK_DAYS.map((day) => {
                const setting = settingsByDay.get(day.key) || closedSetting(day.key);
                const services = normalizeServices(setting);
                const isActive = day.key === activeDay;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setActiveDay(day.key)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-saffron bg-saffron/15"
                        : "border-white/15 bg-black/20 hover:bg-white/10"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isActive ? "text-saffron" : "text-stone-100"}`}>
                      {tr(day.labelFr, day.labelEn)}
                    </p>
                    <p className={`text-xs ${services.length > 0 ? "text-emerald-300" : "text-stone-400"}`}>
                      {services.length > 0
                        ? tr(
                            `${services.length} service(s)`,
                            `${services.length} service(s)`
                          )
                        : tr("Ferme", "Closed")}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-saffron">
              {tr("Dates de fermeture camion", "Truck closure dates")}
            </h4>

            <form onSubmit={handleAddClosure} className="mt-3 space-y-3">
              <label className="text-sm text-stone-300">
                {tr("Camion", "Truck")}
                <select
                  value={closureForm.agentId}
                  onChange={(event) =>
                    setClosureForm((prev) => ({ ...prev, agentId: event.target.value }))
                  }
                  required
                  className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                >
                  <option value="">{tr("Choisir un camion", "Choose a truck")}</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.code})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-stone-300">
                  {tr("Du", "From")}
                  <input
                    type="date"
                    value={closureForm.startDate}
                    onChange={(event) =>
                      setClosureForm((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                  />
                </label>

                <label className="text-sm text-stone-300">
                  {tr("Au", "To")}
                  <input
                    type="date"
                    value={closureForm.endDate}
                    onChange={(event) =>
                      setClosureForm((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                  />
                </label>
              </div>

              <label className="text-sm text-stone-300">
                {tr("Motif (optionnel)", "Reason (optional)")}
                <input
                  type="text"
                  value={closureForm.reason}
                  onChange={(event) =>
                    setClosureForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-saffron px-5 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tr("Ajouter fermeture", "Add closure")}
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {sortedClosures.length === 0 ? (
                <p className="text-sm text-stone-400">{tr("Aucune fermeture", "No closure")}</p>
              ) : (
                sortedClosures.map((closure) => (
                  <div
                    key={closure.id}
                    className="rounded-xl border border-white/10 bg-charcoal/45 px-3 py-2 text-sm text-stone-200"
                  >
                    <p className="font-semibold text-white">
                      {closure.agent?.name || tr("Camion", "Truck")} ({closure.agent?.code || "?"})
                    </p>
                    <p className="text-xs text-stone-300">
                      {tr("Du", "From")} {formatDateValue(closure.startDate)} {tr("au", "to")}{" "}
                      {formatDateValue(closure.endDate)}
                    </p>
                    {closure.reason ? <p className="text-xs text-stone-300">{closure.reason}</p> : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteClosure(closure.id)}
                      className="mt-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    >
                      {tr("Supprimer fermeture", "Delete closure")}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-white/10 bg-charcoal/35 p-5">
          {loading ? (
            <p className="text-sm text-stone-300">{tr("Chargement...", "Loading...")}</p>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <h3 className="text-lg font-bold text-white">
                  {editingService
                    ? tr(
                        `Modifier un service - ${WEEK_DAYS.find((day) => day.key === activeDay)?.labelFr || ""}`,
                        `Edit service - ${WEEK_DAYS.find((day) => day.key === activeDay)?.labelEn || ""}`
                      )
                    : tr(
                        `Ajouter un service - ${WEEK_DAYS.find((day) => day.key === activeDay)?.labelFr || ""}`,
                        `Add service - ${WEEK_DAYS.find((day) => day.key === activeDay)?.labelEn || ""}`
                      )}
                </h3>

                <form onSubmit={handleAddService} className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-stone-300">
                      {tr("Heure ouverture", "Opening time")}
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, startTime: event.target.value }))
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      />
                    </label>

                    <label className="text-sm text-stone-300">
                      {tr("Heure fermeture", "Closing time")}
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, endTime: event.target.value }))
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      />
                    </label>

                    <label className="text-sm text-stone-300">
                      {tr("Durée d'un créneau (min)", "Slot duration (min)")}
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={form.slotDuration}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            slotDuration: Number(event.target.value || DEFAULT_FORM.slotDuration),
                          }))
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      />
                    </label>

                    <label className="text-sm text-stone-300">
                      {tr("Max pizzas par créneau", "Max pizzas per slot")}
                      <input
                        type="number"
                        min="1"
                        value={form.maxPizzas}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            maxPizzas: Number(event.target.value || DEFAULT_FORM.maxPizzas),
                          }))
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      />
                    </label>

                    <label className="text-sm text-stone-300 sm:col-span-2">
                      {tr("Emplacement", "Location")}
                      <select
                        value={form.locationId}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, locationId: event.target.value }))
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      >
                        <option value="">{tr("Choisir un emplacement", "Choose a location")}</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {formatLocation(location, tr)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-stone-300 sm:col-span-2">
                      {tr("Camion lie", "Linked truck")}
                      <select
                        value={form.agentId}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, agentId: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                      >
                        <option value="">{tr("Aucun camion", "No truck")}</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} ({agent.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-saffron px-5 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? tr("Enregistrement...", "Saving...")
                        : editingService
                          ? tr("Enregistrer", "Save")
                          : tr("Ajouter ce service", "Add this service")}
                    </button>
                    {editingService ? (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {tr("Annuler", "Cancel")}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleCloseDay}
                      className="rounded-full border border-red-400/50 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {tr("FERMER JOUR", "CLOSE DAY")}
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-saffron">
                  {tr("Services du jour sélectionné", "Selected day services")}
                </h4>

                {activeDayServices.length === 0 ? (
                  <p className="mt-2 text-sm text-stone-400">{tr("Aucun service", "No service")}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {activeDayServices.map((service, index) => (
                      <div
                        key={service.id || `${service.startTime}-${service.endTime}-${index}`}
                        className="rounded-xl border border-white/10 bg-charcoal/45 px-3 py-2 text-sm text-stone-200"
                      >
                        {(() => {
                          const serviceKey = buildServiceManagerKey(activeDay, service);
                          const isManaging =
                            managedService &&
                            buildServiceManagerKey(activeDay, managedService) === serviceKey;

                          return (
                            <>
                              <p className="font-semibold text-white">
                                {service.startTime} - {service.endTime}
                              </p>
                              <p className="text-xs text-stone-300">
                                {tr("Durée", "Duration")}: {service.slotDuration} min |{" "}
                                {tr("Max", "Max")}: {service.maxPizzas}
                              </p>
                              <p className="text-xs text-stone-300">
                                {tr("Adresse", "Address")}: {formatLocation(service.location, tr)}
                              </p>
                              <p className="text-xs text-stone-300">
                                {tr("Camion", "Truck")}:{" "}
                                {service.agent?.name || tr("Non lie", "Not linked")}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditService(service)}
                                  className="rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-1 text-xs font-semibold text-saffron transition hover:bg-saffron/20"
                                >
                                  {tr("Modifier", "Edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleServiceManager(service)}
                                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                                    isManaging
                                      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                      : "border-white/20 bg-white/5 text-stone-100 hover:bg-white/10"
                                  }`}
                                >
                                  {isManaging
                                    ? tr("Fermer gestion créneaux", "Close slot management")
                                    : tr("Gestion créneaux", "Slot management")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteService(service)}
                                  className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                                >
                                  {tr("Supprimer ce service", "Delete this service")}
                                </button>
                              </div>

                              {isManaging ? (
                                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                    <label className="text-sm text-stone-300">
                                      {tr(
                                        "Date de service a gerer",
                                        "Service date to manage"
                                      )}
                                      <input
                                        type="date"
                                        value={managedServiceDate}
                                        onChange={(event) =>
                                          handleManagedServiceDateChange(event.target.value)
                                        }
                                        className="mt-1 w-full rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-white"
                                      />
                                    </label>

                                    <p className="max-w-md text-xs text-stone-400">
                                      {tr(
                                        "Ici vous gérez les créneaux commandes générés automatiquement pour cette vraie date. Vert = commandable, rouge = bloqué.",
                                        "Here you manage the automatically generated orderable slots for this real date. Green = orderable, red = blocked."
                                      )}
                                    </p>
                                  </div>

                                  {concreteSlotsLoading ? (
                                    <p className="mt-3 text-sm text-stone-300">
                                      {tr("Chargement des créneaux...", "Loading slots...")}
                                    </p>
                                  ) : managedConcreteSlots.length === 0 ? (
                                    <p className="mt-3 text-sm text-stone-400">
                                      {tr(
                                        "Aucun créneau généré pour cette date.",
                                        "No generated slot for this date."
                                      )}
                                    </p>
                                  ) : (
                                    <div className="mt-3 grid gap-2">
                                      {managedConcreteSlots.map((slot) => {
                                        const actionKey = `${managedServiceDate}:${slot.pickupTime}`;
                                        const isUpdating = updatingConcreteSlotKey === actionKey;
                                        const isActive = Boolean(slot.active);

                                        return (
                                          <button
                                            key={slot.slotId || `${slot.pickupTime}-${slot.locationId}`}
                                            type="button"
                                            disabled={isUpdating}
                                            onClick={() => handleToggleConcreteSlot(slot)}
                                            className={`w-full rounded-xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                              isActive
                                                ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                                                : "border-red-400/40 bg-red-500/10 hover:bg-red-500/15"
                                            }`}
                                          >
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                              <div>
                                                <p
                                                  className={`text-sm font-semibold ${
                                                    isActive ? "text-emerald-200" : "text-red-200"
                                                  }`}
                                                >
                                                  {slot.pickupTime} -{" "}
                                                  {isActive
                                                    ? tr("Actif", "Active")
                                                    : tr("Inactif", "Inactive")}
                                                </p>
                                                <p className="text-xs text-stone-300">
                                                  {tr("Reservees", "Reserved")}:{" "}
                                                  {Number(slot.currentPizzas || 0)} /{" "}
                                                  {Number(slot.maxPizzas || 0)}
                                                </p>
                                              </div>
                                              <span
                                                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                                  isActive
                                                    ? "bg-emerald-500/20 text-emerald-100"
                                                    : "bg-red-500/20 text-red-100"
                                                }`}
                                              >
                                                {isUpdating
                                                  ? tr("Mise à jour...", "Updating...")
                                                  : isActive
                                                    ? tr("Cliquer pour désactiver", "Click to disable")
                                                    : tr("Cliquer pour reactiver", "Click to reactivate")}
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <LocationManagerSection
        token={token}
        tr={tr}
        sectionId="emplacements"
        titleFr="Emplacements"
        titleEn="Locations"
        onLocationsChanged={refreshData}
      />
    </div>
  );
}
