import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  deletePrintAgentAdmin,
  deletePrintPrinterAdmin,
  getPrintAgentsAdmin,
  getPrintOverviewAdmin,
  getPrintPrintersAdmin,
  rotatePrintAgentTokenAdmin,
  runPrintSchedulerTickAdmin,
  upsertPrintAgentAdmin,
  upsertPrintPrinterAdmin,
} from "../api/admin.api";
import { getLocations } from "../api/location.api";
import { ActionIconButton, DeleteIcon, EditIcon } from "../components/ui/AdminActions";
import { getLocationDisplayName } from "../utils/location";

const AUTO_REFRESH_MS = 10_000;

const initialPrinterForm = {
  name: "",
  code: "",
  ipAddress: "",
  agentCode: "",
};

const initialTruckForm = {
  code: "",
  name: "",
  locationId: "",
};

function statusBadge(status) {
  const normalized = String(status || "").toUpperCase();
  if (["ONLINE", "PRINTED", "READY"].includes(normalized)) {
    return "bg-emerald-500/20 text-emerald-200 border-emerald-300/40";
  }
  if (["DEGRADED", "RETRY_WAITING", "CLAIMED", "PRINTING", "PENDING"].includes(normalized)) {
    return "bg-amber-500/20 text-amber-200 border-amber-300/40";
  }
  return "bg-red-500/20 text-red-200 border-red-300/40";
}

function formatPrinterRuntimeLabel(runtimeStatus, tr) {
  const normalized = String(runtimeStatus || "UNKNOWN").toUpperCase();
  if (normalized === "ONLINE") return tr("Connectee", "Connected");
  if (normalized === "DEGRADED") return tr("Degradee", "Degraded");
  if (normalized === "OFFLINE") return tr("Hors ligne", "Offline");
  if (normalized === "INACTIVE") return tr("Inactive", "Inactive");
  if (normalized === "UNASSIGNED") return tr("Non assignee", "Unassigned");
  return tr("Inconnu", "Unknown");
}

function truckStatusBadge(isOn) {
  return isOn
    ? "bg-emerald-500/20 text-emerald-200 border-emerald-300/40"
    : "bg-red-500/20 text-red-200 border-red-300/40";
}

function normalizePrinterRuntimeForTruck(printer, piStatus) {
  if (!printer?.isActive) return "INACTIVE";
  const runtime = String(printer?.runtime?.status || "").toUpperCase();
  if (runtime) return runtime;
  return String(piStatus || "").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE";
}

function computeTruckPiOn(agentStatus) {
  return String(agentStatus || "").toUpperCase() === "ONLINE";
}

function computeTruckPrintOn(agentStatus, linkedPrinters) {
  const piOn = computeTruckPiOn(agentStatus);
  if (!piOn) return false;

  const activePrinters = (linkedPrinters || []).filter((printer) => printer?.isActive);
  if (activePrinters.length === 0) return false;

  return activePrinters.every(
    (printer) => normalizePrinterRuntimeForTruck(printer, agentStatus) === "ONLINE"
  );
}

function getLinkedLocationInfo(printers, tr) {
  const locationMap = new Map();

  for (const printer of printers || []) {
    if (printer?.location?.id) {
      locationMap.set(
        String(printer.location.id),
        getLocationDisplayName(printer.location, String(printer.location.id))
      );
    }
  }

  const ids = Array.from(locationMap.keys());
  if (ids.length === 0) {
    return {
      label: tr("Global", "Global"),
      selectValue: "",
    };
  }

  if (ids.length === 1) {
    return {
      label: locationMap.get(ids[0]),
      selectValue: ids[0],
    };
  }

  return {
    label: Array.from(locationMap.values()).join(", "),
    selectValue: "__MULTI__",
  };
}

