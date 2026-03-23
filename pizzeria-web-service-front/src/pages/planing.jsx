import { useEffect, useMemo, useState } from "react";
import SeoHead from "../components/seo/SeoHead";
import { getPublicWeeklySettings } from "../api/timeslot.api";
import { getLocations } from "../api/location.api";
import PageFaqSection from "../components/common/PageFaqSection";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { getCityPath } from "../seo/localLandingContent";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";
import { getLocationDisplayName } from "../utils/location";
import { Link } from "react-router-dom";

const DAY_LABELS = {
  MONDAY: { fr: "Lundi", en: "Monday" },
  TUESDAY: { fr: "Mardi", en: "Tuesday" },
  WEDNESDAY: { fr: "Mercredi", en: "Wednesday" },
  THURSDAY: { fr: "Jeudi", en: "Thursday" },
  FRIDAY: { fr: "Vendredi", en: "Friday" },
  SATURDAY: { fr: "Samedi", en: "Saturday" },
  SUNDAY: { fr: "Dimanche", en: "Sunday" },
};

const ORDERED_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatHourValue(timeValue) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(String(timeValue || "").trim());
  if (!match) return "--";
  const hours = match[1];
  const minutes = match[2];
  return minutes === "00" ? `${hours}H` : `${hours}H${minutes}`;
}

