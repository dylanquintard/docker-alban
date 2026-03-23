import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCategories } from "../api/category.api";
import { getLocations } from "../api/location.api";
import { getPickupAvailability } from "../api/timeslot.api";
import {
  addToCart,
  finalizeOrder,
  getAllIngredients,
  getAllProductsClient,
} from "../api/user.api";
import FeaturedPizzaSuggestions from "../components/pizza/FeaturedPizzaSuggestions";
import SeoHead from "../components/seo/SeoHead";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useRealtimeEvents } from "../hooks/useRealtimeEvents";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS, getLocalizedSiteText } from "../site/siteSettings";
import { getLocationDisplayName } from "../utils/location";
import { getActiveRecommendedSupplements } from "../utils/orderCustomizations";

const FOCUSABLE_SELECTOR =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function toLocalIsoDate(dateValue) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(isoDate, delta) {
  const next = new Date(`${isoDate}T00:00:00`);
  next.setDate(next.getDate() + delta);
  return toLocalIsoDate(next);
}

function formatNavigatorDate(isoDate, locale) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPrice(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed.toFixed(2);
}

function sortProductsByPrice(list) {
  return [...(Array.isArray(list) ? list : [])].sort((left, right) => {
    const leftPrice = Number(left?.basePrice);
    const rightPrice = Number(right?.basePrice);
    const normalizedLeft = Number.isFinite(leftPrice) ? leftPrice : Number.POSITIVE_INFINITY;
    const normalizedRight = Number.isFinite(rightPrice) ? rightPrice : Number.POSITIVE_INFINITY;
    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

function getCartItemProduct(item) {
  return item?.product || item?.menuItem || null;
}

function getCartItemName(item) {
  return getCartItemProduct(item)?.name || item?.name || `Produit #${item?.id ?? "?"}`;
}

function getCartIngredientName(ingredient) {
  return ingredient?.name || ingredient?.ingredient?.name || "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isPizzaCategoryLabel(value) {
  return normalizeText(value).includes("pizza");
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

function buildIngredientSummaryParts(product, tr) {
  const { classic, afterCooking, recommendedSupplements } = splitIngredientsByCookingPhase(product);
  if (classic.length === 0 && afterCooking.length === 0 && recommendedSupplements.length === 0) {
    return null;
  }
  const afterLabel = tr("Après cuisson", "After cooking");
  const classicText = classic.length > 0 ? classic.join(" - ") : "";
  const afterText = afterCooking.length > 0 ? `${afterLabel}: ${afterCooking.join(" - ")}` : "";
  const recommendationLabel = tr("Supplement", "Supplement");
  const recommendedText =
    recommendedSupplements.length > 0
      ? `[ ${recommendationLabel}: ${recommendedSupplements
          .map((item) => {
            const numericPrice = Number(item?.price);
            const priceText = Number.isFinite(numericPrice)
              ? `${numericPrice.toFixed(2)} EUR`
              : "? EUR";
            return `"${item?.name || ""}" + ${priceText}`;
          })
          .join(" - ")} ]`
      : "";
  return { classicText, afterText, recommendedText };
}

function isCustomizableProduct(product, categoryTitle) {
  if (!product) return false;

  if (isPizzaCategoryLabel(categoryTitle)) return true;

  if (isPizzaCategoryLabel(product.name) || isPizzaCategoryLabel(product.description)) {
    return true;
  }

  return Array.isArray(product.ingredients) && product.ingredients.length > 0;
}

function getIngredientCategoryKey(ingredient) {
  return String(ingredient?.category?.id ?? "uncategorized");
}

function dedupeIngredients(list) {
  const unique = new Map();
  (Array.isArray(list) ? list : []).forEach((ingredient) => {
    if (ingredient?.id) {
      unique.set(ingredient.id, ingredient);
    }
  });
  return [...unique.values()];
}

function moveSelectedItemToTop(list, selectedId) {
  if (!selectedId) return list;
  const selectedEntry = list.find((entry) => String(entry.id) === String(selectedId));
  if (!selectedEntry) return list;
  return [
    selectedEntry,
    ...list.filter((entry) => String(entry.id) !== String(selectedId)),
  ];
}

function AccordionChevron({ open }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m5 7 5 6 5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatPickupAddress(location, tr) {
  if (!location) return tr("Adresse de retrait non disponible", "Pickup address unavailable");
  const cityLine = `${location.postalCode || ""} ${location.city || ""}`.trim();
  return [location.addressLine1, cityLine].filter(Boolean).join(", ");
}

function ProductCustomizerModal({
  product,
  ingredients,
  selectedExtras,
  removedIngredients,
  baseAddedIngredients,
  quantity,
  onClose,
  onExtrasChange,
  onRemovedChange,
  onBaseChangesChange,
  onQuantityChange,
  onConfirm,
  onCancelCustomization,
  tr,
}) {
  const [step, setStep] = useState("intro");
  const extraIngredients = useMemo(
    () => (Array.isArray(ingredients) ? ingredients.filter((ingredient) => ingredient?.isExtra) : []),
    [ingredients]
  );
  const removableIngredients = useMemo(
    () =>
      Array.isArray(product.ingredients)
        ? product.ingredients
            .filter(
              (entry) => !(Boolean(entry?.isRecommended) && Boolean(entry?.ingredient?.isExtra))
            )
            .map((entry) => entry?.ingredient)
            .filter(Boolean)
        : [],
    [product]
  );
  const recommendedSupplements = useMemo(
    () => getActiveRecommendedSupplements(product?.ingredients),
    [product?.ingredients]
  );
  const groupedExtras = extraIngredients.reduce((acc, ingredient) => {
    const key = getIngredientCategoryKey(ingredient);
    if (!acc[key]) {
      acc[key] = {
        key,
        label: ingredient.category?.name || tr("Sans catégorie", "Uncategorized"),
        items: [],
      };
    }
    acc[key].items.push(ingredient);
    return acc;
  }, {});

  const productBaseEntry = useMemo(() => {
    const linkedEntries = Array.isArray(product.ingredients)
      ? product.ingredients.filter((entry) => entry?.ingredient)
      : [];

    const explicitlyMarkedBase = linkedEntries.find((entry) => Boolean(entry?.isBase));
    if (explicitlyMarkedBase) return explicitlyMarkedBase;

    return (
      linkedEntries.find((entry) => Boolean(entry?.ingredient?.isBaseIngredient)) ||
      null
    );
  }, [product]);

  const currentBaseIngredient = productBaseEntry?.ingredient || null;
  const currentBaseIngredientId = useMemo(() => {
    const idFromLink = productBaseEntry?.ingredientId;
    const idFromIngredient = productBaseEntry?.ingredient?.id;
    return String(idFromLink ?? idFromIngredient ?? "");
  }, [productBaseEntry]);

  const availableBaseIngredients = useMemo(() => {
    return (Array.isArray(ingredients) ? ingredients : []).filter(
      (ingredient) =>
        ingredient &&
        ingredient.isBaseIngredient &&
        (!currentBaseIngredientId || String(ingredient.id) !== currentBaseIngredientId)
    );
  }, [ingredients, currentBaseIngredientId]);

  const [selectedBaseIngredientId, setSelectedBaseIngredientId] = useState("");
  const [openCustomizationSectionKey, setOpenCustomizationSectionKey] = useState("");
  const initialBaseReplacementRef = useRef(null);

  useEffect(() => {
    initialBaseReplacementRef.current = Array.isArray(baseAddedIngredients)
      ? baseAddedIngredients[0] || null
      : null;
  }, [baseAddedIngredients]);

  useEffect(() => {
    const existingReplacement = initialBaseReplacementRef.current;
    setSelectedBaseIngredientId(
      existingReplacement?.id
        ? String(existingReplacement.id)
        : currentBaseIngredientId
          ? currentBaseIngredientId
          : ""
    );
    setOpenCustomizationSectionKey("");
    setStep("intro");
  }, [product?.id, currentBaseIngredientId]);

  const displayedBaseIngredients = useMemo(() => {
    const allChoices = [
      ...(currentBaseIngredient ? [currentBaseIngredient] : []),
      ...availableBaseIngredients,
    ];
    return moveSelectedItemToTop(dedupeIngredients(allChoices), selectedBaseIngredientId);
  }, [availableBaseIngredients, currentBaseIngredient, selectedBaseIngredientId]);

  const selectedBaseIngredient = useMemo(
    () =>
      displayedBaseIngredients.find(
        (ingredient) => String(ingredient.id) === String(selectedBaseIngredientId)
      ) || currentBaseIngredient,
    [displayedBaseIngredients, selectedBaseIngredientId, currentBaseIngredient]
  );

  const hasBaseReplacement =
    Boolean(currentBaseIngredientId) &&
    Boolean(selectedBaseIngredient?.id) &&
    String(selectedBaseIngredient.id) !== currentBaseIngredientId;
  const lockedIngredientIdsInStep2 = useMemo(() => {
    const ids = [];

    if (hasBaseReplacement) {
      ids.push(currentBaseIngredientId);
    }

    (Array.isArray(removedIngredients) ? removedIngredients : []).forEach((ingredient) => {
      ids.push(ingredient?.id);
    });

    return new Set(
      ids
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );
  }, [currentBaseIngredientId, hasBaseReplacement, removedIngredients]);

  useEffect(() => {
    if (!hasBaseReplacement || !currentBaseIngredientId) return;

    const isCurrentBaseInRemovedList = (Array.isArray(removedIngredients) ? removedIngredients : []).some(
      (entry) => String(entry?.id) === currentBaseIngredientId
    );
    const currentBaseForCleanup =
      currentBaseIngredient ||
      removableIngredients.find(
        (ingredient) => String(ingredient?.id) === currentBaseIngredientId
      ) ||
      null;

    if (isCurrentBaseInRemovedList && currentBaseForCleanup) {
      onRemovedChange(currentBaseForCleanup, false);
    }
  }, [
    hasBaseReplacement,
    currentBaseIngredientId,
    currentBaseIngredient,
    removableIngredients,
    removedIngredients,
    onRemovedChange,
  ]);

  useEffect(() => {
    if (!(lockedIngredientIdsInStep2 instanceof Set) || lockedIngredientIdsInStep2.size === 0) {
      return;
    }

    (Array.isArray(selectedExtras) ? selectedExtras : []).forEach((ingredient) => {
      const ingredientId = String(ingredient?.id || "").trim();
      if (!ingredientId) return;
      if (!lockedIngredientIdsInStep2.has(ingredientId)) return;
      onExtrasChange(ingredient, false);
    });
  }, [lockedIngredientIdsInStep2, onExtrasChange, selectedExtras]);

  const alternativeBaseIngredients = useMemo(
    () =>
      displayedBaseIngredients.filter(
        (ingredient) => String(ingredient.id) !== String(selectedBaseIngredient?.id || "")
      ),
    [displayedBaseIngredients, selectedBaseIngredient]
  );

  const customizationSections = useMemo(() => {
    const extraSections = Object.values(groupedExtras).map((group) => ({
      key: `extra-${group.key}`,
      label: group.label,
      type: "extra",
      items: group.items,
    }));

    return extraSections.filter(
      (section) => Array.isArray(section.items) && section.items.length > 0
    );
  }, [groupedExtras]);

  const currentPizzaPrice = useMemo(() => {
    const basePrice = Number(product?.basePrice || 0);
    const extrasTotal = (Array.isArray(selectedExtras) ? selectedExtras : []).reduce(
      (sum, ingredient) => sum + Number(ingredient?.price || 0),
      0
    );
    return basePrice + extrasTotal;
  }, [product?.basePrice, selectedExtras]);

  const syncBaseChanges = () => {
    const currentBaseForRemoval =
      currentBaseIngredient ||
      removableIngredients.find(
        (ingredient) => String(ingredient?.id) === currentBaseIngredientId
      ) ||
      null;

    if (hasBaseReplacement) {
      onBaseChangesChange({
        added: dedupeIngredients([selectedBaseIngredient]),
        removed: dedupeIngredients([currentBaseForRemoval]),
      });
    } else {
      onBaseChangesChange({
        added: [],
        removed: [],
      });
    }
  };

  const applyBaseChangesAndContinue = () => {
    syncBaseChanges();
    setOpenCustomizationSectionKey("");
    setStep("customize");
  };

  const handleConfirmFromCurrentStep = () => {
    if (step === "base") {
      syncBaseChanges();
    }

    onConfirm();
  };

  const handleCancelCurrentProduct = () => {
    onCancelCustomization();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-black/70 p-3 sm:items-center sm:p-4">
      <div className="my-4 max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/50 bg-white p-4 text-stone-900 shadow-2xl sm:my-0 sm:max-h-[min(92vh,960px)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ember">
              {tr("Personnalisation pizza", "Pizza customization")}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-stone-900">{product.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
          >
            {tr("Fermer", "Close")}
          </button>
        </div>

        {step === "intro" ? (
          <div className="rounded-3xl border border-stone-200 bg-stone-50/80 p-5">
            <p className="text-base font-semibold text-stone-900">
              {tr(
                "Souhaitez-vous apporter des modifications a votre pizza ou modifier la quantite commandee ?",
                "Would you like to customize your pizza or change the quantity?"
              )}
            </p>
            <p className="mt-2 text-sm text-stone-500">
              {tr(
                "Commencez simplement, puis ouvrez les modifications uniquement si vous souhaitez ajuster les ingrédients.",
                "Start simple, then open customization only if you want to adjust ingredients."
              )}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (
                    currentBaseIngredient ||
                    availableBaseIngredients.length > 0 ||
                    removableIngredients.length > 0 ||
                    recommendedSupplements.length > 0
                  ) {
                    setStep("base");
                    return;
                  }
                  setOpenCustomizationSectionKey("");
                  setStep("customize");
                }}
                className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold uppercase tracking-wide text-stone-800 transition hover:bg-stone-100"
              >
                {tr("Apporter des modifications", "Customize this pizza")}
              </button>

              <div className="flex items-center rounded-full border border-stone-300 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(1, Number(quantity || 1) - 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-stone-700 transition hover:bg-stone-100"
                  aria-label={tr("Retirer un article", "Decrease quantity")}
                >
                  -
                </button>
                <span className="min-w-[56px] text-center text-base font-bold text-stone-900">
                  {Math.max(1, Number(quantity || 1))}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(1, Number(quantity || 1) + 1))}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-stone-700 transition hover:bg-stone-100"
                  aria-label={tr("Ajouter un article", "Increase quantity")}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === "base" ? (
          <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ember">
              {tr("Etape 1", "Step 1")}
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
              <div className="space-y-3">
                <div className="rounded-2xl border-2 border-amber-300 bg-white px-3 py-3 sm:px-4">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-stone-800">
                  {tr("MODIFIER LA BASE PIZZA", "EDIT PIZZA BASE")}
                </p>
                {!currentBaseIngredient && availableBaseIngredients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                    {tr(
                      "Aucun élément de base n'est configuré pour ce plat. Vous pouvez continuer.",
                      "No base element is configured for this dish. You can continue."
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-950">
                      {selectedBaseIngredient ? (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold sm:text-[11px]">{selectedBaseIngredient.name}</p>
                          </div>
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white">
                            {tr("Actif", "Active")}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-emerald-800">
                          {tr("Aucun ingrédient de base disponible.", "No base ingredient available.")}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-stone-500">
                      {tr(
                        "Le remplacement de base ne change pas le prix.",
                        "Base replacement does not change the price."
                      )}
                    </p>

                    <div className="space-y-1.5">
                      {alternativeBaseIngredients.length > 0 ? (
                        alternativeBaseIngredients.map((ingredient) => (
                          <button
                            key={ingredient.id}
                            type="button"
                            onClick={() => setSelectedBaseIngredientId(String(ingredient.id))}
                            className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-left text-rose-900 transition hover:bg-rose-100"
                          >
                            <div>
                              <p className="text-[10px] font-semibold sm:text-[11px]">{ingredient.name}</p>
                            </div>
                            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white">
                              {tr("Disponible", "Available")}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                          {tr(
                            "Aucune autre base disponible pour cette pizza.",
                            "No other base is available for this pizza."
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>

                <div className="rounded-2xl border-2 border-amber-300 bg-white px-3 py-3 sm:px-4">
                  <p className="text-sm font-bold uppercase tracking-[0.14em] text-stone-800">
                    {tr("SUGGESTION DE SUPPLEMENT", "SUPPLEMENT SUGGESTION")}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {recommendedSupplements.length > 0 ? (
                      recommendedSupplements.map((ingredient) => {
                        const isActive = selectedExtras.some(
                          (entry) => String(entry?.id) === String(ingredient?.id)
                        );
                        return (
                          <button
                            key={`recommended-${ingredient.id}`}
                            type="button"
                            onClick={() => onExtrasChange(ingredient, !isActive)}
                            className={`flex min-h-[42px] w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition ${
                              isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                                : "border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100"
                            }`}
                          >
                            <div>
                              <p className="text-[10px] font-semibold sm:text-[11px]">{ingredient.name}</p>
                              <p className="text-[10px]">+{formatPrice(ingredient.price)} EUR</p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white ${
                                isActive ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            >
                              {isActive ? tr("Actif", "Active") : tr("Disponible", "Available")}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                        {tr(
                          "Aucun supplement recommande pour cette pizza.",
                          "No recommended supplement for this pizza."
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 sm:px-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                    {tr("PRIX ACTUEL", "CURRENT PRICE")}
                  </p>
                  <p className="mt-1 text-base font-extrabold text-amber-900">
                    {formatPrice(currentPizzaPrice)} EUR
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:p-4">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-stone-800">
                  {tr("Retirer un ingrédient :", "Remove an ingredient:")}
                </p>

                <div className="space-y-1.5">
                  {removableIngredients.length > 0 ? (
                    removableIngredients.map((ingredient) => {
                      const isRemoved = removedIngredients.some((entry) => entry.id === ingredient.id);
                      const isLockedOriginalBase =
                        Boolean(hasBaseReplacement) &&
                        Boolean(currentBaseIngredientId) &&
                        String(ingredient.id) === currentBaseIngredientId;
                      const isDisplayedAsRemoved = isRemoved || isLockedOriginalBase;
                      return (
                        <button
                          key={ingredient.id}
                          type="button"
                          onClick={() => {
                            if (isLockedOriginalBase) return;
                            onRemovedChange(ingredient, !isRemoved);
                          }}
                          disabled={isLockedOriginalBase}
                          className={`flex min-h-[42px] w-full items-center justify-between rounded-xl border px-2.5 py-1.5 text-left transition ${
                            isDisplayedAsRemoved
                              ? "border-rose-200 bg-rose-50 text-rose-900"
                              : "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                          } ${isLockedOriginalBase ? "cursor-not-allowed opacity-95" : ""}`}
                        >
                          <div>
                            <p className="text-[10px] font-semibold sm:text-[11px]">{ingredient.name}</p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-white ${
                              isDisplayedAsRemoved ? "bg-rose-600" : "bg-emerald-600"
                            }`}
                          >
                            {isDisplayedAsRemoved ? tr("Retiré", "Removed") : tr("Actif", "Active")}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                      {tr(
                        "Aucun ingrédient lie a cette pizza n'est disponible pour le retrait.",
                        "No linked ingredient is available for removal on this pizza."
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
              <button
                type="button"
                onClick={() => setStep("intro")}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 transition hover:bg-stone-100"
              >
                {tr("Retour", "Back")}
              </button>
              <button
                type="button"
                onClick={applyBaseChangesAndContinue}
                className="rounded-full bg-ember px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-tomato"
              >
                {tr("Continuer ->", "Continue ->")}
              </button>
            </div>
          </div>
        ) : step === "customize" ? (
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ember">
                {tr("Etape 2", "Step 2")}
              </p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {tr("Ajouter des ingrédients et verifier le recap", "Add ingredients and review the summary")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,7fr)_minmax(260px,3fr)]">
            <div className="rounded-3xl border border-stone-200 bg-white p-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                {tr("Supplements disponibles :", "Available extras:")}
              </p>
              <div className="space-y-3">
                {customizationSections.length === 0 ? (
                  <p className="text-xs text-stone-500">
                    {tr(
                      "Aucune catégorie d'ingrédients disponible pour cette pizza.",
                      "No ingredient category is available for this pizza."
                    )}
                  </p>
                ) : (
                  customizationSections.map((section) => {
                    const isOpen = openCustomizationSectionKey === section.key;
                    return (
                      <div
                        key={section.key}
                        className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenCustomizationSectionKey((prev) =>
                              prev === section.key ? "" : section.key
                            )
                          }
                            className="flex w-full items-center justify-between gap-3 bg-stone-100/80 px-4 py-3 text-left transition hover:bg-stone-200/70"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold uppercase tracking-wide text-stone-800">
                                {section.label}
                              </p>
                            </div>
                            <span className="shrink-0 text-stone-500">
                              <AccordionChevron open={isOpen} />
                            </span>
                        </button>

                        {isOpen ? (
                          <div className="border-t border-stone-200 bg-white p-3">
                            <div className="space-y-2">
                              {section.items.map((ingredient) => (
                                (() => {
                                  const ingredientId = String(ingredient.id);
                                  const isLockedInStep2 = lockedIngredientIdsInStep2.has(
                                    ingredientId
                                  );
                                  const isChecked = selectedExtras.some(
                                    (entry) => entry.id === ingredient.id
                                  );

                                  return (
                                    <label
                                      key={ingredient.id}
                                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                        isLockedInStep2
                                          ? "cursor-not-allowed bg-stone-100 text-stone-400"
                                          : "hover:bg-stone-100"
                                      }`}
                                    >
                                      <span className="sr-only">{ingredient.name}</span>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={isLockedInStep2}
                                        onChange={(event) => {
                                          if (isLockedInStep2) return;
                                          onExtrasChange(ingredient, event.target.checked);
                                        }}
                                        className={`h-4 w-4 ${
                                          isLockedInStep2
                                            ? "cursor-not-allowed accent-stone-400"
                                            : "cursor-pointer accent-saffron"
                                        }`}
                                      />
                                      <div>
                                        <p
                                          className={`font-medium ${
                                            isLockedInStep2
                                              ? "text-stone-500"
                                              : "text-stone-900"
                                          }`}
                                        >
                                          {ingredient.name}
                                        </p>
                                        <p
                                          className={`text-xs ${
                                            isLockedInStep2
                                              ? "text-stone-400"
                                              : "text-stone-500"
                                          }`}
                                        >
                                          +{formatPrice(ingredient.price)}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })()
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-stone-50/85 p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                {tr("Recap des modifications", "Customization summary")}
              </p>
              <div className="space-y-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {tr("Base du plat", "Dish base")}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-stone-700">
                    {currentBaseIngredient ? (
                      <>
                        {hasBaseReplacement ? (
                          <>
                            <p>- {currentBaseIngredient.name}</p>
                            <p className="font-semibold text-emerald-700">
                              + {selectedBaseIngredient?.name}
                            </p>
                          </>
                        ) : (
                          <p className="font-semibold text-emerald-700">
                            {currentBaseIngredient.name}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>{tr("Aucune base configurée", "No base configured")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {tr("Supplements ajoutes", "Added extras")}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-stone-700">
                    {selectedExtras.length > 0 ? (
                      selectedExtras.map((ingredient) => (
                        <p key={ingredient.id}>
                          + {ingredient.name} (+{formatPrice(ingredient.price)})
                        </p>
                      ))
                    ) : (
                      <p>{tr("Aucun supplement ajoute", "No extra added")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {tr("Ingrédients retirés", "Removed ingredients")}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-stone-700">
                    {removedIngredients.length > 0 ? (
                      removedIngredients.map((ingredient) => (
                        <p key={ingredient.id}>- {ingredient.name}</p>
                      ))
                    ) : (
                      <p>{tr("Aucun ingrédient retiré", "No ingredient removed")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {tr("Quantite", "Quantity")}
                  </p>
                  <div className="mt-2 flex items-center rounded-full border border-stone-300 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => onQuantityChange(Math.max(1, Number(quantity || 1) - 1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-stone-700 transition hover:bg-stone-100"
                      aria-label={tr("Retirer un article", "Decrease quantity")}
                    >
                      -
                    </button>
                    <span className="min-w-[48px] text-center text-sm font-bold text-stone-900">
                      {Math.max(1, Number(quantity || 1))}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuantityChange(Math.max(1, Number(quantity || 1) + 1))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-stone-700 transition hover:bg-stone-100"
                      aria-label={tr("Ajouter un article", "Increase quantity")}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">
                    {tr("Prix actuel", "Current price")}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-stone-900">
                    {formatPrice(currentPizzaPrice)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmFromCurrentStep}
                  className="w-full rounded-full bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:bg-tomato"
                >
                  {tr("Valider modifications", "Validate changes")}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("base")}
                  className="w-full rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  {tr("Retour", "Back")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCurrentProduct}
                  className="w-full rounded-full border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
                >
                  {tr("Annuler la commande", "Cancel order")}
                </button>
              </div>
            </div>
          </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-3 text-sm text-stone-500">
            {tr(
              "Aucune modification appliquee pour le moment. Vous pouvez ajouter la pizza telle quelle ou ouvrir les options de personnalisation.",
              "No customization applied yet. You can add the pizza as it is or open the customization options."
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <div className="text-sm text-stone-500">
            {step === "customize"
              ? tr("Les supplements change le prix final de la pizza.", "Extras change the final pizza price.")
              : step === "base"
                ? ""
                : tr("Version standard de la pizza.", "Standard pizza version.")}
          </div>
          {step === "intro" ? (
            <button
              type="button"
              onClick={handleConfirmFromCurrentStep}
              className="rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-tomato"
            >
              {tr("Ajouter au panier", "Add to cart")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Order() {
  const { token } = useContext(AuthContext);
  const { language, tr, locale } = useLanguage();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const { cartItems, itemCount, cartTotal, setCartFromResponse, refreshCart, removeItem, clearCart, loading: cartLoading } =
    useContext(CartContext);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extras, setExtras] = useState([]);
  const [locations, setLocations] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toLocalIsoDate(new Date()));
  const [selectedPickupTime, setSelectedPickupTime] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [removedIngredients, setRemovedIngredients] = useState([]);
  const [baseAddedIngredients, setBaseAddedIngredients] = useState([]);
  const [baseRemovedIngredients, setBaseRemovedIngredients] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  const [validatedCartSignature, setValidatedCartSignature] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [activeCategoryKey, setActiveCategoryKey] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const finalizeModalRef = useRef(null);

  const todayIso = toLocalIsoDate(new Date());
  const canGoPreviousDate = selectedDate > todayIso;
  const quantityForAvailability = Math.max(1, Number(itemCount || 0));
  const cartSignature = useMemo(
    () =>
      cartItems
        .map((item) => {
          const added = (item.addedIngredients || [])
            .map((entry) => getCartIngredientName(entry))
            .join(",");
          const removed = (item.removedIngredients || [])
            .map((entry) => getCartIngredientName(entry))
            .join(",");
          return `${item.id}:${item.quantity}:${item.unitPrice}:${added}:${removed}`;
        })
        .join("|"),
    [cartItems]
  );
  const isCartValidated =
    cartItems.length > 0 &&
    validatedCartSignature !== "" &&
    validatedCartSignature === cartSignature;
  const pickupIntroText = getLocalizedSiteText(
    settings.order?.pickupIntroText,
    language,
    tr("Choisissez d'abord la date, l'horaire, puis l'adresse de retrait.", "Choose date first, then pickup time and location.")
  );
  const pickupConfirmationText = getLocalizedSiteText(
    settings.order?.pickupConfirmationText,
    language,
    tr(
      "Vérifiez bien cette adresse avant de finaliser la commande.",
      "Please verify this address before finalizing your order."
    )
  );
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const showMenuProductImages = settings?.order?.showMenuProductImages !== false;
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
  const orderPageTitle = tr(
    `Commander une pizza | ${siteName}`,
    `Order pizza online | ${siteName}`
  );
  const orderPageDescription = tr(
    `Commandez votre pizza en ligne chez ${siteName}. Choisissez votre date, votre horaire et votre adresse de retrait en quelques clics.`,
    `Order your pizza online from ${siteName}. Choose your date, pickup slot and collection point in just a few clicks.`
  );

  useEffect(() => {
    if (!message) return undefined;

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitialData() {
      // Cart loading should not block menu rendering.
      void refreshCart();

      try {
        const [productResult, categoryResult, ingredientResult, locationResult] = await Promise.allSettled([
          getAllProductsClient(),
          getCategories({ active: true, kind: "PRODUCT" }),
          getAllIngredients(token, { active: true }),
          getLocations({ active: true }),
        ]);

        if (!cancelled) {
          const productData =
            productResult.status === "fulfilled" && Array.isArray(productResult.value)
              ? productResult.value
              : [];
          const categoryData =
            categoryResult.status === "fulfilled" && Array.isArray(categoryResult.value)
              ? categoryResult.value
              : [];
          const ingredientData =
            ingredientResult.status === "fulfilled" && Array.isArray(ingredientResult.value)
              ? ingredientResult.value
              : [];
          const locationData =
            locationResult.status === "fulfilled" && Array.isArray(locationResult.value)
              ? locationResult.value
              : [];

          setProducts(productData);
          setCategories(categoryData);
          setExtras(ingredientData);
          setLocations(locationData);

          const hasCriticalFailure =
            productResult.status === "rejected" || categoryResult.status === "rejected";
          if (hasCriticalFailure) {
            const productError = productResult.status === "rejected" ? productResult.reason : null;
            const categoryError = categoryResult.status === "rejected" ? categoryResult.reason : null;
            const errorMessage =
              productError?.response?.data?.error ||
              categoryError?.response?.data?.error ||
              tr("Erreur lors du chargement de la page commande", "Error while loading order page");
            setMessage(errorMessage);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err.response?.data?.error || tr("Erreur lors du chargement de la page commande", "Error while loading order page"));
        }
      }
    }

    fetchInitialData();
    return () => {
      cancelled = true;
    };
  }, [refreshCart, token, tr]);

  const refreshAvailability = useCallback(async () => {
    if (!isCartValidated || itemCount <= 0) {
      setAvailabilitySlots([]);
      setSelectedPickupTime("");
      setSelectedLocationId("");
      return;
    }

    try {
      const response = await getPickupAvailability(token, {
        date: selectedDate,
        quantity: quantityForAvailability,
      });

      const slots = Array.isArray(response?.slots) ? response.slots : [];
      const availableSlots = slots.filter((slot) => slot.availableForQuantity);
      setAvailabilitySlots(availableSlots);
    } catch (err) {
      setAvailabilitySlots([]);
      setMessage(
        err.response?.data?.error ||
          tr("Impossible de reçuperer les disponibilités", "Unable to fetch pickup availability")
      );
    }
  }, [isCartValidated, itemCount, selectedDate, quantityForAvailability, token, tr]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  useEffect(() => {
    const hasSelectedTime = availabilitySlots.some(
      (slot) => slot.pickupTime === selectedPickupTime
    );
    if (!hasSelectedTime) {
      setSelectedPickupTime("");
      setSelectedLocationId("");
      return;
    }

    const hasSelectedLocation = availabilitySlots.some(
      (slot) =>
        slot.pickupTime === selectedPickupTime &&
        String(slot.locationId) === String(selectedLocationId)
    );
    if (!hasSelectedLocation) {
      setSelectedLocationId("");
    }
  }, [availabilitySlots, selectedPickupTime, selectedLocationId]);

  const handleRealtimeEvent = useCallback(
    (eventName) => {
      if (eventName === "timeslots:updated") {
        refreshAvailability();
        return;
      }

      if (eventName === "locations:updated") {
        getLocations({ active: true })
          .then((locationData) => {
            setLocations(Array.isArray(locationData) ? locationData : []);
            refreshAvailability();
          })
          .catch(() => {});
        return;
      }

      if (eventName === "cart:updated" || eventName === "orders:user-updated") {
        refreshCart();
        refreshAvailability();
      }
    },
    [refreshAvailability, refreshCart]
  );

  useRealtimeEvents({
    enabled: Boolean(token),
    onEvent: handleRealtimeEvent,
    onConnectionChange: setRealtimeConnected,
  });

  useEffect(() => {
    if (cartItems.length === 0) {
      setValidatedCartSignature("");
      setSelectedPickupTime("");
      setSelectedLocationId("");
    }
  }, [cartItems.length]);

  const timeOptions = useMemo(() => {
    const grouped = new Map();
    for (const slot of availabilitySlots) {
      const key = slot.pickupTime;
      if (!grouped.has(key)) {
        grouped.set(key, {
          pickupTime: key,
          remainingCapacity: 0,
          locationCount: 0,
        });
      }

      const current = grouped.get(key);
      current.remainingCapacity += Number(slot.remainingCapacity || 0);
      current.locationCount += 1;
    }

    return [...grouped.values()].sort((left, right) =>
      String(left.pickupTime).localeCompare(String(right.pickupTime))
    );
  }, [availabilitySlots]);

  const locationsForSelectedTime = useMemo(
    () =>
      availabilitySlots
        .filter((slot) => slot.pickupTime === selectedPickupTime)
        .sort((left, right) =>
          String(left.location?.name || "").localeCompare(String(right.location?.name || ""))
        ),
    [availabilitySlots, selectedPickupTime]
  );

  const selectedSlot = useMemo(
    () =>
      locationsForSelectedTime.find(
        (slot) => String(slot.locationId) === String(selectedLocationId)
      ) || null,
    [locationsForSelectedTime, selectedLocationId]
  );
  const selectedLocation = useMemo(
    () =>
      selectedSlot?.location ||
      locations.find((location) => String(location.id) === String(selectedLocationId)) ||
      null,
    [selectedSlot, locations, selectedLocationId]
  );

  const menuByCategory = useMemo(() => {
    const grouped = categories.map((category) => ({
      key: `category-${category.id}`,
      title: category.name,
      description: category.description,
      customerCanCustomize: category.customerCanCustomize,
      items: products.filter((product) => String(product.categoryId ?? "") === String(category.id)),
    }));

    const uncategorized = products.filter((product) => !product.categoryId);
    if (uncategorized.length > 0) {
      grouped.push({
        key: "category-uncategorized",
        title: tr("Autres produits", "Other products"),
        description: "",
        customerCanCustomize: false,
        items: uncategorized,
      });
    }

    if (grouped.length === 0 && products.length > 0) {
      grouped.push({
        key: "category-default",
        title: tr("Le menu", "Menu"),
        description: "",
        customerCanCustomize: false,
        items: products,
      });
    }

    return grouped
      .filter((entry) => entry.items.length > 0)
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const leftPriority = normalizeText(left.entry.title).includes("pizza") ? 0 : 1;
        const rightPriority = normalizeText(right.entry.title).includes("pizza") ? 0 : 1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;
        return left.index - right.index;
      })
      .map(({ entry }) => ({
        ...entry,
        isPizzaCategory: isPizzaCategoryLabel(entry.title),
        items: sortProductsByPrice(entry.items).map((product) => ({
          ...product,
          isCustomizable:
            typeof entry.customerCanCustomize === "boolean"
              ? entry.customerCanCustomize
              : isCustomizableProduct(product, entry.title),
        })),
      }));
  }, [categories, products, tr]);

  useEffect(() => {
    if (menuByCategory.length === 0) {
      setActiveCategoryKey("");
      return;
    }

    const stillExists = menuByCategory.some((entry) => entry.key === activeCategoryKey);
    if (!stillExists) {
      setActiveCategoryKey(menuByCategory[0].key);
    }
  }, [activeCategoryKey, menuByCategory]);

  const visibleMenuGroup = useMemo(
    () => menuByCategory.find((entry) => entry.key === activeCategoryKey) || menuByCategory[0] || null,
    [activeCategoryKey, menuByCategory]
  );
  const featuredProducts = useMemo(() => {
    const flattenedProducts = menuByCategory.flatMap((group) => group.items || []);
    const byId = new Map(flattenedProducts.map((product) => [Number(product.id), product]));
    return featuredIds.map((id) => byId.get(id)).filter(Boolean);
  }, [featuredIds, menuByCategory]);

  const openProductModal = (product) => {
    setEditingProduct(product);
    setSelectedExtras([]);
    setRemovedIngredients([]);
    setBaseAddedIngredients([]);
    setBaseRemovedIngredients([]);
    setQuantity(1);
  };

  const handleQuickAdd = async (product) => {
    if (!product?.id) return;

    try {
      setLoading(true);
      const response = await addToCart(token, product.id, 1, {
        addedIngredients: [],
        removedIngredients: [],
      });
      setCartFromResponse(response);
      setMessage(`${product.name} ${tr("ajoute au panier", "added to cart")}`);
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Impossible d'ajouter au panier", "Unable to add to cart"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!editingProduct) return;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage(tr("Quantite invalide", "Invalid quantity"));
      return;
    }

    try {
      setLoading(true);
      const response = await addToCart(token, editingProduct.id, quantity, {
        addedIngredients: dedupeIngredients([
          ...baseAddedIngredients,
          ...selectedExtras,
        ]).map((entry) => entry.id),
        removedIngredients: dedupeIngredients([
          ...baseRemovedIngredients,
          ...removedIngredients,
        ]).map((entry) => entry.id),
      });
      setCartFromResponse(response);
      setEditingProduct(null);
      setMessage(tr("Produit ajoute au panier", "Product added to cart"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Impossible d'ajouter au panier", "Unable to add to cart"));
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (cartItems.length === 0) {
      setMessage(tr("Votre panier est vide", "Your cart is empty"));
      return;
    }

    if (!isCartValidated) {
      setMessage(
        tr(
          "Validez d'abord le panier avant de choisir le retrait.",
          "Validate the cart before selecting pickup."
        )
      );
      return;
    }

    if (!selectedPickupTime) {
      setMessage(tr("Sélectionnez un horaire", "Select a pickup time"));
      return;
    }

    if (!selectedLocationId) {
      setMessage(tr("Sélectionnez une adresse de retrait", "Select a pickup address"));
      return;
    }

    if (!selectedSlot) {
      setMessage(tr("Sélection invalide", "Invalid pickup sélection"));
      return;
    }

    setIsFinalizeConfirmOpen(true);
  };

  const handleConfirmFinalize = async () => {
    if (!selectedPickupTime || !selectedLocationId || !selectedSlot) {
      setIsFinalizeConfirmOpen(false);
      setMessage(tr("Sélection invalide", "Invalid pickup sélection"));
      return;
    }

    const locationForSummary = selectedLocation;
    const pickupLocationName = getLocationDisplayName(locationForSummary, tr("Emplacement", "Location"));
    const pickupAddress = formatPickupAddress(locationForSummary, tr);
    const pickupTime = `${selectedDate}T${selectedPickupTime}:00`;
    const trimmedOrderNote = orderNote.trim();

    try {
      setIsFinalizeConfirmOpen(false);
      setLoading(true);
      const finalizedOrder = await finalizeOrder(token, {
        pickupDate: selectedDate,
        pickupTime: selectedPickupTime,
        locationId: Number(selectedLocationId),
        note: trimmedOrderNote || null,
        customerNote: trimmedOrderNote || null,
      });
      const orderId = finalizedOrder?.id ?? finalizedOrder?.order?.id ?? finalizedOrder?.orderId ?? null;
      await refreshCart();
      setAvailabilitySlots([]);
      setSelectedPickupTime("");
      setSelectedLocationId("");
      setOrderNote("");
      setMessage("");

      navigate("/order/confirmation", {
        state: {
          orderId,
          pickupTime,
          pickupLocationName,
          pickupAddress,
          orderNote: trimmedOrderNote,
        },
      });
    } catch (err) {
      setMessage(
        err?.response?.data?.error || err?.message || tr("Erreur lors de la finalisation", "Error while finalizing order")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isFinalizeConfirmOpen) return;
    const modalElement = finalizeModalRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusableElements = () => {
      if (!modalElement) return [];
      return Array.from(modalElement.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (element) => element instanceof HTMLElement && !element.hasAttribute("disabled")
      );
    };

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalElement?.focus();
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFinalizeConfirmOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        modalElement?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    };
  }, [isFinalizeConfirmOpen]);

  const handleValidateCart = () => {
    if (cartItems.length === 0) {
      setMessage(tr("Votre panier est vide", "Your cart is empty"));
      return;
    }

    setValidatedCartSignature(cartSignature);
    setMessage(
      tr(
        "Panier valide. Choisissez la date, l'horaire et l'adresse de retrait.",
        "Cart validated. Choose date, pickup time and location."
      )
    );
  };

  const handleRemoveCartItem = async (itemId) => {
    try {
      await removeItem(itemId);
      setMessage(tr("Article retiré du panier", "Item removed from cart"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Impossible de retirer l'article du panier", "Unable to remove the item from cart"));
    }
  };

  const handleClearCart = async () => {
    try {
      await clearCart();
      setValidatedCartSignature("");
      setSelectedPickupTime("");
      setSelectedLocationId("");
      setMessage(tr("Panier vide", "Cart cleared"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Impossible de vider le panier", "Unable to clear cart"));
    }
  };

  return (
    <div className="order-page section-shell overflow-x-hidden pb-16 pt-12 sm:pt-14">
      <SeoHead
        title={orderPageTitle}
        description={orderPageDescription}
        pathname="/order"
        jsonLd={buildBaseFoodEstablishmentJsonLd({
          pagePath: "/order",
          pageName: orderPageTitle,
          description: orderPageDescription,
          siteName,
        })}
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-saffron sm:text-sm sm:tracking-[0.25em]">{tr("Commande en ligne", "Online ordering")}</p>
          <h1 className="font-display text-3xl uppercase tracking-wide text-white sm:text-4xl">{tr("Composez votre commande", "Build your order")}</h1>
        </div>
        <div className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-stone-200 sm:w-auto">
          <p>{tr("Articles dans le panier", "Items in cart")}: <strong>{itemCount}</strong></p>
          <p>{tr("Total", "Total")}: <strong>{Number(cartTotal).toFixed(2)} EUR</strong></p>
        </div>
      </div>

      {message && (
        <div className="theme-light-keep-dark mb-6 rounded-xl border border-saffron/50 bg-saffron/10 px-4 py-3 text-sm text-saffron">
          {message}
        </div>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1.65fr_1fr] xl:gap-8">
        <section className="min-w-0 space-y-4">
          <h2 className="text-xl font-bold text-white">{tr("Nos produits", "Our products")}</h2>
          {featuredProducts.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-saffron">
                {tr("Suggestions", "Suggestions")}
              </h3>
              <FeaturedPizzaSuggestions
                products={featuredProducts}
                tr={tr}
                compact
                showAddButton
                getCanCustomize={(product) => Boolean(product?.isCustomizable)}
                onAddProduct={(product) =>
                  product?.isCustomizable ? openProductModal(product) : handleQuickAdd(product)
                }
              />
            </section>
          ) : null}
          {menuByCategory.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-stone-300">
              {tr("Aucun produit disponible pour le moment.", "No products available right now.")}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {menuByCategory.map((group) => {
                  const isActive = group.key === visibleMenuGroup?.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setActiveCategoryKey(group.key)}
                      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                        isActive
                          ? "border-saffron bg-saffron text-charcoal"
                          : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                      }`}
                    >
                      {group.title}
                    </button>
                  );
                })}
              </div>

              {visibleMenuGroup && (
                <article className="overflow-hidden rounded-3xl border border-white/10 bg-charcoal/35 p-3 sm:p-7">
                  <div className="mb-4 border-b border-white/10 pb-3">
                    <h3 className="font-display text-2xl uppercase tracking-[0.08em] text-crust sm:text-4xl">
                      {visibleMenuGroup.title}
                    </h3>
                    {visibleMenuGroup.description && <p className="mt-1 text-sm text-stone-400">{visibleMenuGroup.description}</p>}
                  </div>

                  <div>
                    {visibleMenuGroup.items.map((product) => {
                      const ingredientSummary = buildIngredientSummaryParts(product, tr);
                      const productImageUrl = String(product?.thumbnailUrl || product?.imageUrl || "").trim();
                      return (
                      <div key={product.id} className="border-b border-white/10 py-3 last:border-b-0 sm:py-4">
                        <div className={`flex items-start ${showMenuProductImages ? "gap-3 sm:gap-4" : ""}`}>
                          {showMenuProductImages ? (
                            <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 sm:h-24 sm:w-24">
                              {productImageUrl ? (
                                <img
                                  src={productImageUrl}
                                  alt={product?.imageAlt || product?.name || tr("Photo produit", "Product photo")}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[9px] uppercase tracking-[0.1em] text-stone-400">
                                  {tr("PHOTO A VENIR", "PHOTO COMING SOON")}
                                </div>
                              )}
                            </div>
                          ) : null}

                          <div className="min-w-0 flex-1">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:items-start sm:gap-3">
                              <h4 className="min-w-0 break-words text-[13px] font-semibold uppercase tracking-wide text-white sm:flex-1 sm:text-[17px]">
                                {product.name}
                              </h4>
                              <div className="mt-2 hidden h-px flex-1 border-t border-dashed border-stone-500/70 sm:block" />
                              <div className="flex shrink-0 items-center justify-end gap-2 sm:contents">
                                <span className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wide text-saffron sm:text-base">
                                  {formatPrice(product.basePrice)} EUR
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    product.isCustomizable ? openProductModal(product) : handleQuickAdd(product)
                                  }
                                  disabled={loading}
                                  title={
                                    product.isCustomizable
                                      ? tr("Configurer et ajouter", "Customize and add")
                                      : tr("Ajouter au panier", "Add to cart")
                                  }
                                  aria-label={
                                    product.isCustomizable
                                      ? `${tr("Configurer", "Customize")} ${product.name}`
                                      : `${tr("Ajouter", "Add")} ${product.name}`
                                  }
                                  className="relative -top-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center text-[18px] font-bold leading-none text-saffron transition hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {product.description && <p className="mt-1 text-sm text-stone-300">{product.description}</p>}

                            {ingredientSummary && (
                              <p className="mt-0.5 break-words text-[8.5px] uppercase leading-relaxed tracking-[0.08em] text-stone-400 sm:text-[11px] sm:tracking-[0.13em]">
                                {ingredientSummary.classicText ? (
                                  <span>{ingredientSummary.classicText}</span>
                                ) : null}
                                {ingredientSummary.classicText && ingredientSummary.afterText ? (
                                  <span> / </span>
                                ) : null}
                                {ingredientSummary.afterText ? (
                                  <span className="text-saffron italic">
                                    {ingredientSummary.afterText}
                                  </span>
                                ) : null}
                                {(ingredientSummary.classicText || ingredientSummary.afterText) &&
                                ingredientSummary.recommendedText ? (
                                  <span> </span>
                                ) : null}
                                {ingredientSummary.recommendedText ? (
                                  <span className="text-emerald-300 italic">
                                    {ingredientSummary.recommendedText}
                                  </span>
                                ) : null}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </article>
              )}
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="text-xl font-bold text-white">{tr("Mon panier", "My cart")}</h2>
              {isCartValidated && (
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                  {tr("Panier valide", "Cart confirmed")}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {cartLoading && <p className="text-sm text-stone-300">{tr("Chargement du panier...", "Loading cart...")}</p>}
              {!cartLoading && cartItems.length === 0 && (
                <p className="order-cart-item rounded-xl px-3 py-2 text-sm text-stone-300">
                  {tr("Votre panier est vide.", "Your cart is empty.")}
                </p>
              )}

              {cartItems.map((item) => {
                const itemUnitPrice = Number(item.unitPrice ?? getCartItemProduct(item)?.basePrice ?? 0);
                const itemTotal = itemUnitPrice * Number(item.quantity || 0);
                return (
                  <div key={item.id} className="order-cart-item rounded-xl p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-white">{getCartItemName(item)}</p>
                          <p className="text-xs text-stone-300">{tr("Quantite", "Quantity")}: {item.quantity}</p>
                        {item.addedIngredients?.length > 0 && (
                          <p className="break-words text-[11px] text-emerald-300">
                            + {item.addedIngredients.map((entry) => getCartIngredientName(entry)).filter(Boolean).join(", ")}
                          </p>
                        )}
                        {item.removedIngredients?.length > 0 && (
                          <p className="break-words text-[11px] text-red-300">
                            - {item.removedIngredients.map((entry) => getCartIngredientName(entry)).filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                        <p className="text-xs font-bold text-saffron">{formatPrice(itemTotal)} EUR</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(item.id)}
                          className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold text-stone-100 transition hover:bg-white/10 sm:mt-1"
                        >
                          {tr("Retirer", "Remove")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-sm text-stone-200">
                {tr("Total panier", "Cart total")}: <strong>{Number(cartTotal).toFixed(2)} EUR</strong>
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleValidateCart}
                  disabled={cartItems.length === 0}
                  className="flex-1 rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tr("Valider le panier", "Confirm cart")}
                </button>
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cartItems.length === 0}
                  className="rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tr("Vider", "Clear")}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <h2 className="mb-1 text-xl font-bold text-white">{tr("Retrait de la commande", "Pickup details")}</h2>
            <p className="mb-4 text-sm text-stone-300">
              {pickupIntroText}
            </p>
            <p className="mb-3 text-xs text-stone-300">
              {tr("Flux temps réel", "Live updates")}:{" "}
              <strong className={realtimeConnected ? "text-emerald-300" : "text-amber-300"}>
                {realtimeConnected ? tr("connecté", "connected") : tr("reconnexion...", "reconnecting...")}
              </strong>
            </p>

            {!isCartValidated && (
              <div className="theme-light-keep-dark mb-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {tr(
                  "Validez d'abord le panier pour débloquer la sélection du retrait.",
                  "Validate the cart first to unlock pickup sélection."
                )}
              </div>
            )}

            <fieldset disabled={!isCartValidated || loading || cartItems.length === 0} className="space-y-3 disabled:opacity-60">
              <div className="space-y-2">
                <p className="text-sm text-stone-300">{tr("Date de retrait", "Pickup date")}</p>
                <div className="mt-1 flex w-full items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canGoPreviousDate) return;
                      setSelectedDate((prev) => shiftIsoDate(prev, -1));
                    }}
                    disabled={!canGoPreviousDate}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/5 text-stone-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                    aria-label={tr("Jour precedent", "Previous day")}
                  >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="m14 6-6 6 6 6" />
                    </svg>
                  </button>

                  <span className="min-w-0 flex-1 break-words rounded-xl border border-white/20 bg-white/5 px-2 py-2 text-center text-[11px] font-semibold text-stone-100 sm:px-3 sm:text-sm">
                    {formatNavigatorDate(selectedDate, locale)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedDate((prev) => shiftIsoDate(prev, 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-white/5 text-stone-100 transition hover:bg-white/15 sm:h-9 sm:w-9"
                    aria-label={tr("Jour suivant", "Next day")}
                  >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="m10 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-stone-300">{tr("Horaire de retrait", "Pickup time")}</p>
                {timeOptions.length === 0 ? (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {tr("Aucun horaire disponible pour cette date et cette quantite.", "No pickup time available for this date and quantity.")}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {timeOptions.map((option) => {
                      const isSelected = selectedPickupTime === option.pickupTime;
                      return (
                        <button
                          key={option.pickupTime}
                          type="button"
                          onClick={() => {
                            setSelectedPickupTime(option.pickupTime);
                            setSelectedLocationId("");
                          }}
                          className={`max-w-full rounded-full border px-2 py-2 text-[10px] font-semibold transition sm:px-3 sm:text-xs ${
                            isSelected
                              ? "border-saffron bg-saffron/15 text-saffron"
                              : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                          }`}
                        >
                          {option.pickupTime} - {option.remainingCapacity} {tr("places", "spots")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-stone-300">{tr("Adresse de retrait", "Pickup location")}</p>
                {!selectedPickupTime ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-stone-300">
                    {tr("Sélectionnez d'abord un horaire", "Select a pickup time first")}
                  </div>
                ) : locationsForSelectedTime.length === 0 ? (
                  <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {tr("Aucune adresse disponible pour cet horaire.", "No location available for this pickup time.")}
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {locationsForSelectedTime.map((slot) => {
                      const location = slot.location;
                      const isSelected = String(selectedLocationId) === String(slot.locationId);
                      return (
                        <button
                          key={`${slot.locationId}-${slot.pickupTime}`}
                          type="button"
                          onClick={() => setSelectedLocationId(String(slot.locationId))}
                          className={`min-w-0 rounded-xl border px-3 py-2 text-left transition ${
                            isSelected
                              ? "border-saffron bg-saffron/15 text-saffron"
                              : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                          }`}
                        >
                          <p className="text-sm font-semibold break-words">{getLocationDisplayName(location, "-")}</p>
                          <p className="text-[11px] text-stone-300 break-words sm:text-xs">{formatPickupAddress(location, tr)}</p>
                          <p className="mt-1 text-[11px] text-emerald-300">
                            {slot.remainingCapacity} {tr("places restantes", "spots left")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedLocation && (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-stone-300">
                  <strong className="text-stone-100">{getLocationDisplayName(selectedLocation, tr("Emplacement", "Location"))}</strong>
                  <span className="break-words">{" - "}{formatPickupAddress(selectedLocation, tr)}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="order-note" className="text-sm text-stone-300">
                  {tr("Note pour la commande (optionnel)", "Order note (optional)")}
                </label>
                <textarea
                  id="order-note"
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={tr(
                    "Ex: Allergie, demande de cuisson, precision utile...",
                    "e.g. Allergy, cooking request, helpful detail..."
                  )}
                  className="w-full rounded-xl border border-white/20 bg-charcoal/60 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-400 focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/25"
                />
                <p className="text-right text-[11px] text-stone-400">{orderNote.length}/300</p>
              </div>

              <button
                type="button"
                disabled={
                  loading ||
                  cartItems.length === 0 ||
                  !selectedPickupTime ||
                  !selectedLocationId ||
                  !selectedSlot
                }
                onClick={handleFinalize}
                className="mt-2 w-full rounded-full bg-saffron px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3 sm:text-sm"
              >
                {loading ? tr("Traitement...", "Processing...") : tr("Finaliser la commande", "Place order")}
              </button>
            </fieldset>
          </div>
        </section>
      </div>

      {isFinalizeConfirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-4">
          <div
            ref={finalizeModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="finalize-order-title"
            tabIndex={-1}
            className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-saffron/45 bg-charcoal/95 p-4 shadow-2xl sm:max-h-[min(92vh,720px)] sm:p-5"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-saffron">
              {tr("Vérification retrait", "Pickup confirmation")}
            </p>
            <h3 id="finalize-order-title" className="mt-2 text-xl font-bold text-white">
              {tr("Confirmez votre adresse de retrait", "Confirm your pickup location")}
            </h3>

            <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{tr("Emplacement", "Location")}</p>
                <p className="font-semibold text-white">
                  {getLocationDisplayName(selectedLocation, tr("Emplacement", "Location"))}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-stone-400">{tr("Adresse", "Address")}</p>
                <p className="text-stone-200">{formatPickupAddress(selectedLocation, tr)}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">{tr("Date", "Date")}</p>
                  <p className="text-stone-200">{formatNavigatorDate(selectedDate, locale)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">{tr("Horaire", "Time")}</p>
                  <p className="text-stone-200">{selectedPickupTime || "--:--"}</p>
                </div>
              </div>
              {orderNote.trim() && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">{tr("Note", "Note")}</p>
                  <p className="text-stone-200">{orderNote.trim()}</p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-amber-200">
              {pickupConfirmationText}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setIsFinalizeConfirmOpen(false)}
                disabled={loading}
                className="flex-1 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tr("Annuler", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={loading}
                className="flex-1 rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? tr("Traitement...", "Processing...") : tr("Confirmer", "Place order")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <ProductCustomizerModal
          product={editingProduct}
          ingredients={extras}
          selectedExtras={selectedExtras}
          removedIngredients={removedIngredients}
          baseAddedIngredients={baseAddedIngredients}
          baseRemovedIngredients={baseRemovedIngredients}
          quantity={quantity}
          onClose={() => setEditingProduct(null)}
          onExtrasChange={(ingredient, checked) => {
            setSelectedExtras((prev) => {
              const ingredientId = String(ingredient?.id || "").trim();
              if (!ingredientId) return prev;
              if (checked) {
                const alreadySelected = prev.some(
                  (entry) => String(entry?.id || "").trim() === ingredientId
                );
                return alreadySelected ? prev : [...prev, ingredient];
              }
              return prev.filter(
                (entry) => String(entry?.id || "").trim() !== ingredientId
              );
            });
          }}
          onRemovedChange={(ingredient, checked) => {
            setRemovedIngredients((prev) =>
              checked ? [...prev, ingredient] : prev.filter((entry) => entry.id !== ingredient.id)
            );
          }}
          onBaseChangesChange={({ added, removed }) => {
            setBaseAddedIngredients(dedupeIngredients(added));
            setBaseRemovedIngredients(dedupeIngredients(removed));
          }}
          onQuantityChange={setQuantity}
          onConfirm={handleAddToCart}
          onCancelCustomization={() => {
            setSelectedExtras([]);
            setRemovedIngredients([]);
            setBaseAddedIngredients([]);
            setBaseRemovedIngredients([]);
            setQuantity(1);
          }}
          tr={tr}
        />
      )}
    </div>
  );
}