export default function PrintAdmin() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [overview, setOverview] = useState(null);
  const [agents, setAgents] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [runningTick, setRunningTick] = useState(false);
  const [busyByKey, setBusyByKey] = useState({});
  const [message, setMessage] = useState("");
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [truckForm, setTruckForm] = useState(initialTruckForm);
  const [truckTokenInfo, setTruckTokenInfo] = useState(null);

  const [printerForm, setPrinterForm] = useState(initialPrinterForm);

  const setBusy = (key, value) => {
    setBusyByKey((prev) => ({ ...prev, [key]: value }));
  };

  const refreshAll = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;
    setLoading(true);
    try {
      const [nextOverview, nextAgents, nextPrinters, nextLocations] = await Promise.all([
        getPrintOverviewAdmin(token),
        getPrintAgentsAdmin(token),
        getPrintPrintersAdmin(token),
        getLocations(),
      ]);
      setOverview(nextOverview || null);
      setAgents(Array.isArray(nextAgents) ? nextAgents : []);
      setPrinters(Array.isArray(nextPrinters) ? nextPrinters : []);
      setLocations(Array.isArray(nextLocations) ? nextLocations : []);
      setMessage("");
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur de chargement impression", "Print loading error"));
    } finally {
      setLoading(false);
    }
  }, [token, user, tr]);

  useEffect(() => {
    if (authLoading) return undefined;
    refreshAll();
    const timer = setInterval(refreshAll, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [authLoading, refreshAll]);

  const alertCount = useMemo(() => {
    const agentAlerts = overview?.agents?.alerts?.length || 0;
    const metadataPrinterAlerts = overview?.printers?.alerts?.metadataIssues?.length || 0;
    const inactivePrinterAlerts = overview?.printers?.alerts?.inactive?.length || 0;
    const readyStaleAlerts = overview?.jobs?.alerts?.readyStaleCount || 0;
    return agentAlerts + metadataPrinterAlerts + inactivePrinterAlerts + readyStaleAlerts;
  }, [overview]);

  const locationOptions = useMemo(() => {
    const map = new Map();
    for (const location of locations) {
      if (!map.has(location.id)) {
        map.set(location.id, location);
      }
    }
    return Array.from(map.values());
  }, [locations]);

  const applyTruckLocationLink = async (agentCode, locationId, { silentNoPrinter = false, skipRefresh = false } = {}) => {
    const targetPrinters = (printers || []).filter((printer) => printer?.agent?.code === agentCode);
    if (targetPrinters.length === 0) {
      if (!silentNoPrinter) {
        setMessage(
          tr(
            "Aucune imprimante liee a ce camion. Configure une imprimante ci-dessous.",
            "No printer linked to this truck. Configure a printer below."
          )
        );
      }
      return false;
    }

    for (const printer of targetPrinters) {
      await upsertPrintPrinterAdmin(token, {
        code: printer.code,
        name: printer.name,
        model: printer.model || null,
        paperWidthMm: Number(printer.paperWidthMm || 80),
        connectionType: printer.connectionType || "ETHERNET",
        ipAddress: printer.ipAddress || null,
        port: Number(printer.port || 9100),
        isActive: Boolean(printer.isActive),
        agentCode,
        locationId: locationId === "" ? null : Number(locationId),
      });
    }

    if (!skipRefresh) {
      await refreshAll();
    }
    return true;
  };

  const handleCreateTruck = async (event) => {
    event.preventDefault();
    if (!truckForm.code.trim() || !truckForm.name.trim()) {
      setMessage(tr("Code et nom camion obligatoires", "Truck code and name are required"));
      return;
    }

    const busyKey = "create-truck";
    setBusy(busyKey, true);
    try {
      const normalizedCode = truckForm.code.trim();
      const result = await upsertPrintAgentAdmin(token, {
        code: normalizedCode,
        name: truckForm.name.trim(),
      });

      if (result?.token) {
        setTruckTokenInfo({
          code: normalizedCode,
          token: result.token,
        });
      }

      await refreshAll();

      let feedback = tr("Camion enregistre", "Truck saved");
      if (truckForm.locationId !== "") {
        const linked = await applyTruckLocationLink(normalizedCode, truckForm.locationId, {
          silentNoPrinter: true,
          skipRefresh: true,
        });
        if (linked) {
          feedback = tr("Camion enregistre et lie a l'emplacement", "Truck saved and linked to location");
        } else {
          feedback = tr(
            "Camion enregistre. L'emplacement sera applique une fois une imprimante liee.",
            "Truck saved. Location will be applied once a printer is linked."
          );
        }
        await refreshAll();
      }

      setMessage(feedback);
      setTruckForm(initialTruckForm);
      setShowTruckForm(false);
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur creation camion", "Truck creation error"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleDeleteTruck = async (agentCode) => {
    if (!window.confirm(tr("Supprimer ce camion ?", "Delete this truck?"))) return;
    const busyKey = `delete-truck:${agentCode}`;
    setBusy(busyKey, true);
    try {
      await deletePrintAgentAdmin(token, agentCode);
      setMessage(tr("Camion supprime", "Truck deleted"));
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur suppression camion", "Truck deletion error"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleRotateTruckToken = async (agentCode) => {
    const busyKey = `rotate-truck:${agentCode}`;
    setBusy(busyKey, true);
    try {
      const result = await rotatePrintAgentTokenAdmin(token, agentCode);
      if (result?.token) {
        setTruckTokenInfo({
          code: agentCode,
          token: result.token,
        });
      }
      setMessage(tr("Nouveau token généré", "New token generated"));
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur rotation token camion", "Truck token rotation error"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleLinkTruckToLocation = async (agentCode, locationId) => {
    const busyKey = `link-truck:${agentCode}`;
    setBusy(busyKey, true);
    try {
      const linked = await applyTruckLocationLink(agentCode, locationId);
      if (linked) {
        setMessage(tr("Camion lie a l'emplacement", "Truck linked to location"));
      }
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur liaison camion/emplacement", "Truck/location link error"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleCreateOrUpdatePrinter = async (event) => {
    event.preventDefault();
    if (!printerForm.code.trim() || !printerForm.name.trim()) {
      setMessage(tr("Code et nom imprimante obligatoires", "Printer code and name are required"));
      return;
    }

    const busyKey = "upsert-printer";
    setBusy(busyKey, true);
    try {
      const normalizedCode = printerForm.code.trim().toLowerCase();
      const existingPrinter = (printers || []).find(
        (entry) => String(entry?.code || "").trim().toLowerCase() === normalizedCode
      ) || null;

      const payload = {
        code: printerForm.code.trim(),
        name: printerForm.name.trim(),
        model: existingPrinter?.model || null,
        paperWidthMm: Number(existingPrinter?.paperWidthMm || 80),
        connectionType: existingPrinter?.connectionType || "ETHERNET",
        ipAddress: printerForm.ipAddress.trim() || null,
        port: Number(existingPrinter?.port || 9100),
        isActive: typeof existingPrinter?.isActive === "boolean" ? existingPrinter.isActive : true,
        agentCode: printerForm.agentCode.trim() || null,
        locationId: existingPrinter?.location?.id ?? null,
      };

      await upsertPrintPrinterAdmin(token, payload);
      setPrinterForm(initialPrinterForm);
      setMessage(tr("Imprimante enregistree", "Printer saved"));
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Echec enregistrement imprimante", "Printer save failed"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleEditPrinter = (printer) => {
    setPrinterForm({
      name: printer?.name || "",
      code: printer?.code || "",
      ipAddress: printer?.ipAddress || "",
      agentCode: printer?.agent?.code || "",
    });
  };

  const handleDeletePrinter = async (printerCode) => {
    if (!window.confirm(tr("Supprimer cette imprimante ?", "Delete this printer?"))) return;
    const busyKey = `delete-printer:${printerCode}`;
    setBusy(busyKey, true);
    try {
      await deletePrintPrinterAdmin(token, printerCode);
      setMessage(tr("Imprimante supprimée", "Printer deleted"));
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Echec suppression imprimante", "Printer deletion failed"));
    } finally {
      setBusy(busyKey, false);
    }
  };

  const handleTick = async () => {
    setRunningTick(true);
    try {
      const result = await runPrintSchedulerTickAdmin(token);
      setMessage(
        tr(
          `Tick OK: ${result.pending_to_ready || 0} pending->ready, ${result.retry_to_ready || 0} retry->ready`,
          `Tick OK: ${result.pending_to_ready || 0} pending->ready, ${result.retry_to_ready || 0} retry->ready`
        )
      );
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Echec du tick scheduler", "Scheduler tick failed"));
    } finally {
      setRunningTick(false);
    }
  };

  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">{tr("Camions & impressions", "Trucks & printing")}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshAll}
            className="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/15"
          >
            {loading ? tr("Actualisation...", "Refreshing...") : tr("Actualiser", "Refresh")}
          </button>
          <button
            type="button"
            onClick={handleTick}
            disabled={runningTick}
            className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningTick ? tr("Tick en cours...", "Tick running...") : tr("Forcer tick scheduler", "Force scheduler tick")}
          </button>
        </div>
      </div>

      {alertCount > 0 && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">{tr("Alerte impression", "Print alert")} ({alertCount})</p>
          <p className="text-xs text-red-100">
            {tr(
              "Un agent, une imprimante ou un job prêt trop ancien est en alerte. Vérifier papier, réseau, dernier signal PI et tickets.",
              "An agent, printer or stale READY job is in alert. Check paper, network, latest Pi signal and tickets."
            )}
          </p>
        </div>
      )}

      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-200">{message}</p>
      )}

      {truckTokenInfo?.token && (
        <div className="rounded-lg border border-sky-300/40 bg-sky-500/10 p-3 text-sm text-sky-100">
          <p className="font-semibold">{tr("Token PI (affiche apres creation/rotation)", "Pi token (shown after create/rotate)")}</p>
          <p className="mt-1 break-all font-mono text-xs">
            {truckTokenInfo.code}: {truckTokenInfo.token}
          </p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-stone-400">{tr("Tickets", "Tickets")}</p>
          <p className="mt-1 text-xl font-bold text-white">{overview?.jobs?.total ?? 0}</p>
          <p className="text-xs text-stone-300">{tr("Echecs 24h", "Failed 24h")}: {overview?.jobs?.failedLast24h ?? 0}</p>
          <p className="text-[11px] text-stone-400">
            {tr("READY > seuil", "READY > threshold")}: {overview?.jobs?.alerts?.readyStaleCount ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-stone-400">{tr("Camions (agents)", "Trucks (agents)")}</p>
          <p className="mt-1 text-xl font-bold text-white">{overview?.agents?.total ?? 0}</p>
          <p className="text-xs text-stone-300">
            {tr("En ligne", "Online")} {overview?.agents?.online ?? 0} | {tr("Dégradés", "Degraded")} {overview?.agents?.degraded ?? 0} | {tr("Hors ligne", "Offline")} {overview?.agents?.offline ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-stone-400">{tr("Imprimantes", "Printers")}</p>
          <p className="mt-1 text-xl font-bold text-white">{overview?.printers?.total ?? 0}</p>
          <p className="text-xs text-stone-300">
            {tr("Connectées", "Connected")} {overview?.printers?.connected ?? 0} | {tr("Hors ligne", "Offline")} {overview?.printers?.offline ?? 0} | {tr("Dégradées", "Degraded")} {overview?.printers?.degraded ?? 0}
          </p>
          <p className="text-[11px] text-stone-400">
            {tr("Config actives", "Active config")} {overview?.printers?.active ?? 0} | {tr("Inactives", "Inactive")} {overview?.printers?.inactive ?? 0}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">
            {tr("Gestion camions", "Truck management")}
          </h3>
          <button
            type="button"
            onClick={() => setShowTruckForm((prev) => !prev)}
            className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
          >
            {showTruckForm ? tr("Fermer le formulaire", "Close form") : tr("Ajouter un camion", "Add truck")}
          </button>
        </div>

        {showTruckForm && (
          <form onSubmit={handleCreateTruck} className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs text-stone-300">
                <span>{tr("Code camion", "Truck code")}</span>
                <input
                  placeholder="pizza_truck_00"
                  value={truckForm.code}
                  onChange={(event) => setTruckForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
                />
              </label>
              <label className="grid gap-1 text-xs text-stone-300">
                <span>{tr("Nom camion", "Truck name")}</span>
                <input
                  placeholder="Pi Camion 00"
                  value={truckForm.name}
                  onChange={(event) => setTruckForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
                />
              </label>
            </div>
            <label className="grid gap-1 text-xs text-stone-300">
              <span>{tr("Emplacement", "Location")}</span>
              <select
                value={truckForm.locationId}
                onChange={(event) => setTruckForm((prev) => ({ ...prev, locationId: event.target.value }))}
                className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
              >
                <option value="">{tr("Global", "Global")}</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {getLocationDisplayName(location, String(location.id))}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busyByKey["create-truck"]}
              className="rounded-lg border border-saffron/40 bg-saffron/15 px-3 py-2 text-xs font-semibold text-saffron md:col-span-3 disabled:opacity-60"
            >
              {tr("Créer camion", "Create truck")}
            </button>
          </form>
        )}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-stone-400">
                <th className="pb-2">{tr("Nom camion", "Truck name")}</th>
                <th className="pb-2">{tr("Etat PI", "PI status")}</th>
                <th className="pb-2">{tr("Etat print", "Print status")}</th>
                <th className="pb-2">{tr("Sélection emplacement", "Location sélection")}</th>
                <th className="pb-2">{tr("Token", "Token")}</th>
                <th className="pb-2">{tr("Supprimer", "Delete")}</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-2 text-stone-400">{tr("Aucun camion", "No truck")}</td>
                </tr>
              )}
              {agents.map((agent) => {
                const agentPrinters = (printers || []).filter((printer) => printer?.agent?.code === agent.code);
                const piOn = computeTruckPiOn(agent.status);
                const printOn = computeTruckPrintOn(agent.status, agentPrinters);
                const linkedLocationInfo = getLinkedLocationInfo(agentPrinters, tr);
                const isLinking = busyByKey[`link-truck:${agent.code}`];
                const isRotating = busyByKey[`rotate-truck:${agent.code}`];
                const isDeleting = busyByKey[`delete-truck:${agent.code}`];

                return (
                  <tr key={agent.id} className="border-t border-white/10">
                    <td className="py-2 text-stone-100">
                      <span className="font-medium">{agent.name}</span>
                      <span className="ml-2 text-xs text-stone-400">({agent.code})</span>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${truckStatusBadge(piOn)}`}>
                        {piOn ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${truckStatusBadge(printOn)}`}>
                        {printOn ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        value={linkedLocationInfo.selectValue}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "__MULTI__") return;
                          handleLinkTruckToLocation(agent.code, value);
                        }}
                        disabled={isLinking}
                        className="rounded-lg border border-white/20 bg-charcoal/70 px-2 py-1.5 text-xs text-stone-100"
                      >
                        {linkedLocationInfo.selectValue === "__MULTI__" && (
                          <option value="__MULTI__" disabled>
                            {tr("Multiple", "Multiple")}
                          </option>
                        )}
                        <option value="">{tr("Global", "Global")}</option>
                        {locationOptions.map((location) => (
                          <option key={location.id} value={location.id}>
                            {getLocationDisplayName(location, String(location.id))}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleRotateTruckToken(agent.code)}
                        disabled={isRotating}
                        className="rounded-lg border border-sky-300/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 disabled:opacity-60"
                      >
                        {tr("Generer token", "Generate token")}
                      </button>
                    </td>
                    <td className="py-2">
                      <ActionIconButton
                        onClick={() => handleDeleteTruck(agent.code)}
                        label={tr("Supprimer", "Delete")}
                        variant="danger"
                        disabled={isDeleting}
                      >
                        <DeleteIcon />
                      </ActionIconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-saffron">{tr("Créer/mettre a jour une imprimante", "Create/update a printer")}</h3>
        <form onSubmit={handleCreateOrUpdatePrinter} className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-stone-300">
            <span>{tr("Nom imprimante", "Printer name")}</span>
            <input
              value={printerForm.name}
              onChange={(event) => setPrinterForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Imprimante camion 0"
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-300">
            <span>{tr("Code imprimante", "Printer code")}</span>
            <input
              value={printerForm.code}
              onChange={(event) => setPrinterForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="print_truck_00"
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-300">
            <span>{tr("Adresse IP", "IP address")}</span>
            <input
              value={printerForm.ipAddress}
              onChange={(event) => setPrinterForm((prev) => ({ ...prev, ipAddress: event.target.value }))}
              placeholder="192.168.50.20"
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
            />
          </label>
          <label className="grid gap-1 text-xs text-stone-300">
            <span>{tr("Camion lie", "Linked truck")}</span>
            <select
              value={printerForm.agentCode}
              onChange={(event) => setPrinterForm((prev) => ({ ...prev, agentCode: event.target.value }))}
              className="rounded-lg border border-white/20 bg-charcoal/70 px-3 py-2 text-sm text-stone-100"
            >
              <option value="">{tr("Aucun camion", "No truck")}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.code}>
                  {agent.name} ({agent.code})
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busyByKey["upsert-printer"]}
            className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-60 md:col-span-4"
          >
            {tr("Enregistrer imprimante", "Save printer")}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          {printers.length === 0 ? (
            <p className="text-xs text-stone-400">{tr("Aucune imprimante", "No printer")}</p>
          ) : (
            printers.map((printer) => {
              const busyDelete = busyByKey[`delete-printer:${printer.code}`];
              return (
                <article key={printer.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{printer.name}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        statusBadge(printer?.runtime?.status || (printer.isActive ? "ONLINE" : "INACTIVE"))
                      }`}
                    >
                      {formatPrinterRuntimeLabel(printer?.runtime?.status || (printer.isActive ? "ONLINE" : "INACTIVE"), tr)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ActionIconButton onClick={() => handleEditPrinter(printer)} label={tr("Modifier", "Edit")}>
                      <EditIcon />
                    </ActionIconButton>
                    <ActionIconButton
                      onClick={() => handleDeletePrinter(printer.code)}
                      label={tr("Supprimer", "Delete")}
                      variant="danger"
                      disabled={busyDelete}
                    >
                      <DeleteIcon />
                    </ActionIconButton>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
