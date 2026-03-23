import { Link } from "react-router-dom";
import SeoHead from "../components/seo/SeoHead";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function NotFound() {
  return (
    <div className="section-shell space-y-8 pb-20 pt-12">
      <SeoHead
        title={`Page non trouvee | ${DEFAULT_SITE_SETTINGS.siteName}`}
        description="La page demandée est introuvable."
        pathname="/404"
        robots="noindex,nofollow"
      />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">Erreur 404</p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          Page non trouvee
        </h1>
        <p className="max-w-2xl text-sm text-stone-300 sm:text-base">
          La page demandée n'existe pas, a été déplacée, ou son lien est incorrect.
        </p>
      </header>

      <section className="glass-panel space-y-6 p-6 sm:p-8">
        <div className="rounded-2xl border border-saffron/30 bg-saffron/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron">Code erreur 404</p>
          <p className="mt-2 text-sm text-stone-200">
            Tu peux revenir a l'accueil ou continuer vers une page utile du site.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            Retour a l'accueil
          </Link>
          <Link
            to="/menu"
            className="rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
          >
            Voir le menu
          </Link>
          <Link
            to="/planing"
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Horaires d'ouverture
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            to="/menu"
            className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-stone-200 transition hover:border-saffron/60 hover:bg-saffron/10"
          >
            Commander une pizza
          </Link>
          <Link
            to="/planing"
            className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-stone-200 transition hover:border-saffron/60 hover:bg-saffron/10"
          >
            Consulter les emplacements
          </Link>
          <Link
            to="/contact"
            className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-stone-200 transition hover:border-saffron/60 hover:bg-saffron/10"
          >
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
