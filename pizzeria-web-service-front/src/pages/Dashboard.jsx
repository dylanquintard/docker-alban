import { useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { getAdminNavLinks } from "../navigation/adminLinks";
import SeoHead from "../components/seo/SeoHead";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function Dashboard({ children }) {
  const { user } = useContext(AuthContext);
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const safeAdminLinks = getAdminNavLinks(tr).filter(
    (item) => item && typeof item.to === "string" && item.to
  );

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="section-shell">
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {tr("Accès refusé: administrateur uniquement.", "Access denied: admin only.")}
        </p>
      </div>
    );
  }

  return (
    <div className="section-shell pb-12">
      <SeoHead
        title={`Admin | ${siteName}`}
        description={`Interface d'administration ${siteName}.`}
        pathname={location.pathname || "/admin"}
        robots="noindex,nofollow"
      />

      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.25em] text-saffron">{tr("Administration", "Administration")}</p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white">{tr("Tableau de bord", "Dashboard")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
          <nav className="space-y-2">
            {safeAdminLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-saffron text-charcoal"
                      : "text-stone-200 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="admin-card">{children}</section>
      </div>
    </div>
  );
}
