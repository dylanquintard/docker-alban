function formatPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
}

function splitIngredientsByCookingPhase(product) {
  const entries = Array.isArray(product?.ingredients) ? product.ingredients : [];
  const classic = [];
  const afterCooking = [];
  const recommendedSupplements = [];

  entries.forEach((entry) => {
    const name = String(entry?.ingredient?.name || "").trim();
    if (!name) return;
    if (entry?.isRecommended && entry?.ingredient?.isExtra) {
      recommendedSupplements.push({
        name,
        price: entry?.ingredient?.price,
      });
      return;
    }
    if (entry?.isAfterCooking) {
      afterCooking.push(name);
      return;
    }
    classic.push(name);
  });

  return { classic, afterCooking, recommendedSupplements };
}

export default function FeaturedPizzaSuggestions({
  products = [],
  tr,
  compact = false,
  showAddButton = false,
  onAddProduct,
  getCanCustomize,
}) {
  const translate = typeof tr === "function" ? tr : (fr) => fr;

  if (!Array.isArray(products) || products.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-stone-300">
        {translate(
          "Aucun produit mis en avant pour le moment.",
          "No featured product at the moment."
        )}
      </div>
    );
  }

  return (
    <div className={`grid ${compact ? "gap-3 md:grid-cols-2" : "gap-4 md:grid-cols-2"}`}>
      {products.map((product) => {
        const ingredients = splitIngredientsByCookingPhase(product);
        const canCustomize =
          typeof getCanCustomize === "function"
            ? Boolean(getCanCustomize(product))
            : Boolean(product?.isCustomizable);
        const classicText = ingredients.classic.length > 0 ? ingredients.classic.join(" - ") : "";
        const afterText =
          ingredients.afterCooking.length > 0
            ? `${translate("Apres cuisson", "After cooking")}: ${ingredients.afterCooking.join(" - ")}`
            : "";
        const recommendedText =
          ingredients.recommendedSupplements.length > 0
            ? `[ ${translate("Supplement", "Supplement")}: ${ingredients.recommendedSupplements
                .map((item) => {
                  const numericPrice = Number(item?.price);
                  const priceText = Number.isFinite(numericPrice)
                    ? `${numericPrice.toFixed(2)} EUR`
                    : "? EUR";
                  return `"${item?.name || ""}" + ${priceText}`;
                })
                .join(" - ")} ]`
            : "";

        return (
          <article
            key={product.id}
            className={`rounded-2xl border border-white/10 bg-charcoal/35 ${compact ? "p-3" : "p-4"}`}
          >
            <div className={`flex items-start ${compact ? "" : "gap-3 sm:gap-4"}`}>
              {!compact ? (
                <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 sm:h-24 sm:w-24">
                  {String(product?.thumbnailUrl || product?.imageUrl || "").trim() ? (
                    <img
                      src={product.thumbnailUrl || product.imageUrl}
                      alt={product.imageAlt || product.name || translate("Photo produit", "Product photo")}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.1em] text-stone-400">
                      {translate("PHOTO A VENIR", "PHOTO COMING SOON")}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className={`font-semibold uppercase tracking-wide text-white ${
                      compact ? "text-sm sm:text-[15px]" : "text-base sm:text-[17px]"
                    }`}
                  >
                    {product.name}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`whitespace-nowrap font-extrabold uppercase tracking-wide text-saffron ${
                        compact ? "text-xs sm:text-sm" : "text-sm"
                      }`}
                    >
                      {formatPrice(product.basePrice)} EUR
                    </span>
                    {showAddButton ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof onAddProduct === "function") {
                            onAddProduct(product);
                          }
                        }}
                        title={
                          canCustomize
                            ? translate("Configurer et ajouter", "Customize and add")
                            : translate("Ajouter au panier", "Add to cart")
                        }
                        aria-label={
                          canCustomize
                            ? `${translate("Configurer", "Customize")} ${product.name}`
                            : `${translate("Ajouter", "Add")} ${product.name}`
                        }
                        className="relative -top-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-saffron/70 text-[12px] font-bold leading-none text-saffron transition hover:bg-saffron/15"
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                </div>
                {product.description ? (
                  <p className={`text-stone-300 ${compact ? "mt-1 text-xs sm:text-sm" : "mt-2 text-sm"}`}>
                    {product.description}
                  </p>
                ) : null}
                {classicText || afterText || recommendedText ? (
                  <p
                    className={`mt-0.5 uppercase text-stone-400 ${
                      compact ? "text-[8px] tracking-[0.1em] sm:text-[10px]" : "text-[9px] tracking-[0.11em] sm:text-[11px]"
                    }`}
                  >
                    {classicText ? <span>{classicText}</span> : null}
                    {classicText && afterText ? <span> / </span> : null}
                    {afterText ? <span className="text-saffron italic">{afterText}</span> : null}
                    {(classicText || afterText) && recommendedText ? <span> </span> : null}
                    {recommendedText ? <span className="text-emerald-300 italic">{recommendedText}</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
