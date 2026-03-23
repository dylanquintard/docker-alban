import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublishedBlogArticleBySlug } from "../api/blog.api";
import PageFaqSection from "../components/common/PageFaqSection";
import SeoHead from "../components/seo/SeoHead";
import { SITE_URL } from "../config/env";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";
import NotFound from "./NotFound";

function formatArticleDate(value) {
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

function splitContentBlocks(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function BlogArticle({ forcedSlug = "" }) {
  const params = useParams();
  const resolvedSlug = String(forcedSlug || params.slug || "").trim().toLowerCase();
  const { settings } = useSiteSettings();
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim().replace(/\/+$/, "") || SITE_URL;
  const rawLogoUrl = String(settings.seo?.defaultOgImageUrl || "").trim();
  const logoUrl = rawLogoUrl
    ? rawLogoUrl.startsWith("http")
      ? rawLogoUrl
      : `${canonicalSiteUrl}${rawLogoUrl.startsWith("/") ? rawLogoUrl : `/${rawLogoUrl}`}`
    : `${canonicalSiteUrl}/favicon.ico`;

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resolvedSlug) {
      setArticle(null);
      setLoading(false);
      setNotFound(true);
      return undefined;
    }

    let cancelled = false;

    async function loadArticle() {
      try {
        setLoading(true);
        const data = await getPublishedBlogArticleBySlug(resolvedSlug);
        if (!cancelled) {
          setArticle(data || null);
          setNotFound(false);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          const status = Number(err?.response?.status || 0);
          setArticle(null);
          setNotFound(status === 404);
          setError(
            status === 404
              ? ""
              : err?.response?.data?.error || "Impossible de charger cet article."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [resolvedSlug]);

  const pathname = article ? `/${article.slug}` : resolvedSlug ? `/${resolvedSlug}` : "/blog";
  const articleImage = article?.featuredImage?.imageUrl || "/pizza-background-1920.webp";
  const articleSeoTitle = article?.title || "Article";
  const articleSeoDescription = article?.description || "";

  const articleJsonLd = useMemo(() => {
    if (!article) return null;

    const articleUrl = `${canonicalSiteUrl}${pathname}`;
    const publishedAt = article.publishedAt || article.createdAt;
    const updatedAt = article.updatedAt || publishedAt;

    return {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: articleSeoTitle,
      description: articleSeoDescription,
      url: articleUrl,
      image: articleImage.startsWith("http") ? articleImage : `${SITE_URL}${articleImage}`,
      datePublished: publishedAt,
      dateModified: updatedAt,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": articleUrl,
      },
      author: {
        "@type": "Organization",
        name: siteName,
      },
      publisher: {
        "@type": "Organization",
        name: siteName,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
    };
  }, [article, articleImage, articleSeoDescription, articleSeoTitle, canonicalSiteUrl, logoUrl, pathname, siteName]);

  if (loading) {
    return (
      <div className="section-shell space-y-6 pb-20 pt-10">
        <div className="glass-panel animate-pulse space-y-4 p-8">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-12 w-3/4 rounded bg-white/10" />
          <div className="h-24 rounded bg-white/10" />
        </div>
        <div className="glass-panel animate-pulse space-y-4 p-8">
          <div className="h-8 w-1/2 rounded bg-white/10" />
          <div className="h-32 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return <NotFound />;
  }

  if (!article) {
    return (
      <div className="section-shell space-y-6 pb-20 pt-10">
        <SeoHead
          title={`Article indisponible | ${siteName}`}
          description="Cet article est temporairement indisponible."
          pathname={pathname}
          robots="noindex,nofollow"
        />
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error || "Cet article est indisponible pour le moment."}
        </div>
        <Link
          to="/blog"
          className="inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
        >
          Retour au blog
        </Link>
      </div>
    );
  }

  const publishedLabel = formatArticleDate(article.publishedAt || article.createdAt);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={`${articleSeoTitle} | ${siteName}`}
        description={articleSeoDescription}
        pathname={pathname}
        image={articleImage}
        ogType="article"
        jsonLd={articleJsonLd}
      />

      <header
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-cover bg-center p-6 sm:p-8 lg:p-10"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.72), rgba(36, 25, 12, 0.84)), url('${articleImage}')`,
        }}
      >
        <div className="max-w-4xl space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-300">
            <Link to="/blog" className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10">
              Blog
            </Link>
            {publishedLabel ? (
              <span className="rounded-full border border-saffron/40 px-3 py-1 text-saffron">
                {publishedLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-white/20 px-3 py-1">
              /{article.slug}
            </span>
          </div>

          <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl lg:text-6xl">
            {article.title}
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-stone-200 sm:text-base">
            {article.description}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {article.paragraphs.map((paragraph, index) => (
            <section
              key={paragraph.id || `${paragraph.title}-${index}`}
              id={`section-${paragraph.id || index}`}
              className={`grid gap-5 lg:items-stretch ${
                paragraph.image?.imageUrl ? "lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]" : ""
              }`}
            >
              <div
                className={`glass-panel rounded-[1.75rem] p-6 sm:p-7 ${
                  paragraph.image?.imageUrl && index % 2 === 1 ? "lg:order-2" : "lg:order-1"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-saffron/35 bg-saffron/10 text-sm font-bold text-saffron">
                    {index + 1}
                  </span>
                  <h2 className="text-2xl font-bold text-white">{paragraph.title}</h2>
                </div>

                <div className="mt-5 space-y-4">
                  {splitContentBlocks(paragraph.content).map((block, blockIndex) => (
                    <p
                      key={`${paragraph.id || index}-block-${blockIndex}`}
                      className="text-sm leading-8 text-stone-300 sm:text-[15px]"
                    >
                      {block}
                    </p>
                  ))}
                </div>
              </div>

              {paragraph.image?.imageUrl ? (
                <figure
                  className={`overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/20 ${
                    index % 2 === 1 ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <img
                    src={paragraph.image.imageUrl}
                    alt={paragraph.image.altText || paragraph.image.caption || paragraph.title}
                    className="h-64 w-full object-cover sm:h-72 lg:h-full lg:min-h-[320px]"
                  />
                  {paragraph.image.caption ? (
                    <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-stone-300">
                      {paragraph.image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-saffron">Sommaire</p>
            <div className="mt-4 space-y-2">
              {article.paragraphs.map((paragraph, index) => (
                <a
                  key={`toc-${paragraph.id || index}`}
                  href={`#section-${paragraph.id || index}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const target = document.getElementById(`section-${paragraph.id || index}`);
                    target?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="block rounded-2xl border border-white/10 px-4 py-3 text-sm text-stone-200 transition hover:border-saffron/40 hover:bg-saffron/10 hover:text-white"
                >
                  {index + 1}. {paragraph.title}
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-stone-400">Continuer</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/blog"
                className="rounded-full border border-white/20 px-4 py-2 text-center text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Retour au blog
              </Link>
              <Link
                to="/menu"
                className="rounded-full bg-saffron px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
              >
                Voir le menu
              </Link>
              <Link
                to="/planing"
                className="rounded-full border border-saffron/60 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
              >
                Horaires d'ouvertures
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <PageFaqSection
        pathname={pathname}
        title="Questions fréquentes sur cet article"
      />
    </div>
  );
}
