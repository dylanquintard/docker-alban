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

  return (
    <section className={`glass-panel p-6 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-saffron">
            {tr("Avis clients", "Customer reviews")}
          </p>
        </div>
        <div className="rounded-2xl border border-saffron/25 bg-saffron/10 px-3 py-2 text-right">
          <p className="text-lg font-bold text-white">{averageLabel}/5</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`compact-review-skeleton-${index}`}
              className="animate-pulse rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="h-4 w-20 rounded bg-white/10" />
              <div className="mt-3 h-12 rounded bg-white/10" />
              <div className="mt-3 h-3 w-24 rounded bg-white/10" />
            </div>
          ))}
        </div>
      ) : Array.isArray(payload.reviews) && payload.reviews.length > 0 ? (
        <div className="mt-4 space-y-3">
          {payload.reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <p className="text-sm tracking-[0.16em] text-saffron">
                {renderStars(review.rating)}
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-200">{review.comment}</p>
              <div className="mt-3 border-t border-white/10 pt-3 text-[11px] text-stone-400">
                <p className="font-semibold uppercase tracking-[0.16em] text-white">
                  {review.customerLabel}
                </p>
                <p className="mt-1">{formatReviewDate(review.createdAt, locale)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-300">
          {tr(
            "Aucun avis public n'est encore disponible pour cette location.",
            "No public review is available for this location yet."
          )}
        </p>
      )}
    </section>
  );
}
