function dedupeByIngredientId(list) {
  const unique = new Map();
  (Array.isArray(list) ? list : []).forEach((ingredient) => {
    const id = String(ingredient?.id || "").trim();
    if (!id) return;
    if (!unique.has(id)) {
      unique.set(id, ingredient);
    }
  });
  return [...unique.values()];
}

export function getActiveRecommendedSupplements(productIngredients) {
  const recommended = Array.isArray(productIngredients)
    ? productIngredients
        .filter(
          (entry) =>
            Boolean(entry?.isRecommended) &&
            Boolean(entry?.ingredient?.isExtra) &&
            Boolean(entry?.ingredient?.active)
        )
        .map((entry) => entry?.ingredient)
        .filter(Boolean)
    : [];

  return dedupeByIngredientId(recommended);
}

