import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";

const HIDDEN_PREFIXES = ["/admin"];
const HIDDEN_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/order",
  "/order/confirmation",
  "/profile",
  "/userorders",
]);

export default function MobileStickyCta() {
  const location = useLocation();
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const pathname = String(location.pathname || "");
  const phone = String(settings.contact?.phone || "").trim();

  if (
    HIDDEN_PATHS.has(pathname) ||
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-full border border-saffron/35 bg-charcoal/95 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        <Link
          to="/order"
          className="flex-1 rounded-full bg-saffron px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-charcoal transition hover:bg-yellow-300"
        >
          {tr("Commander", "Order now")}
        </Link>
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="rounded-full border border-white/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
          >
            {tr("Appeler", "Call")}
          </a>
        ) : (
          <Link
            to="/menu"
            className="rounded-full border border-white/15 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
          >
            {tr("Menu", "Menu")}
          </Link>
        )}
      </div>
    </div>
  );
}
