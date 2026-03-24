import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicWeeklySettings } from "../../api/timeslot.api";
import { useLanguage } from "../../context/LanguageContext";
import { getLocationDisplayName } from "../../utils/location";

const paymentLogos = [
  {
    src: "/payments/cb.webp",
    fallbackSrc: "/payments/cb.webp",
    alt: "CB",
    width: 112,
    height: 63,
    className: "h-6 w-auto object-contain sm:h-7",
  },
  {
    src: "/payments/visa.webp",
    fallbackSrc: "/payments/visa.webp",
    alt: "VISA",
    width: 67,
    height: 63,
    className: "h-6 w-auto object-contain sm:h-7",
  },
  {
    src: "/payments/mastercard.webp",
    fallbackSrc: "/payments/mastercard.webp",
    alt: "MASTERCARD",
    width: 90,
    height: 63,
    className: "h-6 w-auto object-contain sm:h-7",
  },
  {
    src: "/payments/especes.webp",
    fallbackSrc: "/payments/especes.webp",
    alt: "Especes",
    width: 105,
    height: 105,
    className: "h-8 w-auto object-contain sm:h-9",
  },
];

const DAY_LABELS = {
  MONDAY: { fr: "Lundi", en: "Monday" },
  TUESDAY: { fr: "Mardi", en: "Tuesday" },
  WEDNESDAY: { fr: "Mercredi", en: "Wednesday" },
  THURSDAY: { fr: "Jeudi", en: "Thursday" },
  FRIDAY: { fr: "Vendredi", en: "Friday" },
  SATURDAY: { fr: "Samedi", en: "Saturday" },
  SUNDAY: { fr: "Dimanche", en: "Sunday" },
};

function formatLocationAddress(location, tr) {
  if (!location) return tr("Adresse non renseignee", "Address not available");
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function formatHourValue(timeValue) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(timeValue || "").trim());
  if (!match) return "--";
  const hours = match[1];
  const minutes = match[2];
  return minutes === "00" ? `${hours}H` : `${hours}H${minutes}`;
}

function formatHourRange(startTime, endTime) {
  return `${formatHourValue(startTime)}-${formatHourValue(endTime)}`;
}

function buildTruckTourSchedule(weeklySettings, tr) {
  const rows = (Array.isArray(weeklySettings) ? weeklySettings : []).flatMap((entry, dayIndex) => {
    const services =
      Array.isArray(entry?.services) && entry.services.length > 0
        ? entry.services
        : entry?.isOpen && entry?.location
          ? [
              {
                startTime: entry.startTime,
                endTime: entry.endTime,
                locationId: entry.locationId,
                location: entry.location,
              },
            ]
          : [];

    return services
      .filter((service) => service?.location && entry?.dayOfWeek)
      .map((service, serviceIndex) => {
        const locationName = getLocationDisplayName(service.location, tr("Emplacement", "Location"));
        const address = formatLocationAddress(service.location, tr);
        const locationKey =
          service.locationId || `${locationName.toLowerCase()}-${address.toLowerCase()}`;

        return {
          groupKey: `${entry.dayOfWeek}-${locationKey}`,
          sortKey: `${dayIndex}-${serviceIndex}`,
          locationName,
          address,
          dayLabel: tr(
            DAY_LABELS[entry.dayOfWeek]?.fr || entry.dayOfWeek,
            DAY_LABELS[entry.dayOfWeek]?.en || entry.dayOfWeek
          ),
          hours: formatHourRange(service.startTime, service.endTime),
        };
      });
  });

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.groupKey)) {
      grouped.set(row.groupKey, {
        key: row.groupKey,
        sortKey: row.sortKey,
        locationName: row.locationName,
        address: row.address,
        dayLabel: row.dayLabel,
        hours: [],
      });
    }

    const current = grouped.get(row.groupKey);
    if (!current.hours.includes(row.hours)) {
      current.hours.push(row.hours);
    }
  }

  return [...grouped.values()]
    .sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)))
    .map((entry) => ({
      key: entry.key,
      locationName: entry.locationName,
      address: entry.address,
      dayLabel: entry.dayLabel,
      hours: entry.hours,
    }));
}

