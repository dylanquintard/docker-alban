import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addIngredientToProduct,
  getAllIngredients,
  getProductById,
  removeIngredientFromProduct,
  updateIngredientLinkOnProduct,
  updateProduct,
} from "../api/admin.api";
import { uploadGalleryImage } from "../api/gallery.api";
import { getCategories } from "../api/category.api";
import { ActionIconButton, CheckIcon, DeleteIcon, EditIcon } from "../components/ui/AdminActions";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

function sortCategories(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const orderDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function sortByName(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
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

export default function EditProduct() {
  const { id } = useParams();
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [product, setProduct] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState("");
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [openAvailableCategoryKey, setOpenAvailableCategoryKey] = useState("");
  const linkedIngredientsSectionRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  const fetchData = useCallback(async () => {
    const [productData, ingredientsData, categoriesData] = await Promise.all([
      getProductById(token, id),
      getAllIngredients(token),
      getCategories({ kind: "INGREDIENT" }),
    ]);

    setProduct(productData);
    setIngredients(sortByName(ingredientsData));
    setIngredientCategories(sortCategories(categoriesData));
    setTempName(productData?.name || "");
    setTempPrice(productData?.basePrice ?? "");
  }, [id, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== "ADMIN") return;

    setLoading(true);
    fetchData()
      .then(() => setMessage(""))
      .catch((err) => {
        setMessage(err.response?.data?.error || tr("Erreur lors du chargement", "Error while loading"));
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, fetchData, tr]);

  const linkedIngredientEntries = useMemo(
    () => (product?.ingredients || []).filter((entry) => entry?.ingredient),
    [product]
  );

  const linkedIngredientEntryByIngredientId = useMemo(
    () =>
      new Map(
        linkedIngredientEntries.map((entry) => [Number(entry?.ingredient?.id), entry])
      ),
    [linkedIngredientEntries]
  );

  const recommendedSupplementEntries = useMemo(
    () =>
      linkedIngredientEntries.filter(
        (entry) => Boolean(entry?.isRecommended) && Boolean(entry?.ingredient?.isExtra)
      ),
    [linkedIngredientEntries]
  );

  const linkedBaseEntries = useMemo(
    () =>
      linkedIngredientEntries.filter(
        (entry) => !(Boolean(entry?.isRecommended) && Boolean(entry?.ingredient?.isExtra))
      ),
    [linkedIngredientEntries]
  );

  const availableIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        const linkedEntry = linkedIngredientEntryByIngredientId.get(Number(ingredient.id));
        if (!linkedEntry) return true;
        return Boolean(ingredient?.isExtra);
      }),
    [ingredients, linkedIngredientEntryByIngredientId]
  );

  const groupedAvailableByCategory = useMemo(() => {
    const groups = [];

    ingredientCategories.forEach((category) => {
      const rows = availableIngredients.filter(
        (ingredient) => Number(ingredient.categoryId) === Number(category.id)
      );
      groups.push({ key: String(category.id), name: category.name, rows });
    });

    const uncategorized = availableIngredients.filter((ingredient) => !ingredient.categoryId);
    groups.push({
      key: "uncategorized",
      name: tr("Sans catégorie", "Uncategorized"),
      rows: uncategorized,
    });

    return groups;
  }, [availableIngredients, ingredientCategories, tr]);

  const searchResults = useMemo(() => {
    const query = String(searchTerm || "").trim().toLowerCase();
    if (!searchSubmitted || !query) return [];
    return availableIngredients.filter((ingredient) =>
      String(ingredient.name || "").toLowerCase().includes(query)
    );
  }, [availableIngredients, searchSubmitted, searchTerm]);

  useEffect(() => {
    if (groupedAvailableByCategory.length === 0) {
      setOpenAvailableCategoryKey("");
      return;
    }

    if (!openAvailableCategoryKey) return;

    const stillExists = groupedAvailableByCategory.some(
      (group) => group.key === openAvailableCategoryKey
    );
    if (!stillExists) {
      setOpenAvailableCategoryKey(groupedAvailableByCategory[0].key);
    }
  }, [groupedAvailableByCategory, openAvailableCategoryKey]);

  const refreshProductOnly = async () => {
    const refreshed = await getProductById(token, id);
    setProduct(refreshed);
  };

  const saveProductName = async () => {
    const nextName = String(tempName || "").trim();
    if (!nextName) {
      setMessage(tr("Le nom du produit est obligatoire", "Product name is required"));
      return;
    }

    try {
      const updated = await updateProduct(token, id, { name: nextName });
      setProduct((prev) => ({ ...prev, name: updated.name }));
      setTempName(updated.name || "");
      setIsEditingName(false);
      setMessage(tr("Nom du produit mis à jour", "Product name updated"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating"));
    }
  };

  const saveProductPrice = async () => {
    if (tempPrice === "" || Number.isNaN(Number(tempPrice))) {
      setMessage(tr("Prix invalide", "Invalid price"));
      return;
    }

    try {
      const updated = await updateProduct(token, id, { basePrice: Number(tempPrice) });
      setProduct((prev) => ({ ...prev, basePrice: updated.basePrice }));
      setTempPrice(updated.basePrice ?? "");
      setIsEditingPrice(false);
      setMessage(tr("Prix du produit mis à jour", "Product price updated"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating"));
    }
  };

  const handleUploadProductImage = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    try {
      setUploadingProductImage(true);
      const uploaded = await uploadGalleryImage(token, file);
      const updated = await updateProduct(token, id, {
        imageUrl: uploaded?.imageUrl || null,
        thumbnailUrl: uploaded?.thumbnailUrl || null,
        imageAlt: String(product?.name || "").trim() || null,
      });
      setProduct((prev) => ({
        ...prev,
        imageUrl: updated?.imageUrl || uploaded?.imageUrl || null,
        thumbnailUrl: updated?.thumbnailUrl || uploaded?.thumbnailUrl || null,
        imageAlt: updated?.imageAlt || String(prev?.name || "").trim() || null,
      }));
      setMessage(tr("Photo produit mise a jour", "Product photo updated"));
    } catch (err) {
      setMessage(
        err.response?.data?.error || tr("Erreur lors de l'upload photo", "Error while uploading photo")
      );
    } finally {
      setUploadingProductImage(false);
    }
  };

  const handleRemoveProductImage = async () => {
    try {
      setUploadingProductImage(true);
      const updated = await updateProduct(token, id, {
        imageUrl: null,
        thumbnailUrl: null,
        imageAlt: null,
      });
      setProduct((prev) => ({
        ...prev,
        imageUrl: updated?.imageUrl || null,
        thumbnailUrl: updated?.thumbnailUrl || null,
        imageAlt: updated?.imageAlt || null,
      }));
      setMessage(tr("Photo produit retiree", "Product photo removed"));
    } catch (err) {
      setMessage(
        err.response?.data?.error || tr("Erreur lors de la suppression photo", "Error while removing photo")
      );
    } finally {
      setUploadingProductImage(false);
    }
  };

  const handleAddIngredient = async (ingredientId, options = {}) => {
    try {
      const isRecommended = Boolean(options?.isRecommended);
      await addIngredientToProduct(token, id, ingredientId, { isRecommended });
      await refreshProductOnly();
      setMessage(
        isRecommended
          ? tr("Ingrédient recommande ajoute", "Recommended ingredient added")
          : tr("Ingrédient lie au plat", "Ingredient linked to dish")
      );
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de l'ajout", "Error while adding"));
    }
  };

  const handleRemoveIngredient = async (ingredientId) => {
    try {
      await removeIngredientFromProduct(token, id, ingredientId);
      await refreshProductOnly();
      setMessage(tr("Liaison ingrédient supprimée", "Ingredient link removed"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la suppression", "Error while deleting"));
    }
  };

  const handleToggleAfterCookingIngredient = async (ingredientId, isAfterCooking) => {
    try {
      const existingLink = linkedIngredientEntries.find(
        (entry) => Number(entry?.ingredient?.id) === Number(ingredientId)
      );
      await updateIngredientLinkOnProduct(token, id, ingredientId, {
        isBase: Boolean(existingLink?.isBase),
        isAfterCooking,
        isRecommended: Boolean(existingLink?.isRecommended),
      });
      await refreshProductOnly();
      setMessage(
        isAfterCooking
          ? tr("Ingrédient marqué après cuisson", "Ingredient marked as after cooking")
          : tr("Ingrédient retiré après cuisson", "Ingredient removed from after cooking")
      );
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la mise à jour", "Error while updating")
      );
    }
  };

  const handleUnsetRecommendedSupplement = async (ingredientId) => {
    try {
      const existingLink = linkedIngredientEntries.find(
        (entry) => Number(entry?.ingredient?.id) === Number(ingredientId)
      );
      if (!existingLink) {
        setMessage(tr("Liaison introuvable", "Link not found"));
        return;
      }

      await updateIngredientLinkOnProduct(token, id, ingredientId, {
        isBase: Boolean(existingLink?.isBase),
        isAfterCooking: Boolean(existingLink?.isAfterCooking),
        isRecommended: false,
      });
      await refreshProductOnly();
      setMessage(
        tr(
          "Supplement retire des recommandations",
          "Supplement removed from recommendations"
        )
      );
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la mise à jour", "Error while updating")
      );
    }
  };

  const handleSetRecommendedSupplement = async (ingredientId) => {
    try {
      const existingLink = linkedIngredientEntries.find(
        (entry) => Number(entry?.ingredient?.id) === Number(ingredientId)
      );
      if (!existingLink) {
        await handleAddIngredient(ingredientId, { isRecommended: true });
        return;
      }

      await updateIngredientLinkOnProduct(token, id, ingredientId, {
        isBase: Boolean(existingLink?.isBase),
        isAfterCooking: Boolean(existingLink?.isAfterCooking),
        isRecommended: true,
      });
      await refreshProductOnly();
      setMessage(
        tr(
          "Supplement defini en recommandation",
          "Supplement set as recommendation"
        )
      );
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la mise Ã  jour", "Error while updating")
      );
    }
  };

  const handleSearch = () => {
    setSearchSubmitted(true);
  };

  if (authLoading || loading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!user || user.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }
  if (!product) return <p>{tr("Produit introuvable", "Product not found")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          {tr("Element 3 - Edition produit", "Step 3 - Product edition")}
        </h2>
        <p className="mt-1 text-sm text-stone-300">
          {tr(
            "Modifier le nom, le prix, la photo et les ingrédients lies au plat.",
            "Edit name, price, photo and linked ingredients."
          )}
        </p>
      </div>

      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-100">{message}</p>
      )}

      <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-charcoal/35 p-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-saffron">{tr("ProductName", "Product name")}</p>
            {isEditingName ? (
              <input value={tempName} onChange={(event) => setTempName(event.target.value)} />
            ) : (
              <p className="text-lg font-semibold text-white">{product.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <ActionIconButton onClick={saveProductName} label={tr("Valider", "Validate")} variant="success">
                <CheckIcon />
              </ActionIconButton>
            ) : (
              <ActionIconButton onClick={() => setIsEditingName(true)} label={tr("Modifier", "Edit")}>
                <EditIcon />
              </ActionIconButton>
            )}
            {isEditingName && (
              <button type="button" onClick={() => { setIsEditingName(false); setTempName(product.name || ""); }}>
                {tr("Annuler", "Cancel")}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-charcoal/35 p-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-saffron">{tr("Prix", "Price")}</p>
            {isEditingPrice ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={tempPrice}
                onChange={(event) => setTempPrice(event.target.value)}
              />
            ) : (
              <p className="text-lg font-semibold text-white">{formatPrice(product.basePrice)} EUR</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditingPrice ? (
              <ActionIconButton onClick={saveProductPrice} label={tr("Valider", "Validate")} variant="success">
                <CheckIcon />
              </ActionIconButton>
            ) : (
              <ActionIconButton onClick={() => setIsEditingPrice(true)} label={tr("Modifier", "Edit")}>
                <EditIcon />
              </ActionIconButton>
            )}
            {isEditingPrice && (
              <button type="button" onClick={() => { setIsEditingPrice(false); setTempPrice(product.basePrice ?? ""); }}>
                {tr("Annuler", "Cancel")}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-charcoal/35 p-3">
          <p className="text-xs uppercase tracking-wider text-saffron">{tr("Photo", "Photo")}</p>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
            {product?.imageUrl ? (
              <img
                src={product.thumbnailUrl || product.imageUrl}
                alt={product.imageAlt || product.name || tr("Photo produit", "Product photo")}
                className="h-48 w-full object-cover"
              />
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-stone-400">
                {tr("PHOTO A VENIR", "PHOTO COMING SOON")}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingProductImage}
                onChange={handleUploadProductImage}
              />
              <span className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                {uploadingProductImage
                  ? tr("Upload...", "Uploading...")
                  : tr("Uploader une photo", "Upload photo")}
              </span>
            </label>
            {product?.imageUrl ? (
              <button
                type="button"
                disabled={uploadingProductImage}
                onClick={handleRemoveProductImage}
                className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
              >
                {tr("Retirer la photo", "Remove photo")}
              </button>
            ) : null}
          </div>
        </div>

      </section>

      <section ref={linkedIngredientsSectionRef} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-lg font-semibold text-white">{tr("Ingrédients liés", "Linked ingredients")}</h3>
        {linkedBaseEntries.length === 0 ? (
          <p className="text-sm text-stone-400">{tr("Aucun ingrédient lie", "No linked ingredient")}</p>
        ) : (
          <div className="space-y-2">
            {linkedBaseEntries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-charcoal/35 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{entry.ingredient.name}</p>
                  <p className="text-xs text-stone-300">{formatPrice(entry.ingredient.price)} EUR</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-stone-200">
                    <input
                      type="checkbox"
                      checked={Boolean(entry.isAfterCooking)}
                      onChange={(event) =>
                        handleToggleAfterCookingIngredient(
                          entry.ingredient.id,
                          event.target.checked
                        )
                      }
                    />
                    <span>{tr("Après cuisson", "After cooking")}</span>
                  </label>
                  <ActionIconButton
                    onClick={() => handleRemoveIngredient(entry.ingredient.id)}
                    label={tr("Supprimer la liaison", "Remove link")}
                    variant="danger"
                  >
                    <DeleteIcon />
                  </ActionIconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
        <h3 className="text-lg font-semibold text-emerald-200">
          {tr("Suppléments recommandés", "Recommended supplements")}
        </h3>
        {recommendedSupplementEntries.length === 0 ? (
          <p className="text-sm text-emerald-100/80">
            {tr("Aucun supplément recommandé", "No recommended supplement")}
          </p>
        ) : (
          <div className="space-y-2">
            {recommendedSupplementEntries.map((entry) => (
              <div
                key={`recommended-${entry.id}`}
                className="flex items-center justify-between rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2"
              >
                <span className="text-xs font-semibold text-emerald-50">
                  {entry.ingredient.name}
                </span>
                <ActionIconButton
                  onClick={() => handleUnsetRecommendedSupplement(entry.ingredient.id)}
                  label={tr("Enlever recommandation", "Remove recommendation")}
                  variant="danger"
                >
                  <DeleteIcon />
                </ActionIconButton>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-lg font-semibold text-white">{tr("Lier un ingrédient au plat", "Link ingredient to dish")}</h3>

        <div className="rounded-xl border border-white/10 bg-charcoal/35 p-3">
          <p className="mb-2 text-sm font-semibold text-white">{tr("Recherche ingrédient", "Search ingredient")}</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setSearchSubmitted(false);
              }}
              placeholder={tr("Nom ingrédient", "Ingredient name")}
            />
            <button type="button" onClick={handleSearch}>{tr("Rechercher", "Search")}</button>
          </div>

          {searchSubmitted && String(searchTerm || "").trim() !== "" && (
            <div className="mt-3">
              {searchResults.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-stone-200">
                  <p>{tr("Ingrédients non disponibles ? Ajouter un ingrédient.", "Ingredients not available? Add one.")}</p>
                  <Link to="/admin/menu" className="mt-2 inline-flex">
                    <button type="button">{tr("Aller a la partie ingrédients", "Go to ingredients section")}</button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((ingredient) => {
                    const existingLink = linkedIngredientEntryByIngredientId.get(
                      Number(ingredient.id)
                    );
                    const isRecommended = Boolean(existingLink?.isRecommended);
                    const isRecommendedExtra =
                      isRecommended && Boolean(existingLink?.ingredient?.isExtra);

                    return (
                      <div key={ingredient.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{ingredient.name}</p>
                          <p className="text-xs text-stone-300">{formatPrice(ingredient.price)} EUR</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(existingLink)}
                            onClick={() => handleAddIngredient(ingredient.id)}
                          >
                            {tr("Lier au plat", "Link to dish")}
                          </button>
                          <button
                            type="button"
                            className={
                              isRecommendedExtra
                                ? "rounded-full border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.02em] text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20"
                                : "rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.02em] text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
                            }
                            onClick={() =>
                              isRecommendedExtra
                                ? handleUnsetRecommendedSupplement(ingredient.id)
                                : handleSetRecommendedSupplement(ingredient.id)
                            }
                          >
                            {isRecommendedExtra
                              ? tr("ENLEVER RECOMMANDATION", "REMOVE RECOMMENDATION")
                              : tr("Recommande", "Recommended")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{tr("Ingrédients disponibles (par catégories)", "Available ingredients (by categories)")}</p>
          {groupedAvailableByCategory.map((group) => (
            <div key={group.key} className="overflow-hidden rounded-xl border border-white/10 bg-charcoal/35">
              <button
                type="button"
                onClick={() =>
                  setOpenAvailableCategoryKey((prev) => {
                    if (prev === group.key) {
                      if (typeof window !== "undefined") {
                        window.requestAnimationFrame(() => {
                          linkedIngredientsSectionRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        });
                      }
                      return "";
                    }
                    return group.key;
                  })
                }
                className="flex w-full items-center justify-between gap-3 bg-charcoal/35 px-3 py-3 text-left transition hover:bg-charcoal/50"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-saffron">{group.name}</p>
                <span className="shrink-0 text-stone-300">
                  <AccordionChevron open={openAvailableCategoryKey === group.key} />
                </span>
              </button>

              {openAvailableCategoryKey === group.key && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  {group.rows.length === 0 ? (
                    <p className="text-xs text-stone-400">{tr("Aucun ingrédient", "No ingredient")}</p>
                  ) : (
                    group.rows.map((ingredient) => {
                      const existingLink = linkedIngredientEntryByIngredientId.get(
                        Number(ingredient.id)
                      );
                      const isRecommended = Boolean(existingLink?.isRecommended);
                      const isRecommendedExtra =
                        isRecommended && Boolean(existingLink?.ingredient?.isExtra);

                      return (
                        <div key={ingredient.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{ingredient.name}</p>
                            <p className="text-xs text-stone-300">{formatPrice(ingredient.price)} EUR</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={Boolean(existingLink)}
                              onClick={() => handleAddIngredient(ingredient.id)}
                            >
                              {tr("Lier au plat", "Link to dish")}
                            </button>
                            <button
                              type="button"
                              className={
                                isRecommendedExtra
                                  ? "rounded-full border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.02em] text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20"
                                  : "rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.02em] text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
                              }
                              onClick={() =>
                                isRecommendedExtra
                                  ? handleUnsetRecommendedSupplement(ingredient.id)
                                  : handleSetRecommendedSupplement(ingredient.id)
                              }
                            >
                              {isRecommendedExtra
                                ? tr("ENLEVER RECOMMANDATION", "REMOVE RECOMMENDATION")
                                : tr("Recommande", "Recommended")}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

