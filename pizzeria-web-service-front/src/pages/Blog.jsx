import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublishedBlogArticles } from "../api/blog.api";
import PageFaqSection from "../components/common/PageFaqSection";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";

function formatPublishDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch (_err) {
    return "";
  }
}

export default function Blog() {
  const { language, tr } = useLanguage();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const title = tr(`Blog | ${siteName}`, `Blog | ${siteName}`);
  const description = tr(
    "Analyses et articles sur la pâte, la cuisson, les ingrédients et les choix techniques qui structurent une pizza mieux executee.",
    "Articles about dough, baking, ingredients and the technical choices behind a better pizza."
  );
  const introTitle = getLocalizedSiteText(
    settings.blog?.introTitle,
    language,
    "Farines, tomates, mozzarella & surtout la pizza !"
  );
  const introText = getLocalizedSiteText(
    settings.blog?.introText,
    language,
    "Ici on parle d'italie, de saveurs, de savoir faire et de qualité !"
  );

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBlogArticles() {
      try {
        setLoading(true);
        const data = await getPublishedBlogArticles();
        if (!cancelled) {
          setArticles(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setArticles([]);
          setError(
            err?.response?.data?.error || "Impossible de charger les articles du blog."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBlogArticles();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead title={title} description={description} pathname="/blog" />

      <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.2),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(120,53,15,0.35),_transparent_32%),linear-gradient(135deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.02))] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-start">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-saffron">Blog</p>
            <h1 className="max-w-4xl font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
              {introTitle}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-stone-300 sm:text-base">
              {introText}
            </p>
          </div>

          <div className="lg:justify-self-end">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Articles</p>
              <p className="mt-1 text-2xl font-bold text-white">{articles.length}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-start gap-2 lg:justify-end">
          <Link
            to="/menu"
            className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Voir le menu", "See menu")}
          </Link>
          <Link
            to="/a-propos"
            className="rounded-full border border-white/30 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            {tr("Notre approche", "Our approach")}
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`blog-skeleton-${index}`}
              className="glass-panel animate-pulse space-y-4 p-5"
            >
              <div className="h-3 w-28 rounded bg-white/10" />
              <div className="h-7 w-4/5 rounded bg-white/10" />
              <div className="h-20 rounded bg-white/10" />
              <div className="h-9 w-32 rounded-full bg-white/10" />
            </div>
          ))}
        </section>
      ) : articles.length === 0 ? (
        <section className="glass-panel space-y-3 p-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("Blog vide", "Empty blog")}</p>
          <h2 className="text-2xl font-bold text-white">{tr("Aucun article publie pour le moment", "No published article yet")}</h2>
          <p className="mx-auto max-w-2xl text-sm text-stone-300">
            {tr(
              "Les prochains articles apparaitront ici automatiquement des qu ils seront publies depuis l espace administrateur.",
              "New articles will appear here automatically as soon as they are published from the admin area."
            )}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.id}
              className="group flex h-full flex-col rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 transition hover:border-saffron/30 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))]"
            >
              {article.featuredImage?.imageUrl ? (
                <div className="mb-4 overflow-hidden rounded-[1.2rem] border border-white/10">
                  <img
                    src={article.featuredImage.imageUrl}
                    alt={article.featuredImage.altText || article.featuredImage.caption || article.title}
                    className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="mb-4 h-px w-16 bg-gradient-to-r from-saffron via-saffron/50 to-transparent" />
              )}

              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-stone-400">
                <span className="rounded-full border border-white/10 px-3 py-1">
                  {formatPublishDate(article.publishedAt || article.updatedAt) || tr("Article", "Article")}
                </span>
              </div>

              <h2 className="mt-4 text-xl font-bold leading-tight text-white transition group-hover:text-saffron">
                {article.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-stone-300">
                {article.description}
              </p>

              <div className="mt-6">
                <Link
                  to={`/${article.slug}`}
                  className="inline-flex rounded-full border border-saffron/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
                >
                  {tr("Lire l'article", "Read article")}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <PageFaqSection
        pathname="/blog"
        title={tr("Questions fréquentes sur le blog", "Frequently asked questions about the blog")}
      />
    </div>
  );
}
