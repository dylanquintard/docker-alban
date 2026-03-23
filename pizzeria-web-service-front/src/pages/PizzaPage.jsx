import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllProductsClient } from "../api/user.api";
import PageFaqSection from "../components/common/PageFaqSection";
import PizzaSpotlightGallery from "../components/gallery/PizzaSpotlightGallery";
import FeaturedPizzaSuggestions from "../components/pizza/FeaturedPizzaSuggestions";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";

function extractGalleryTimestampFromUrl(value) {
  const normalized = String(value || "");
  const match = normalized.match(/gallery-(\d{10,})-/i);
  if (!match?.[1]) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function PizzaPage() {
  const { tr, language } = useLanguage();
  const { settings } = useSiteSettings();

  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const productsData = await getAllProductsClient();
        if (!active) return;
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (_err) {
        if (!active) return;
        setProducts([]);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const availableProducts = useMemo(() => {
    return products.sort((left, right) => {
      const leftPrice = Number(left?.basePrice);
      const rightPrice = Number(right?.basePrice);
      if (Number.isFinite(leftPrice) && Number.isFinite(rightPrice) && leftPrice !== rightPrice) {
        return leftPrice - rightPrice;
      }
      return String(left?.name || "").localeCompare(String(right?.name || ""));
    });
  }, [products]);

  const featuredIds = useMemo(() => {
    return Array.from(
      new Set(
        (Array.isArray(settings.pizzaPage?.featuredProductIds)
          ? settings.pizzaPage.featuredProductIds
          : []
        )
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    );
  }, [settings.pizzaPage?.featuredProductIds]);

  const featuredProducts = useMemo(() => {
    const byId = new Map(availableProducts.map((product) => [Number(product.id), product]));
    return featuredIds.map((id) => byId.get(id)).filter(Boolean);
  }, [availableProducts, featuredIds]);

  const pizzaGalleryImages = useMemo(() => {
    return [...products]
      .filter((product) => String(product?.imageUrl || "").trim())
      .map((product) => ({
        id: `pizza-${product.id}`,
        productId: Number(product.id) || 0,
        imageUrl: product.imageUrl,
        thumbnailUrl: product.thumbnailUrl || product.imageUrl,
        title: product.name || "",
        description: product.description || "",
        altText: product.imageAlt || product.name || "",
        imageTimestamp: extractGalleryTimestampFromUrl(product.imageUrl),
      }))
      .sort((left, right) => {
        if (left.imageTimestamp !== right.imageTimestamp) {
          return right.imageTimestamp - left.imageTimestamp;
        }
        return right.productId - left.productId;
      });
  }, [products]);

  const pizzaSectionTitle = getLocalizedSiteText(
    settings.pizzaPage?.sectionTitle,
    language,
    DEFAULT_SITE_SETTINGS.pizzaPage.sectionTitle.fr
  );
  const pizzaSectionDescription = getLocalizedSiteText(
    settings.pizzaPage?.sectionDescription,
    language,
    DEFAULT_SITE_SETTINGS.pizzaPage.sectionDescription.fr
  );

  return (
    <div className="section-shell space-y-10 pb-20 pt-10">
      <SeoHead
        title={tr("Nos pizzas | Carte", "Our pizzas | Menu")}
        description={tr(
          "Decouvrez une selection de nos pizzas signatures, avec prix et ingredients.",
          "Discover a selection of our signature pizzas, with prices and ingredients."
        )}
        pathname="/pizza"
      />

      <section className="space-y-5">
        <h1 className="font-display text-4xl uppercase tracking-[0.08em] text-white sm:text-5xl">
          {tr("Nos pizzas", "Our pizzas")}
        </h1>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr("Notre travail, nos pizzas a emporter :", "Our work, our pizzas to take away:")}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/order"
            className="rounded-full bg-saffron px-6 py-3 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Commander", "Order now")}
          </Link>
          <Link
            to="/menu"
            className="theme-light-keep-white rounded-full border border-white/30 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
          >
            {tr("Voir le menu", "See menu")}
          </Link>
        </div>

        <section
          id="galerie-pizzas"
          className="my-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-5 sm:px-5"
        >
          <div className="flex items-stretch gap-4 sm:gap-5">
            <div className="flex w-1/2 pr-1 sm:pr-2">
              <div className="h-full w-full rounded-2xl border border-white/12 bg-gradient-to-br from-charcoal/85 via-black/50 to-charcoal/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-saffron/90 sm:text-[11px]">
                  {tr("Recettes artisanales", "Handcrafted recipes")}
                </p>
                <h2 className="mt-2 font-display text-xl uppercase tracking-[0.08em] text-white sm:text-[1.7rem]">
                  {pizzaSectionTitle}
                </h2>
                <div className="mt-3 h-px bg-gradient-to-r from-saffron/70 via-white/30 to-transparent" />
                <p className="mt-3 min-h-[8.5rem] whitespace-pre-line text-[0.98rem] leading-relaxed text-stone-200 sm:min-h-[9.25rem] sm:text-[1.06rem]">
                  {pizzaSectionDescription}
                </p>
              </div>
            </div>
            <div className="flex w-1/2 max-w-[50%]">
              <PizzaSpotlightGallery images={pizzaGalleryImages} />
            </div>
          </div>
        </section>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl">
          {tr("Nos selections du moment", "Our featured selections")}
        </h2>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr(
            "Une selection mise en avant par l'equipe. Commandez en ligne en quelques clics.",
            "A featured selection curated by the team. Order online in just a few clicks."
          )}
        </p>
        <FeaturedPizzaSuggestions products={featuredProducts} tr={tr} />
      </section>

      <PageFaqSection
        pathname="/pizza"
        title={tr(
          "Questions frequentes sur nos pizzas",
          "Frequently asked questions about our pizzas"
        )}
      />
    </div>
  );
}