function formatAddress(location) {
  if (!location) return "";
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function getRangeSortValue(range) {
  const [startLabel = ""] = String(range || "").split("-");
  const normalized = startLabel.replace("H", ":");
  const [hours = "99", minutes = "99"] = normalized.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export default function TourneeCamion() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const [weeklySettings, setWeeklySettings] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([getPublicWeeklySettings(), getLocations({ active: true })]).then((results) => {
      if (cancelled) return;

      const [weeklyResult, locationsResult] = results;

      setWeeklySettings(
        weeklyResult.status === "fulfilled" && Array.isArray(weeklyResult.value)
          ? weeklyResult.value
          : []
      );

      setLocations(
        locationsResult.status === "fulfilled" && Array.isArray(locationsResult.value)
          ? locationsResult.value
          : []
      );
    }).catch(() => {
      if (cancelled) return;
      setWeeklySettings([]);
      setLocations([]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const locationsById = useMemo(() => {
    const map = new Map();
    for (const location of Array.isArray(locations) ? locations : []) {
      const locationId = Number(location?.id);
      if (Number.isFinite(locationId) && locationId > 0) {
        map.set(locationId, location);
      }
    }
    return map;
  }, [locations]);

  const scheduleByLocation = useMemo(() => {
    const map = new Map();
    const source = Array.isArray(weeklySettings) ? weeklySettings : [];

    for (const entry of source) {
      const dayOfWeek = String(entry?.dayOfWeek || "").toUpperCase();
      if (!ORDERED_DAYS.includes(dayOfWeek)) continue;

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

      for (const service of services) {
        const locationId = Number(service?.locationId || entry?.locationId);
        const location =
          service?.location ||
          (Number.isFinite(locationId) && locationId > 0 ? locationsById.get(locationId) : null);
        if (!location) continue;

        const locationName = getLocationDisplayName(location, tr("Emplacement", "Location"));
        const address = formatAddress(location);
        const locationKey =
          normalizeText(address) ||
          `${String(locationId || "")}-${normalizeText(locationName)}`;

        if (!map.has(locationKey)) {
          map.set(locationKey, {
            key: locationKey,
            locationName,
            addresses: new Set(),
            slotsByDay: ORDERED_DAYS.reduce((accumulator, dayKey) => {
              accumulator[dayKey] = [];
              return accumulator;
            }, {}),
          });
        }

        const bucket = map.get(locationKey);
        if (address) {
          bucket.addresses.add(address);
        }

        const startLabel = formatHourValue(service?.startTime);
        const endLabel = formatHourValue(service?.endTime);
        if (startLabel === "--" || endLabel === "--") {
          continue;
        }

        const range = `${startLabel}-${endLabel}`;
        if (!bucket.slotsByDay[dayOfWeek].includes(range)) {
          bucket.slotsByDay[dayOfWeek].push(range);
        }
      }
    }

    return [...map.values()]
      .map((entry) => ({
        ...entry,
        addresses: [...entry.addresses],
        slotsByDay: ORDERED_DAYS.reduce((accumulator, dayKey) => {
          accumulator[dayKey] = [...entry.slotsByDay[dayKey]].sort(
            (left, right) => getRangeSortValue(left).localeCompare(getRangeSortValue(right))
          );
          return accumulator;
        }, {}),
      }))
      .sort((left, right) => {
        const leftAddress = left.addresses[0] || "";
        const rightAddress = right.addresses[0] || "";
        return (
          leftAddress.localeCompare(rightAddress, "fr") ||
          left.locationName.localeCompare(right.locationName, "fr")
        );
      });
  }, [locationsById, weeklySettings, tr]);

  const visibleCities = useMemo(() => {
    const fromSchedule = scheduleByLocation
      .map((entry) => String(entry.locationName || "").trim())
      .filter(Boolean);

    const fromLocations = (Array.isArray(locations) ? locations : [])
      .map((location) => String(location?.name || location?.city || "").trim())
      .filter(Boolean);

    return [...new Set([...fromSchedule, ...fromLocations])].sort((a, b) => a.localeCompare(b, "fr"));
  }, [scheduleByLocation, locations]);

  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const resolvedTitle = tr(
    `Horaires | ${siteName}`,
    `Horaires | ${siteName}`
  );
  const description = tr(
    "Retrouvez les emplacements du camion pizza napolitaine en Moselle et autour de Thionville, avec horaires de passage hebdomadaires.",
    "Find the Neapolitan pizza truck locations in Moselle and around Thionville, with weekly service hours."
  );

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={resolvedTitle}
        description={description}
        pathname="/planing"
        jsonLd={buildBaseFoodEstablishmentJsonLd({
          pagePath: "/planing",
          pageName: resolvedTitle,
          description,
        })}
      />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">
          {tr("Horaires d'ouverture du camion", "Truck opening hours")}
        </p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          {tr(
            "Horaires d'ouverture du camion pizza napolitaine",
            "Opening hours for the Neapolitan pizza truck"
          )}
        </h1>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr(
            "Retrouvez les emplacements et horaires du camion pizza napolitaine en Moselle et autour de Thionville.",
            "Find the locations and opening hours of the Neapolitan pizza truck in Moselle and around Thionville."
          )}
        </p>
      </header>

      <section className="glass-panel p-6">
        <h2 className="font-display text-3xl uppercase tracking-wide text-white">
          {tr("Emplacements du camion pizza", "Pizza truck locations")}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scheduleByLocation.length === 0 ? (
            <div className="glass-panel p-5 text-sm text-stone-300">
              {tr("Aucun horaire disponible pour le moment.", "No opening hours available right now.")}
            </div>
          ) : (
            scheduleByLocation.map((entry) => (
              <article key={entry.key} className="glass-panel p-5">
                <p className="text-[11px] uppercase tracking-wider text-saffron">{tr("Nom", "Name")}</p>
                <p className="mt-1 text-lg font-bold text-white">{entry.locationName}</p>

                <p className="mt-3 text-[11px] uppercase tracking-wider text-saffron">{tr("Adresse", "Address")}</p>
                {entry.addresses.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {entry.addresses.map((address) => (
                      <p key={address} className="text-sm text-stone-200">
                        {address}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-stone-200">{tr("Adresse a venir", "Address coming soon")}</p>
                )}

                <p className="mt-4 text-[11px] uppercase tracking-wider text-saffron">
                  {tr("Planning hebdomadaire", "Weekly schedule")}
                </p>
                <ul className="mt-2 space-y-1">
                  {ORDERED_DAYS.map((dayKey) => {
                    const hours = Array.isArray(entry?.slotsByDay?.[dayKey])
                      ? entry.slotsByDay[dayKey]
                      : [];
                    return (
                      <li key={`${entry.key}-${dayKey}`} className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-stone-300">
                          {tr(DAY_LABELS[dayKey]?.fr || dayKey, DAY_LABELS[dayKey]?.en || dayKey)}
                        </span>
                        <span className="text-right text-stone-100">
                          {hours.length > 0 ? hours.join(" . ") : tr("Ferme", "Closed")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))
          )}
        </div>
        {visibleCities.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {visibleCities
              .map((city) => ({
                city,
                path: getCityPath(city),
              }))
              .filter((entry) => entry.path)
              .map((entry) => (
              <li key={entry.city}>
                <Link
                  to={entry.path}
                  className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs text-stone-200 transition hover:border-saffron/70 hover:text-saffron"
                >
                  {entry.city}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PageFaqSection
        pathname="/planing"
        title={tr("Questions fréquentes sur les horaires", "Frequently asked questions about opening hours")}
      />
    </div>
  );
}
