import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { useLanguage } from "@shared/context/LanguageContext";
import { useSiteSettings } from "@shared/context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "@shared/site/siteSettings";
import { getAdminSectionMeta, getAdminWebLinks } from "../navigation/adminLinks";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminShell({ children }) {
  const { logout } = useContext(AuthContext);
  const { tr, language, setLanguage } = useLanguage();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const navLinks = useMemo(() => getAdminWebLinks(tr), [tr]);
  const quickLinks = useMemo(() => navLinks.filter((item) => item.to !== "/"), [navLinks]);
  const currentSection = useMemo(
    () => getAdminSectionMeta(location.pathname, tr),
    [location.pathname, tr]
  );
  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "http://localhost:8000";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
  };

  const isLinkActive = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname === to || location.pathname === `/admin${to}`;
  };

  const renderNavLink = (item, mobile = false, compact = false) => (
    <NavLink
      key={`${mobile ? "mobile" : "desktop"}-${compact ? "compact" : "full"}-${item.to}`}
      to={item.to}
      onClick={() => {
        if (mobile) setMobileMenuOpen(false);
      }}
      className={() =>
        compact
          ? `rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
              isLinkActive(item.to)
                ? "border-saffron bg-saffron text-charcoal"
                : "border-white/10 bg-white/5 text-stone-200 hover:bg-white/10 hover:text-white"
            }`
          : `block rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
              isLinkActive(item.to)
                ? "bg-saffron text-charcoal"
                : "text-stone-200 hover:bg-white/10 hover:text-white"
            }`
      }
    >
      {item.label}
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-transparent text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-charcoal/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white lg:hidden"
              aria-label={mobileMenuOpen ? tr("Fermer le menu", "Close menu") : tr("Ouvrir le menu", "Open menu")}
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.28em] text-saffron">
                {tr("Admin web", "Admin web")}
              </p>
              <p className="truncate text-sm font-semibold text-white">{siteName}</p>
              <p className="truncate text-xs text-stone-400">{currentSection.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={publicSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-stone-200 transition hover:bg-white/10 sm:inline-flex"
            >
              {tr("Voir le site", "View site")}
            </a>
            <button
              type="button"
              onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
              className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/10"
            >
              {language === "fr" ? "FR" : "EN"}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-saffron px-3 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
            >
              {tr("Deconnexion", "Logout")}
            </button>
          </div>
        </div>

        <div className="admin-mobile-quicknav lg:hidden">
          <div className="admin-mobile-quicknav__scroller">
            {quickLinks.map((item) => renderNavLink(item, true, true))}
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-white/10 bg-charcoal/95 px-4 py-4 lg:hidden">
            <nav className="grid gap-2">{navLinks.map((item) => renderNavLink(item, true))}</nav>
          </div>
        ) : null}
      </header>

      <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="sticky top-[84px] hidden rounded-[1.75rem] border border-white/10 bg-black/20 p-3 lg:block">
          <nav className="grid gap-2">{navLinks.map((item) => renderNavLink(item))}</nav>
        </aside>

        <main className="min-w-0">
          <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 sm:p-4">
            <div className="mb-4 rounded-[1.25rem] border border-white/10 bg-black/15 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-saffron">
                {currentSection.label}
              </p>
              <p className="mt-1 text-sm text-stone-300">{currentSection.description}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
