import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getPrintJobsAdmin, reprintJobAdmin } from "../api/admin.api";
import { getOrderNote } from "../utils/orderNote";
import { splitPersonName } from "../utils/personName";

const AUTO_REFRESH_MS = 10_000;

function formatDateTime(value, locale) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function formatStatusLabel(status, tr) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  if (normalized === "PENDING") return tr("En attente", "Pending");
  if (normalized === "READY") return tr("Pret", "Ready");
  if (normalized === "CLAIMED") return tr("Reserve", "Claimed");
  if (normalized === "PRINTING") return tr("En impression", "Printing");
  if (normalized === "PRINTED") return tr("Imprime", "Printed");
  if (normalized === "FAILED") return tr("Echec", "Failed");
  if (normalized === "RETRY_WAITING") return tr("Nouvel essai", "Retry waiting");
  if (normalized === "CANCELLED") return tr("Annule", "Cancelled");
  return tr("Inconnu", "Unknown");
}

function sanitizeTicketText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatTicketPickup(value) {
  const raw = sanitizeTicketText(value);
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function buildTicketPreview(job) {
  const payload = job?.payload || {};
  const order = payload?.order || {};
  const customer = order?.customer || {};
  const items = Array.isArray(order?.items) ? order.items : [];
  const isCopy = Boolean(job?.reprintOfJobId || payload?.reprint?.source_job_id);
  const ticketStatus = isCopy ? "COPIE" : "ORIGINAL";
  const agentName = sanitizeTicketText(job?.claimedByAgent?.name || "Pi Camion");
  const orderNumber = sanitizeTicketText(order?.number || `A-${order?.id || job?.orderId || "?"}`);
  const firstName = sanitizeTicketText(customer?.first_name || "");
  const lastName = sanitizeTicketText(customer?.last_name || "");
  const fullName = sanitizeTicketText(customer?.full_name || "");
  const displayFirstName = firstName || (fullName ? fullName.split(" ")[0] : "-");
  const displayLastName = lastName || (fullName ? fullName.split(" ").slice(1).join(" ") || "-" : "-");
  const phone = sanitizeTicketText(customer?.phone || "-");
  const currency = sanitizeTicketText(order?.currency || "EUR");
  const total = sanitizeTicketText(order?.total || "0.00");
  const note = sanitizeTicketText(order?.note || "");

  const lines = [
    ticketStatus,
    agentName,
    "-".repeat(42),
    `TICKET COMMANDE N: ${orderNumber}`,
    `Heure retrait: ${formatTicketPickup(order?.pickup_time)}`,
    "-".repeat(42),
    "INFOS CLIENT",
    `Nom: ${displayLastName}`,
    `Prénom: ${displayFirstName}`,
    `Numéro: ${phone}`,
    "-".repeat(42),
    "DETAILS COMMANDE",
  ];

  for (const item of items) {
    const qty = Number(item?.qty || 0);
    const name = sanitizeTicketText(item?.name || "Produit");
    lines.push(`${qty}x ${name}`);

    const added = Array.isArray(item?.added_ingredients) ? item.added_ingredients : [];
    const removed = Array.isArray(item?.removed_ingredients) ? item.removed_ingredients : [];

    if (added.length > 0) {
      lines.push(`+ ${added.map((entry) => sanitizeTicketText(entry)).join(", ")}`);
    }
    if (removed.length > 0) {
      lines.push(`- ${removed.map((entry) => sanitizeTicketText(entry)).join(", ")}`);
    }
  }

  lines.push("-".repeat(42));
  lines.push(`Total: ${total} ${currency}`);
  if (note) {
    lines.push(`Note: ${note}`);
  }

  return lines.join("\n");
}

function toTimestamp(value) {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function dedupeTicketsByOrder(jobs) {
  const sorted = [...(Array.isArray(jobs) ? jobs : [])].sort((left, right) => {
    const rightTs = Math.max(toTimestamp(right?.updatedAt), toTimestamp(right?.createdAt));
    const leftTs = Math.max(toTimestamp(left?.updatedAt), toTimestamp(left?.createdAt));
    return rightTs - leftTs;
  });

  const seen = new Set();
  const deduped = [];

  for (const job of sorted) {
    const hasOrderId = Number(job?.orderId || 0) > 0;
    const stableFallback = [
      job?.id,
      job?.createdAt,
      job?.updatedAt,
      job?.status,
      job?.printerCode,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("|");
    const key = hasOrderId ? `order:${job.orderId}` : `job:${stableFallback || "unknown"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(job);
  }

  return deduped;
}

function getTicketPickupTimestamp(job) {
  const pickupRaw =
    job?.payload?.order?.pickup_time ||
    job?.order?.timeSlot?.startTime ||
    job?.scheduledAt ||
    null;
  const parsed = new Date(pickupRaw || 0);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return parsed.getTime();
}

function isSameLocalDay(leftDate, rightDate) {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function compareTicketsByPickupAsc(left, right) {
  const leftTs = getTicketPickupTimestamp(left);
  const rightTs = getTicketPickupTimestamp(right);
  if (leftTs !== rightTs) return leftTs - rightTs;

  const leftCreated = toTimestamp(left?.createdAt);
  const rightCreated = toTimestamp(right?.createdAt);
  return leftCreated - rightCreated;
}

function getTicketState(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "FAILED") return "error";
  if (["RETRY_WAITING", "CLAIMED", "PRINTING", "PENDING"].includes(normalized)) return "warning";
  if (["READY", "PRINTED"].includes(normalized)) return "healthy";
  return "muted";
}

function cardTone(state) {
  if (state === "error") {
    return "border-red-400/35 bg-red-500/10";
  }
  if (state === "warning") {
    return "border-amber-300/35 bg-amber-500/10";
  }
  if (state === "healthy") {
    return "border-emerald-300/25 bg-emerald-500/5";
  }
  return "border-white/10 bg-black/20";
}

function getStateLabel(state, tr) {
  if (state === "error") return tr("Erreur ticket", "Ticket issue");
  if (state === "warning") return tr("A surveiller", "Needs attention");
  if (state === "healthy") return tr("OK / reimprimable", "OK / reprintable");
  return tr("Secondaire", "Secondary");
}

export default function TicketsAdmin() {
  const { user, token, loading: authLoading } = useContext(AuthContext);
  const { tr, locale } = useLanguage();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reprintingByJobId, setReprintingByJobId] = useState({});
  const [reprintingAllFailed, setReprintingAllFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [previewJob, setPreviewJob] = useState(null);
  const [ticketTab, setTicketTab] = useState("today");
  const [statusFilter, setStatusFilter] = useState("attention");

  const refreshAll = useCallback(async () => {
    if (!token || user?.role !== "ADMIN") return;
    setLoading(true);
    try {
      const nextJobs = await getPrintJobsAdmin(token, { limit: 50 });
      const latestTicketPerOrder = dedupeTicketsByOrder(nextJobs);
      setJobs(latestTicketPerOrder);
      setMessage("");
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Erreur de chargement tickets", "Ticket loading error"));
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

  const todayTickets = useMemo(() => {
    const now = new Date();
    return jobs
      .filter((job) => {
        const pickupTs = getTicketPickupTimestamp(job);
        if (!Number.isFinite(pickupTs)) return false;
        return isSameLocalDay(new Date(pickupTs), now);
      })
      .sort(compareTicketsByPickupAsc);
  }, [jobs]);

  const allTickets = useMemo(() => [...jobs].sort(compareTicketsByPickupAsc), [jobs]);
  const scopedTickets = ticketTab === "all" ? allTickets : todayTickets;
  const ticketSummary = useMemo(
    () =>
      scopedTickets.reduce(
        (acc, job) => {
          const state = getTicketState(job?.status);
          acc.total += 1;
          acc[state] += 1;
          return acc;
        },
        { total: 0, error: 0, warning: 0, healthy: 0, muted: 0 }
      ),
    [scopedTickets]
  );
  const visibleTickets = useMemo(() => {
    if (statusFilter === "all") return scopedTickets;
    if (statusFilter === "error") {
      return scopedTickets.filter((job) => getTicketState(job?.status) === "error");
    }
    if (statusFilter === "healthy") {
      return scopedTickets.filter((job) => getTicketState(job?.status) === "healthy");
    }
    return scopedTickets.filter((job) => {
      const state = getTicketState(job?.status);
      return state === "error" || state === "warning";
    });
  }, [scopedTickets, statusFilter]);

  const handleReprint = async (jobId) => {
    if (!window.confirm(tr("Relancer l'impression de ce ticket ?", "Reprint this ticket?"))) return;
    setReprintingByJobId((prev) => ({ ...prev, [jobId]: true }));
    try {
      await reprintJobAdmin(token, jobId, { copies: 1, reason: "manual_reprint_admin" });
      setMessage(tr("Ticket ajoute en réimpression", "Reprint job created"));
      await refreshAll();
    } catch (err) {
      setMessage(err?.response?.data?.error || tr("Echec de réimpression", "Reprint failed"));
    } finally {
      setReprintingByJobId((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleReprintAllFailed = async () => {
    const failedTickets = visibleTickets.filter((job) => String(job?.status || "").toUpperCase() === "FAILED");
    if (failedTickets.length === 0) {
      setMessage(tr("Aucun ticket FAILED a reimprimer", "No FAILED ticket to reprint"));
      return;
    }
    if (!window.confirm(tr("Relancer tous les tickets FAILED visibles ?", "Reprint all visible FAILED tickets?"))) return;

    setReprintingAllFailed(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const job of failedTickets) {
        try {
          await reprintJobAdmin(token, job.id, { copies: 1, reason: "bulk_failed_reprint_admin" });
          successCount += 1;
        } catch (_err) {
          failCount += 1;
        }
      }
      setMessage(
        tr(
          `Reimpression lancee: ${successCount} OK, ${failCount} en erreur`,
          `Reprint started: ${successCount} OK, ${failCount} failed`
        )
      );
      await refreshAll();
    } finally {
      setReprintingAllFailed(false);
    }
  };

  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">
            {tr("Suivi impression", "Print monitoring")}
          </p>
          <h2 className="text-2xl font-bold text-white">{tr("Tickets", "Tickets")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-300">
            {tr(
              "Vérifiez en un coup d'oeil si un ticket est en erreur, a surveiller ou prêt a être reimprime.",
              "Check at a glance whether a ticket has an issue, needs attention, or is ready to reprint."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/orders"
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/15"
          >
            {tr("Voir les commandes", "Open orders")}
          </Link>
          <button
            type="button"
            onClick={refreshAll}
            className="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/15"
          >
            {loading ? tr("Actualisation...", "Refreshing...") : tr("Actualiser", "Refresh")}
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-200">{message}</p>
      )}

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <article className="rounded-xl border border-red-400/25 bg-red-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-red-200">
              {tr("Erreurs ticket", "Ticket issues")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{ticketSummary.error}</p>
            <p className="mt-1 text-xs text-red-100/80">
              {tr("FAILED a traiter rapidement.", "FAILED jobs that need action quickly.")}
            </p>
          </article>
          <article className="rounded-xl border border-amber-300/25 bg-amber-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
              {tr("A surveiller", "Needs attention")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{ticketSummary.warning}</p>
            <p className="mt-1 text-xs text-amber-100/80">
              {tr("Retry, printing ou claimed.", "Retry, printing or claimed jobs.")}
            </p>
          </article>
          <article className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
              {tr("OK / reimprimable", "OK / reprintable")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{ticketSummary.healthy}</p>
            <p className="mt-1 text-xs text-emerald-100/80">
              {tr("PRINTED ou READY, réimpression possible.", "PRINTED or READY, reprint available.")}
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">
              {tr("Tickets visibles", "Visible tickets")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{visibleTickets.length}</p>
            <p className="mt-1 text-xs text-stone-400">
              {tr("Sur", "Out of")} {scopedTickets.length} {tr("tickets dans la vue active.", "tickets in the active view.")}
            </p>
          </article>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-saffron">{tr("Gestion tickets", "Ticket management")}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setTicketTab("today")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                ticketTab === "today"
                  ? "border-saffron/40 bg-saffron/15 text-saffron"
                  : "border-white/20 bg-white/5 text-stone-200 hover:bg-white/10"
              }`}
            >
              {tr("Tickets du jour", "Today's tickets")} ({todayTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTicketTab("all")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                ticketTab === "all"
                  ? "border-saffron/40 bg-saffron/15 text-saffron"
                  : "border-white/20 bg-white/5 text-stone-200 hover:bg-white/10"
              }`}
            >
              {tr("Tous les tickets", "All tickets")} ({allTickets.length})
            </button>
            <button
              type="button"
              onClick={handleReprintAllFailed}
              disabled={reprintingAllFailed}
              className="rounded-lg border border-sky-300/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reprintingAllFailed
                ? tr("Reimpression en cours...", "Reprinting...")
                : tr("Reimprimer tous les FAILED", "Reprint all FAILED")}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { key: "attention", label: tr("Priorite tickets", "Priority tickets"), count: ticketSummary.error + ticketSummary.warning },
            { key: "error", label: tr("Erreurs", "Issues"), count: ticketSummary.error },
            { key: "healthy", label: tr("OK / reimprimables", "OK / reprintable"), count: ticketSummary.healthy },
            { key: "all", label: tr("Tout afficher", "Show all"), count: scopedTickets.length },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setStatusFilter(option.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === option.key
                  ? "border-saffron/40 bg-saffron/15 text-saffron"
                  : "border-white/20 bg-white/5 text-stone-200 hover:bg-white/10"
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
        {visibleTickets.length === 0 ? (
          <p className="text-xs text-stone-400">
            {statusFilter === "attention"
              ? tr("Aucun ticket prioritaire dans cette vue.", "No priority ticket in this view.")
              : ticketTab === "all"
                ? tr("Aucun ticket", "No ticket")
                : tr("Aucun ticket du jour", "No ticket for today")}
          </p>
        ) : (
          <div className="space-y-3">
            {visibleTickets.map((job) => {
              const parsedName = splitPersonName(job?.order?.user || {});
              const note = getOrderNote(job?.order || {});
              const canReprint = ["PRINTED", "FAILED", "RETRY_WAITING"].includes(String(job.status || "").toUpperCase());
              const ticketState = getTicketState(job?.status);
              return (
                <article key={job.id} className={`rounded-xl border p-4 ${cardTone(ticketState)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          #{job.orderId} - {job.printer?.code || "-"}
                        </p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(job.status)}`}>
                          {formatStatusLabel(job.status, tr)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-200">
                          {getStateLabel(ticketState, tr)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-stone-300">
                        {tr("Client", "Customer")}: {parsedName.fullName || job?.order?.user?.name || "-"} |{" "}
                        {tr("Retrait", "Pickup")}: {formatDateTime(job?.payload?.order?.pickup_time, locale)} |{" "}
                        {tr("Total", "Total")}: {job?.payload?.order?.total || "-"} EUR
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-stone-400">
                      <p>{tr("Job", "Job")}: {job.id}</p>
                      {job?.reprintOfJobId ? <p>{tr("Copie de", "Copy of")}: {job.reprintOfJobId}</p> : null}
                    </div>
                  </div>
                  {note && <p className="mt-1 text-xs text-stone-200">{tr("Note", "Note")}: {note}</p>}
                  {job?.lastErrorMessage ? (
                    <div className="mt-2 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                      <strong className="font-semibold">{tr("Erreur", "Issue")}:</strong> {job.lastErrorMessage}
                    </div>
                  ) : null}
                  <p className="mt-1 text-[11px] text-stone-400">
                    {tr("Planifie", "Scheduled")}: {formatDateTime(job.scheduledAt, locale)} |{" "}
                    {tr("Dernière MAJ", "Last update")}: {formatDateTime(job.updatedAt, locale)} |{" "}
                    {tr("Tentatives", "Attempts")}: {job?.attemptCount ?? 0}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewJob(job)}
                      className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-stone-100 transition hover:bg-white/15"
                    >
                      {tr("Aperçu ticket", "Ticket preview")}
                    </button>
                    <button
                      type="button"
                      disabled={!canReprint || reprintingByJobId[job.id]}
                      onClick={() => handleReprint(job.id)}
                      className="rounded-lg border border-sky-300/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reprintingByJobId[job.id] ? tr("Reimpression...", "Reprinting...") : tr("Reimprimer", "Reprint")}
                    </button>
                    <Link
                      to={`/admin/orders`}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-stone-100 transition hover:bg-white/10"
                    >
                      {tr("Ouvrir commandes", "Open orders")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {previewJob && (
        <div
          className="mt-2 md:fixed md:inset-0 md:z-[70] md:flex md:items-center md:justify-center md:bg-black/70 md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={tr("Fermer l'apercu ticket", "Close ticket preview")}
            onClick={() => setPreviewJob(null)}
            className="hidden md:absolute md:inset-0 md:block"
          />
          <div
            className="w-full rounded-xl border border-white/20 bg-charcoal p-4 shadow-2xl md:relative md:max-w-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-saffron">
                {tr("Aperçu ticket", "Ticket preview")} #{previewJob?.orderId}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-stone-100"
              >
                {tr("Fermer", "Close")}
              </button>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-5 text-stone-100">
              {buildTicketPreview(previewJob)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
