import { useEffect, useMemo, useState } from "react";
import { getPublicReviews } from "../../api/review.api";
import { useLanguage } from "../../context/LanguageContext";

function formatReviewDate(value, locale) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch (_err) {
    return "";
  }
}

function renderStars(rating) {
  const score = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_value, index) => (index < score ? "\u2605" : "\u2606")).join("");
}

export default function CompactReviewsPanel({
  locationId = null,
  limit = 5,
  className = "",
  compact = false,
  grid = false,
}) {
  const { tr, locale } = useLanguage();
  const [payload, setPayload] = useState({
    summary: { averageRating: 0, totalReviews: 0 },
    reviews: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const parsedLimit = Number(limit);
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5;
    const parsedLocationId = Number(locationId);
    const safeLocationId =
      Number.isInteger(parsedLocationId) && parsedLocationId > 0 ? parsedLocationId : null;

    setLoading(true);

    getPublicReviews({
      limit: safeLimit,
      ...(safeLocationId ? { locationId: safeLocationId } : {}),
    })
      .then((data) => {
        if (cancelled) return;
        setPayload({
          summary: data?.summary || { averageRating: 0, totalReviews: 0 },
          reviews: Array.isArray(data?.reviews) ? data.reviews : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPayload({
          summary: { averageRating: 0, totalReviews: 0 },
          reviews: [],
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [limit, locationId]);

  const averageLabel = useMemo(() => {
    const average = Number(payload.summary?.averageRating || 0);
    if (!average) return "5.0";
    return average.toFixed(1);
  }, [payload.summary?.averageRating]);

  const panelPaddingClass = compact ? "p-5" : "p-6";
  const badgePaddingClass = compact ? "px-2.5 py-1.5" : "px-3 py-2";
  const badgeTextClass = compact ? "text-base" : "text-lg";
  const bodySpacingClass = compact ? "mt-3 space-y-2.5" : "mt-4 space-y-3";
  const cardPaddingClass = compact ? "p-3.5" : "p-4";
  const reviewTextClass = compact ? "text-xs leading-5" : "text-sm leading-6";
  const metaTextClass = compact ? "text-[10px]" : "text-[11px]";
  const emptyTextClass = compact ? "mt-3 text-xs" : "mt-4 text-sm";
  const skeletonBodyClass = compact ? "mt-2.5 h-10" : "mt-3 h-12";
  const listClass = grid
    ? compact
      ? "mt-3 grid gap-2.5 sm:grid-cols-2"
      : "mt-4 grid gap-3 sm:grid-cols-2"
    : bodySpacingClass;

  return (
    <section className={`glass-panel ${panelPaddingClass} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-saffron">
            {tr("Avis clients", "Customer reviews")}
          </p>
        </div>
        <div
          className={`rounded-2xl border border-saffron/25 bg-saffron/10 text-right ${badgePaddingClass}`}
        >
          <p className={`font-bold text-white ${badgeTextClass}`}>{averageLabel}/5</p>
        </div>
      </div>

      {loading ? (
        <div className={listClass}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`compact-review-skeleton-${index}`}
              className={`animate-pulse rounded-xl border border-white/10 bg-white/5 ${cardPaddingClass}`}
            >
              <div className="h-4 w-20 rounded bg-white/10" />
              <div className={`${skeletonBodyClass} rounded bg-white/10`} />
              <div className="mt-3 h-3 w-24 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : Array.isArray(payload.reviews) && payload.reviews.length > 0 ? (
        <div className={listClass}>
          {payload.reviews.map((review) => (
            <article
              key={review.id}
              className={`rounded-xl border border-white/10 bg-white/5 ${cardPaddingClass}`}
            >
              <p className="text-xs tracking-[0.16em] text-saffron">
                {renderStars(review.rating)}
              </p>
              <p className={`mt-3 text-stone-200 ${reviewTextClass}`}>{review.comment}</p>
              <div className={`mt-3 border-t border-white/10 pt-3 text-stone-400 ${metaTextClass}`}>
                <p className="font-semibold uppercase tracking-[0.16em] text-white">
                  {review.customerLabel}
                </p>
                <p className="mt-1">{formatReviewDate(review.createdAt, locale)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={`text-stone-300 ${emptyTextClass}`}>
          {tr(
            "Aucun avis public n'est encore disponible pour cette location.",
            "No public review is available for this location yet."
          )}
        </p>
      )}
    </section>
  );
}
