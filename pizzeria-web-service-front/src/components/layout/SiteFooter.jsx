import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLocations } from "../../api/location.api";
import { useLanguage } from "../../context/LanguageContext";
import { useSiteSettings } from "../../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../../site/siteSettings";
import { slugifyCity } from "../../utils/slugifyCity";
import { getGalleryThumbnailUrl, sanitizeAbsoluteHttpUrl } from "../../utils/url";

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.6 1.6-1.6H16V4.8c-.3 0-.9-.1-1.8-.1-2.8 0-4.7 1.7-4.7 4.8V11H7v3h2.5v7h4z" />
    </svg>
  );
}

function TikTokIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.8 3c.3 1.9 1.4 3.3 3.2 4 .7.3 1.4.4 2 .4V11c-1 0-2-.2-2.9-.6v5.6c0 3.2-2.5 5.4-5.7 5.4-3 0-5.4-2.3-5.4-5.2 0-3.2 2.7-5.6 5.9-5.1v3.2c-1.2-.4-2.5.5-2.5 1.9 0 1.1.9 2 2.1 2 1.2 0 2-.9 2-2.1V3h3.3z" />
    </svg>
  );
}

export default function SiteFooter() {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const [addressLinks, setAddressLinks] = useState([]);
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const shortText = getLocalizedSiteText(settings.footer?.shortText, language, "").trim();
  const legalText = getLocalizedSiteText(settings.footer?.legalText, language, "").trim();
  const copyrightText = getLocalizedSiteText(
    settings.footer?.copyright,
    language,
    "All rights reserved."
  ).trim();
  const headerLogoUrl = String(settings.seo?.headerLogoUrl || "").trim();
  const footerLogoUrl = getGalleryThumbnailUrl(headerLogoUrl) || headerLogoUrl;
  const phone = String(settings.contact?.phone || "").trim();
  const email = String(settings.contact?.email || "").trim();
  const socialLinks = [
    {
      href: sanitizeAbsoluteHttpUrl(settings.social?.instagramUrl),
      label: "Instagram",
      Icon: InstagramIcon,
    },
    {
      href: sanitizeAbsoluteHttpUrl(settings.social?.facebookUrl),
      label: "Facebook",
      Icon: FacebookIcon,
    },
    {
      href: sanitizeAbsoluteHttpUrl(settings.social?.tiktokUrl),
      label: "TikTok",
      Icon: TikTokIcon,
    },
  ].filter((item) => item.href);
  const mainLinks = [
    { to: "/", label: language === "en" ? "Home" : "Accueil" },
    { to: "/menu", label: language === "en" ? "Menu" : "Menu" },
    { to: "/planing", label: language === "en" ? "Opening hours" : "Horaires" },
    { to: "/contact", label: language === "en" ? "Contact" : "Contact" },
    { to: "/blog", label: "Blog" },
  ];
  const legalLinks = [
    {
      to: "/mentions-legales",
      label: language === "en" ? "Legal notice" : "Mentions legales",
    },
    {
      to: "/confidentialite",
      label: language === "en" ? "Privacy" : "Confidentialite",
    },
    {
      to: "/conditions-generales",
      label: language === "en" ? "Terms" : "Conditions",
    },
  ];

  useEffect(() => {
    let cancelled = false;

    getLocations({ active: true })
      .then((data) => {
        if (cancelled) return;

        const source = Array.isArray(data) ? data : [];
        const bySlug = new Map();

        for (const location of source) {
          const cityLabel = String(location?.city || location?.name || "").trim();
          const citySlug = slugifyCity(cityLabel);
          if (!citySlug || bySlug.has(citySlug)) continue;
          bySlug.set(citySlug, {
            slug: citySlug,
            label: cityLabel,
          });
        }

        const nextLinks = [...bySlug.values()].sort((a, b) =>
          a.label.localeCompare(b.label, "fr")
        );
        setAddressLinks(nextLinks);
      })
      .catch(() => {
        if (!cancelled) setAddressLinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="border-t border-white/10 bg-charcoal/70">
      <div className="section-shell py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-saffron">{siteName}</p>
            {headerLogoUrl ? (
              <img
                src={footerLogoUrl}
                alt={siteName}
                width={520}
                height={112}
                className="mt-3 h-14 w-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            {shortText ? <p className="mt-3 text-sm text-stone-300">{shortText}</p> : null}
            {legalText ? <p className="mt-3 text-xs text-stone-400">{legalText}</p> : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
              {language === "en" ? "Navigation" : "Navigation"}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-stone-300">
              {mainLinks.map((link) => (
                <Link key={link.to} to={link.to} className="hover:text-saffron">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
              {language === "en" ? "Legal" : "Legal"}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-stone-300">
              {legalLinks.map((link) => (
                <Link key={link.to} to={link.to} className="hover:text-saffron">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 text-sm text-stone-300">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                {language === "en" ? "Our locations :" : "Nos adresses :"}
              </p>
              <div className="mt-2 grid gap-1.5 text-sm text-stone-300">
                {addressLinks.map((entry) => (
                  <Link key={entry.slug} to={`/pizza-${entry.slug}`} className="hover:text-saffron">
                    {entry.label}
                  </Link>
                ))}
              </div>
            </div>

            {phone ? (
              <div className="pt-1">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                  {language === "en" ? "Phone" : "NUMERO"}
                </p>
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="mt-1 block hover:text-saffron">
                  {phone}
                </a>
              </div>
            ) : null}

            {email ? (
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">EMAIL</p>
                <a href={`mailto:${email}`} className="mt-1 block hover:text-saffron">
                  {email}
                </a>
              </div>
            ) : null}

            {socialLinks.length > 0 ? (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                  {language === "en" ? "Social" : "Reseaux"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {socialLinks.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-stone-100 transition hover:border-saffron/40 hover:bg-saffron/10 hover:text-saffron"
                      aria-label={label}
                      title={label}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-6 text-xs text-stone-500">
          (c) {new Date().getFullYear()} {siteName}. {copyrightText}
        </p>
      </div>
    </footer>
  );
}
