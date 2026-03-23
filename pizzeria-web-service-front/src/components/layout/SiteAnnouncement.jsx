import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import { getLocalizedSiteText } from "../../site/siteSettings";
import { isAbsoluteHttpUrl, sanitizeInternalOrAbsoluteHttpUrl } from "../../utils/url";

const VARIANT_STYLES = {
  info: {
    shell: "border-sky-300/18 bg-[linear-gradient(90deg,rgba(125,211,252,0.18),rgba(255,255,255,0.06),rgba(17,24,39,0.08))] text-sky-50",
    badge: "border-sky-200/30 bg-sky-300/14 text-sky-50",
    dot: "bg-sky-300",
    action:
      "border-sky-200/25 bg-white/6 text-sky-50 hover:border-sky-200/40 hover:bg-white/12",
  },
  alert: {
    shell: "border-red-300/20 bg-[linear-gradient(90deg,rgba(248,113,113,0.18),rgba(255,255,255,0.05),rgba(17,24,39,0.08))] text-red-50",
    badge: "border-red-200/30 bg-red-300/14 text-red-50",
    dot: "bg-red-300",
    action:
      "border-red-200/25 bg-white/6 text-red-50 hover:border-red-200/40 hover:bg-white/12",
  },
  success: {
    shell: "border-emerald-300/18 bg-[linear-gradient(90deg,rgba(110,231,183,0.18),rgba(255,255,255,0.06),rgba(17,24,39,0.08))] text-emerald-50",
    badge: "border-emerald-200/30 bg-emerald-300/14 text-emerald-50",
    dot: "bg-emerald-300",
    action:
      "border-emerald-200/25 bg-white/6 text-emerald-50 hover:border-emerald-200/40 hover:bg-white/12",
  },
};

export default function SiteAnnouncement() {
  const { language, tr } = useLanguage();
  const { settings } = useSiteSettings();
  const announcementText = getLocalizedSiteText(
    settings.announcement?.text,
    language,
    ""
  ).trim();

  if (!settings.announcement?.enabled || !announcementText) {
    return null;
  }

  const linkUrl = sanitizeInternalOrAbsoluteHttpUrl(settings.announcement?.linkUrl);
  const variant = String(settings.announcement?.variant || "info").trim().toLowerCase();
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const badgeLabel =
    variant === "alert"
      ? tr("Information importante", "Important info")
      : variant === "success"
        ? tr("Offres du moment", "Current offers")
        : tr("Nouveaute", "What's new");

  const content = (
    <>
      <span className={`hidden shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] sm:inline-flex ${styles.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {badgeLabel}
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-white/95">
        {announcementText}
      </p>
    </>
  );

  return (
    <div className={`border-t border-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${styles.shell}`}>
      <div className="section-shell">
        <div className="flex min-h-[44px] flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">{content}</div>
          {linkUrl ? (
            isAbsoluteHttpUrl(linkUrl) ? (
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${styles.action}`}
              >
                {tr("En savoir plus", "Learn more")}
              </a>
            ) : (
              <Link
                to={linkUrl}
                className={`inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${styles.action}`}
              >
                {tr("En savoir plus", "Learn more")}
              </Link>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