export default function CompactServiceInfoPanel({ className = "", truckTourSchedule = null }) {
  const { tr } = useLanguage();
  const [schedule, setSchedule] = useState(Array.isArray(truckTourSchedule) ? truckTourSchedule : []);

  useEffect(() => {
    if (Array.isArray(truckTourSchedule)) {
      setSchedule(truckTourSchedule);
      return undefined;
    }

    let cancelled = false;

    getPublicWeeklySettings()
      .then((data) => {
        if (cancelled) return;
        setSchedule(buildTruckTourSchedule(data, tr));
      })
      .catch(() => {
        if (cancelled) return;
        setSchedule([]);
      });

    return () => {
      cancelled = true;
    };
  }, [truckTourSchedule, tr]);

  const normalizedSchedule = useMemo(() => (Array.isArray(schedule) ? schedule : []), [schedule]);

  return (
    <section className={`glass-panel p-5 ${className}`.trim()}>
      <div className="space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-saffron">
            {tr("Emplacements & horaires d'ouverture", "Locations & opening hours")}
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-wide text-white">
            {tr("Ou nous trouver", "Where to find us")}
          </h2>
          <p className="mt-2 text-xs leading-5 text-stone-400">
            {tr(
              "Les points de passage, jours et horaires actuellement ouverts.",
              "Current stops, opening days and available hours."
            )}
          </p>
        </div>

        <div className="space-y-2.5">
          {normalizedSchedule.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3.5 text-xs text-stone-300">
              {tr("Aucun horaire disponible pour le moment.", "No opening hours available for now.")}
            </div>
          ) : (
            normalizedSchedule.map((location) => (
              <div
                key={location.key}
                className="rounded-2xl border border-white/10 bg-black/20 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white">{location.locationName}</p>
                    <p className="mt-1 text-[11px] leading-5 text-stone-300">{location.address}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-saffron/30 bg-saffron/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-saffron">
                    {location.dayLabel}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(Array.isArray(location.hours) ? location.hours : []).map((hour) => (
                    <span
                      key={hour}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-stone-200"
                    >
                      {hour}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <Link
          to="/planing"
          className="inline-flex rounded-full border border-saffron/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
        >
          {tr("Voir les horaires", "See opening hours")}
        </Link>

        <div className="border-t border-white/10 pt-5">
          <p className="text-xs uppercase tracking-[0.22em] text-saffron">
            {tr("Nos services", "Our services")}
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-wide text-white">
            {tr("A emporter uniquement", "Takeaway only")}
          </h2>

          <div className="mt-4 grid gap-2.5">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
              <p className="text-sm font-bold text-white">{tr("Commande rapide", "Fast ordering")}</p>
              <p className="mt-2 text-xs leading-5 text-stone-300">
                {tr(
                  "Commandez, choisissez votre creneau, puis recuperez votre pizza au camion sans attente inutile.",
                  "Order, pick your slot, then collect your pizza at the truck without unnecessary waiting."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
              <p className="text-sm font-bold text-white">{tr("Qualite constante", "Consistent quality")}</p>
              <p className="mt-2 text-xs leading-5 text-stone-300">
                {tr(
                  "Une pate preparee en amont, des produits bien calibres et une cuisson minute pour garder un resultat plus stable.",
                  "Prepared dough, well-calibrated ingredients and minute baking for a more reliable result."
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className="text-xs uppercase tracking-[0.22em] text-saffron">
            {tr("Moyens de paiement acceptes", "Accepted payment methods")}
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-wide text-white">
            {tr("Paiement sur place", "On-site payment")}
          </h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {paymentLogos.map((logo) => (
                <div key={logo.alt} className="flex items-center justify-center">
                  <picture>
                    <source srcSet={logo.src} type="image/webp" />
                    <img
                      src={logo.fallbackSrc}
                      alt={logo.alt}
                      width={logo.width}
                      height={logo.height}
                      loading="lazy"
                      decoding="async"
                      className={logo.className}
                    />
                  </picture>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
