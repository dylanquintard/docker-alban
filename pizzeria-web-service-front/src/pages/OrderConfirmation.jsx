import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

function formatPickupTime(value, locale, tr) {
  if (!value) return tr("Horaire non disponible", "Pickup time unavailable");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return tr("Horaire non disponible", "Pickup time unavailable");
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderConfirmation() {
  const { tr, locale } = useLanguage();
  const location = useLocation();
  const state = location.state || {};

  const pickupTime = formatPickupTime(state.pickupTime, locale, tr);
  const pickupLocationName = state.pickupLocationName || tr("Emplacement", "Location");
  const pickupAddress = state.pickupAddress || tr("Adresse de retrait non disponible", "Pickup address unavailable");
  const orderId = state.orderId ?? null;
  const orderNote = typeof state.orderNote === "string" ? state.orderNote.trim() : "";

  return (
    <div className="section-shell py-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-500/20 text-4xl font-black text-emerald-200">
          V
        </div>

        <p className="mt-5 text-sm uppercase tracking-[0.22em] text-emerald-300">{tr("Confirmation", "Confirmation")}</p>
        <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-white">{tr("Commande validée", "Order confirmed")}</h1>

        <div className="mt-8 space-y-3 text-left">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{tr("Heure de retrait", "Pickup time")}</p>
            <p className="mt-1 text-base font-semibold text-white">{pickupTime}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{tr("Adresse de retrait", "Pickup address")}</p>
            <p className="mt-1 text-base font-semibold text-white">
              {pickupLocationName}
              {pickupAddress ? ` - ${pickupAddress}` : ""}
            </p>
          </div>
          {orderNote && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{tr("Note", "Note")}</p>
              <p className="mt-1 text-base font-semibold text-white">{orderNote}</p>
            </div>
          )}
        </div>

        {orderId && (
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-stone-400">
            {tr("Commande", "Order")} #{orderId}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/userorders"
            className="rounded-full bg-saffron px-6 py-3 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Voir mes commandes", "View my orders")}
          </Link>
          <Link
            to="/order"
            className="rounded-full border border-white/25 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-stone-100 transition hover:bg-white/10"
          >
            {tr("Retour commande", "Order again")}
          </Link>
        </div>
      </div>
    </div>
  );
}
