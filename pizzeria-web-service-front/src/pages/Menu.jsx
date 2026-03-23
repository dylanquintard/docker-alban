import { useEffect, useMemo, useState } from "react";
import { getCategories } from "../api/category.api";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { getAllProductsClient } from "../api/user.api";
import PageFaqSection from "../components/common/PageFaqSection";
import MenuBoard from "../components/menu/MenuBoard";
import FeaturedPizzaSuggestions from "../components/pizza/FeaturedPizzaSuggestions";
import SeoHead from "../components/seo/SeoHead";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function Menu() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchMenu = async () => {
      try {
        const [productData, categoryData] = await Promise.all([
          getAllProductsClient(),
          getCategories({ active: true, kind: "PRODUCT" }),
        ]);

        if (!cancelled) {
          setProducts(Array.isArray(productData) ? productData : []);
          setCategories(Array.isArray(categoryData) ? categoryData : []);
        }
      } catch (_err) {
        if (!cancelled) {
          setMessage(tr("Erreur lors du chargement du menu", "Error while loading menu"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMenu();
    return () => {
      cancelled = true;
    };
  }, [tr]);

  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const showMenuProductImages = settings?.order?.showMenuProductImages !== false;
  const productsSortedByPrice = useMemo(() => {
    return [...products].sort((left, right) => {
      const leftPrice = Number(left?.basePrice);
      const rightPrice = Number(right?.basePrice);
      const safeLeft = Number.isFinite(leftPrice) ? leftPrice : Number.POSITIVE_INFINITY;
      const safeRight = Number.isFinite(rightPrice) ? rightPrice : Number.POSITIVE_INFINITY;
      if (safeLeft !== safeRight) return safeLeft - safeRight;
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
    const byId = new Map(productsSortedByPrice.map((product) => [Number(product.id), product]));
    return featuredIds.map((id) => byId.get(id)).filter(Boolean);
  }, [featuredIds, productsSortedByPrice]);

  if (loading) {
    return (
      <div className="section-shell py-12">
        <p className="text-sm text-stone-300">{tr("Chargement du menu...", "Loading menu...")}</p>
      </div>
    );
  }

  if (message) {
    return (
      <div className="section-shell py-12">
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="section-shell py-12">
        <p className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-300">{tr("Aucun plat disponible.", "No dish available.")}</p>
      </div>
    );
  }

  return (
    <div className="section-shell space-y-10 pb-20 pt-12 sm:pt-14">
      <SeoHead
        title={tr(
          `Menu | ${siteName}`,
          `Menu | ${siteName}`
        )}
        description={tr(
          `Consultez le menu pizza napolitaine artisanal de ${siteName} en Moselle. Recettes, ingredients et prix.`,
          `Browse ${siteName}'s handmade Neapolitan pizza menu in Moselle. Recipes, ingredients and prices.`
        )}
        pathname="/menu"
        jsonLd={buildBaseFoodEstablishmentJsonLd({
          pagePath: "/menu",
          pageName: tr("Menu pizza napolitaine", "Neapolitan pizza menu"),
          description: tr(
            `Consultez le menu pizza napolitaine artisanal de ${siteName} en Moselle. Recettes, ingredients et prix.`,
            `Browse ${siteName}'s handmade Neapolitan pizza menu in Moselle. Recipes, ingredients and prices.`
          ),
          siteName,
        })}
      />
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-saffron">{tr("Menu restaurant", "Restaurant menu")}</p>
        <h1 className="font-display text-5xl uppercase tracking-[0.08em] text-white sm:text-6xl">{tr("Notre carte", "Our menu")}</h1>
        <p className="mx-auto max-w-2xl text-sm text-stone-300 sm:text-base">
          {tr(
            "Pizzas au four a bois et produits frais, présentes comme une vraie carte de restaurant.",
            "Wood-fired pizzas and fresh products, displayed like a real restaurant menu."
          )}
        </p>
      </header>

      <h2 className="sr-only">{tr("Catégories du menu", "Menu categories")}</h2>

      {featuredProducts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-bold uppercase tracking-[0.08em] text-saffron">
            {tr("Suggestions", "Suggestions")}
          </h2>
          <FeaturedPizzaSuggestions products={featuredProducts} tr={tr} compact />
        </section>
      ) : null}

      <MenuBoard
        products={productsSortedByPrice}
        categories={categories}
        tr={tr}
        variant="default"
        showProductImages={showMenuProductImages}
        emptyMessage={tr("Aucun plat disponible.", "No dish available.")}
      />

      <PageFaqSection
        pathname="/menu"
        title={tr("Questions fréquentes sur le menu", "Frequently asked questions about the menu")}
      />
    </div>
  );
}
