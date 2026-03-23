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

function formatRecommendedSupplement(item) {
  const numericPrice = Number(item?.price);
  const priceText = Number.isFinite(numericPrice)
    ? `(+${numericPrice.toFixed(2)} EUR)`
    : "(+? EUR)";
  return `${item?.name || ""} ${priceText}`.trim();
}

export function buildIngredientSummaryParts(product, tr) {
  const { classic, afterCooking, recommendedSupplements } = splitIngredientsByCookingPhase(product);

  if (classic.length === 0 && afterCooking.length === 0 && recommendedSupplements.length === 0) {
    return null;
  }

  const recommendationLabel = tr("Supplement", "Extra");
  const classicSegments = [...classic];

  if (recommendedSupplements.length > 0) {
    classicSegments.push(
      `${recommendationLabel}: ${recommendedSupplements
        .map((item) => formatRecommendedSupplement(item))
        .join(" - ")}`
    );
  }

  return {
    classicText: classicSegments.join(" - "),
    afterLabel: tr("Apres cuisson", "After cooking"),
    afterText: afterCooking.length > 0 ? afterCooking.join(" - ") : "",
  };
}
