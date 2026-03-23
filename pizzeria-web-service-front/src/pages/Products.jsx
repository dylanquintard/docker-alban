import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  activateIngredient,
  createIngredient,
  createProduct,
  deleteIngredient,
  deleteProduct,
  getAllIngredients,
  getAllProducts,
  updateIngredient,
} from "../api/admin.api";
import { uploadGalleryImage } from "../api/gallery.api";
import {
  activateCategory,
  createCategory,
  getCategories,
  updateCategory,
} from "../api/category.api";
import {
  ActionIconButton,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  StatusToggle,
} from "../components/ui/AdminActions";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const KIND = {
  MENU: "PRODUCT",
  INGREDIENT: "INGREDIENT",
};

function toMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

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

function moveOpenedCategoryToTop(list, openedId) {
  if (!openedId) return list;

  const openedEntry = list.find((entry) => String(entry.id) === String(openedId));
  if (!openedEntry) return list;

  return [
    openedEntry,
    ...list.filter((entry) => String(entry.id) !== String(openedId)),
  ];
}

function parseSortOrder(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeIngredient(ingredient) {
  return {
    ...ingredient,
    isEditing: false,
    tempName: ingredient.name || "",
    tempPrice: ingredient.price ?? "",
    tempIsExtra: Boolean(ingredient.isExtra),
    tempIsBaseIngredient: Boolean(ingredient.isBaseIngredient),
    active: ingredient.active !== false,
  };
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

function CategoryTable({ title, categories, token, tr, onRefresh, onError, kind }) {
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const patchLocal = (id, patch) => {
    onRefresh((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  };

  const saveRow = async (category) => {
    setBusyId(category.id);
    try {
      await updateCategory(token, category.id, {
        name: String(category.name || "").trim(),
        description: category.description || null,
        sortOrder: parseSortOrder(category.sortOrder),
        active: Boolean(category.active),
        customerCanCustomize:
          kind === KIND.MENU ? Boolean(category.customerCanCustomize) : false,
        kind: category.kind,
      });
      await onRefresh();
      setEditingId(null);
    } catch (err) {
      onError?.(
        err?.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating")
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (category) => {
    try {
      await activateCategory(token, category.id, !category.active);
      await onRefresh();
    } catch (err) {
      onError?.(
        err?.response?.data?.error ||
          tr("Erreur lors du changement de statut", "Error while changing status")
      );
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
      <p className="mb-3 text-sm font-semibold text-white">{title}</p>

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-3 text-xs text-stone-400">
          {tr("Aucune catégorie", "No category")}
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => {
            const isEditing = editingId === category.id;
            return (
              <div
                key={category.id}
                className="grid gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {tr("Nom", "Name")}
                  </p>
                  {isEditing ? (
                    <input
                      value={category.name || ""}
                      onChange={(event) => patchLocal(category.id, { name: event.target.value })}
                    />
                  ) : (
                    <p className="truncate text-sm font-semibold text-white">{category.name}</p>
                  )}
                  {kind === KIND.MENU ? (
                    <>
                      <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                        {tr("Description", "Description")}
                      </p>
                      {isEditing ? (
                        <textarea
                          rows={2}
                          value={category.description || ""}
                          onChange={(event) =>
                            patchLocal(category.id, { description: event.target.value })
                          }
                        />
                      ) : (
                        <p className="text-xs text-stone-300">{category.description || "-"}</p>
                      )}
                    </>
                  ) : null}
                </div>

                {kind === KIND.MENU ? (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 rounded-full border border-white/15 bg-charcoal/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-200">
                      <input
                        type="checkbox"
                        checked={Boolean(category.customerCanCustomize)}
                        disabled={!isEditing}
                        onChange={(event) =>
                          patchLocal(category.id, {
                            customerCanCustomize: event.target.checked,
                          })
                        }
                      />
                      <span>{tr("Modifiable client", "Customer customizable")}</span>
                    </label>
                  </div>
                ) : null}

                <div className="flex items-end">
                  <StatusToggle
                    checked={Boolean(category.active)}
                    onChange={() => toggleActive(category)}
                    labelOn={tr("Masquer", "Hide")}
                    labelOff={tr("Afficher", "Show")}
                    disabled={busyId === category.id}
                  />
                </div>

                <div className="flex items-end justify-start lg:justify-end">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => saveRow(category)}
                        disabled={busyId === category.id}
                      >
                        {tr("Sauvegarder", "Save")}
                      </button>
                    ) : (
                      <ActionIconButton
                        onClick={() => setEditingId(category.id)}
                        label={tr("Modifier", "Edit")}
                      >
                        <EditIcon />
                      </ActionIconButton>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Products() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();
  const navigate = useNavigate();

  const [menuCategories, setMenuCategories] = useState([]);
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  const [activePanel, setActivePanel] = useState("");
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState("");
  const [selectedIngredientCategoryId, setSelectedIngredientCategoryId] = useState("");
  const [openMenuListingCategoryId, setOpenMenuListingCategoryId] = useState("");
  const [openIngredientListingCategoryId, setOpenIngredientListingCategoryId] = useState("");
  const [showMenuCategoryManager, setShowMenuCategoryManager] = useState(false);
  const [showIngredientCategoryManager, setShowIngredientCategoryManager] = useState(false);

  const [newMenuCategoryName, setNewMenuCategoryName] = useState("");
  const [newMenuCategoryDescription, setNewMenuCategoryDescription] = useState("");
  const [newIngredientCategoryName, setNewIngredientCategoryName] = useState("");

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductImageFile, setNewProductImageFile] = useState(null);

  const [newIngredientName, setNewIngredientName] = useState("");
  const [newIngredientPrice, setNewIngredientPrice] = useState("");
  const [newIngredientIsExtra, setNewIngredientIsExtra] = useState(true);
  const [newIngredientIsBaseIngredient, setNewIngredientIsBaseIngredient] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    const [menuCats, ingCats, productsData, ingredientsData] = await Promise.all([
      getCategories({ kind: KIND.MENU }),
      getCategories({ kind: KIND.INGREDIENT }),
      getAllProducts(token),
      getAllIngredients(token),
    ]);

    const nextMenuCats = sortCategories(menuCats);
    const nextIngCats = sortCategories(ingCats);

    setMenuCategories(nextMenuCats);
    setIngredientCategories(nextIngCats);
    setProducts(sortByName(productsData));
    setIngredients(sortByName(ingredientsData).map(normalizeIngredient));

    setSelectedMenuCategoryId((prev) => {
      const exists = nextMenuCats.some((entry) => String(entry.id) === String(prev));
      return exists ? prev : "";
    });
    setSelectedIngredientCategoryId((prev) => {
      const exists = nextIngCats.some((entry) => String(entry.id) === String(prev));
      return exists ? prev : "";
    });
  }, [token]);

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN") return;

    setLoading(true);
    fetchAll()
      .then(() => setMessage(""))
      .catch((err) => {
        setMessage(
          err.response?.data?.error ||
            tr("Erreur lors du chargement des données du menu", "Error while loading menu data")
        );
      })
      .finally(() => setLoading(false));
  }, [authLoading, token, user, fetchAll, tr]);

  const refreshAfterAction = async (successMessage = "") => {
    await fetchAll();
    setMessage(successMessage);
  };

  const createCategoryByKind = async (kind) => {
    const name =
      kind === KIND.MENU
        ? String(newMenuCategoryName || "").trim()
        : String(newIngredientCategoryName || "").trim();
    const description =
      kind === KIND.MENU ? String(newMenuCategoryDescription || "").trim() : "";

    if (!name) {
      setMessage(tr("Le nom de catégorie est obligatoire", "Category name is required"));
      return;
    }

    try {
      await createCategory(token, {
        name,
        description: description || null,
        sortOrder: 0,
        active: true,
        customerCanCustomize: false,
        kind,
      });
      if (kind === KIND.MENU) {
        setNewMenuCategoryName("");
        setNewMenuCategoryDescription("");
      }
      if (kind === KIND.INGREDIENT) {
        setNewIngredientCategoryName("");
      }
      await refreshAfterAction(tr("Catégorie creee avec succes", "Category created successfully"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la creation", "Error while creating"));
    }
  };

  const createMenuProduct = async () => {
    const name = String(newProductName || "").trim();
    if (!name) {
      setMessage(tr("Le nom du plat est obligatoire", "Dish name is required"));
      return;
    }
    if (!newProductPrice) {
      setMessage(tr("Le prix est obligatoire", "Price is required"));
      return;
    }
    if (!selectedMenuCategoryId) {
      setMessage(tr("Sélectionnez une catégorie menu", "Select a menu category"));
      return;
    }

    try {
      let uploadedImage = null;
      if (newProductImageFile) {
        uploadedImage = await uploadGalleryImage(token, newProductImageFile);
      }

      const created = await createProduct(token, {
        name,
        description: "",
        basePrice: Number(newProductPrice),
        categoryId: Number(selectedMenuCategoryId),
        imageUrl: uploadedImage?.imageUrl || null,
        thumbnailUrl: uploadedImage?.thumbnailUrl || null,
        imageAlt: name || null,
      });
      setNewProductName("");
      setNewProductPrice("");
      setNewProductImageFile(null);
      setMessage(tr("Plat ajoute au menu", "Dish added to menu"));
      navigate(`/admin/editproduct/${created.id}`);
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la creation", "Error while creating"));
    }
  };

  const removeMenuProduct = async (productId) => {
    if (!window.confirm(tr("Supprimer ce plat ?", "Delete this dish?"))) return;
    try {
      await deleteProduct(token, productId);
      await refreshAfterAction(tr("Plat supprime", "Dish deleted"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la suppression", "Error while deleting"));
    }
  };

  const createMenuIngredient = async () => {
    const name = String(newIngredientName || "").trim();
    if (!name) {
      setMessage(tr("Le nom de l'ingrédient est obligatoire", "Ingredient name is required"));
      return;
    }
    if (!newIngredientPrice) {
      setMessage(tr("Le prix est obligatoire", "Price is required"));
      return;
    }
    if (!selectedIngredientCategoryId) {
      setMessage(
        tr("Sélectionnez une catégorie Ingrédients & Extras", "Select an Ingredients & Extras category")
      );
      return;
    }

    try {
      await createIngredient(token, {
        name,
        price: Number(newIngredientPrice),
        isExtra: Boolean(newIngredientIsExtra),
        isBaseIngredient: Boolean(newIngredientIsBaseIngredient),
        categoryId: Number(selectedIngredientCategoryId),
      });
      setNewIngredientName("");
      setNewIngredientPrice("");
      setNewIngredientIsExtra(true);
      setNewIngredientIsBaseIngredient(false);
      await refreshAfterAction(tr("Ingrédient ajoute avec succes", "Ingredient added successfully"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la creation", "Error while creating"));
    }
  };

  const patchIngredient = (ingredientId, patch) => {
    setIngredients((prev) =>
      prev.map((entry) => (entry.id === ingredientId ? { ...entry, ...patch } : entry))
    );
  };

  const toggleIngredientEdit = (ingredient) => {
    patchIngredient(ingredient.id, {
      isEditing: !ingredient.isEditing,
      tempName: ingredient.name || "",
      tempPrice: ingredient.price ?? "",
      tempIsExtra: Boolean(ingredient.isExtra),
      tempIsBaseIngredient: Boolean(ingredient.isBaseIngredient),
    });
  };

  const saveIngredient = async (ingredient) => {
    try {
      const updated = await updateIngredient(token, ingredient.id, {
        name: String(ingredient.tempName || "").trim(),
        price: Number(ingredient.tempPrice),
        isExtra: Boolean(ingredient.tempIsExtra),
        isBaseIngredient: Boolean(ingredient.tempIsBaseIngredient),
      });
      setIngredients((prev) =>
        prev.map((entry) => (entry.id === ingredient.id ? normalizeIngredient(updated) : entry))
      );
      setMessage(tr("Ingrédient mis à jour", "Ingredient updated"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating"));
    }
  };

  const toggleIngredientActive = async (ingredient) => {
    try {
      const updated = await activateIngredient(token, ingredient.id, !ingredient.active);
      setIngredients((prev) =>
        prev.map((entry) => (entry.id === ingredient.id ? normalizeIngredient(updated) : entry))
      );
      setMessage(
        updated.active
          ? tr("Ingrédient affiche", "Ingredient shown")
          : tr("Ingrédient masque", "Ingredient hidden")
      );
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors du changement de statut", "Error while changing status")
      );
    }
  };

  const removeIngredient = async (ingredientId) => {
    if (!window.confirm(tr("Supprimer cet ingrédient ?", "Delete this ingredient?"))) return;
    try {
      await deleteIngredient(token, ingredientId);
      await refreshAfterAction(tr("Ingrédient supprime", "Ingredient deleted"));
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la suppression", "Error while deleting"));
    }
  };

  const productsByCategory = useMemo(() => {
    const grouped = {};
    for (const category of menuCategories) {
      grouped[String(category.id)] = [];
    }
    grouped.uncategorized = [];

    for (const product of products) {
      const key = product.categoryId ? String(product.categoryId) : "uncategorized";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(product);
    }

    Object.keys(grouped).forEach((key) => {
      grouped[key] = sortByName(grouped[key]);
    });

    return grouped;
  }, [menuCategories, products]);

  const ingredientsByCategory = useMemo(() => {
    const grouped = {};
    for (const category of ingredientCategories) {
      grouped[String(category.id)] = [];
    }
    grouped.uncategorized = [];

    for (const ingredient of ingredients) {
      const key = ingredient.categoryId ? String(ingredient.categoryId) : "uncategorized";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ingredient);
    }

    Object.keys(grouped).forEach((key) => {
      grouped[key] = sortByName(grouped[key]);
    });

    return grouped;
  }, [ingredientCategories, ingredients]);

  const hasSelectedMenuCategory = Boolean(selectedMenuCategoryId);
  const hasSelectedIngredientCategory = Boolean(selectedIngredientCategoryId);
  const hasSelectedCategory =
    activePanel === KIND.MENU
      ? hasSelectedMenuCategory
      : activePanel === KIND.INGREDIENT
        ? hasSelectedIngredientCategory
        : false;

  const menuCategoryListForUi = useMemo(
    () => [...menuCategories, { id: "uncategorized", name: tr("Sans catégorie", "Uncategorized") }],
    [menuCategories, tr]
  );

  const ingredientCategoryListForUi = useMemo(
    () => [
      ...ingredientCategories,
      { id: "uncategorized", name: tr("Sans catégorie", "Uncategorized") },
    ],
    [ingredientCategories, tr]
  );

  const orderedMenuCategoryListForUi = useMemo(
    () => moveOpenedCategoryToTop(menuCategoryListForUi, openMenuListingCategoryId),
    [menuCategoryListForUi, openMenuListingCategoryId]
  );

  const orderedIngredientCategoryListForUi = useMemo(
    () => moveOpenedCategoryToTop(ingredientCategoryListForUi, openIngredientListingCategoryId),
    [ingredientCategoryListForUi, openIngredientListingCategoryId]
  );

  useEffect(() => {
    if (activePanel !== KIND.MENU || !selectedMenuCategoryId) return;

    setOpenMenuListingCategoryId(String(selectedMenuCategoryId));
  }, [activePanel, selectedMenuCategoryId]);

  useEffect(() => {
    if (activePanel !== KIND.INGREDIENT || !selectedIngredientCategoryId) return;

    setOpenIngredientListingCategoryId(String(selectedIngredientCategoryId));
  }, [activePanel, selectedIngredientCategoryId]);

  if (authLoading || loading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{tr("Gestion du menu", "Menu management")}</h2>
        <p className="mt-1 text-sm text-stone-300">
          {tr(
            "Bienvenue dans la page de gestion du menu, choisir une modification :",
            "Welcome to menu management, choose what to change:"
          )}
        </p>
      </div>

      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-100">
          {message}
        </p>
      )}

      <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="text-lg font-semibold text-white">{tr("Element 1 - Catégories", "Step 1 - Catégories")}</h3>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActivePanel((prev) => (prev === KIND.MENU ? "" : KIND.MENU))}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              activePanel === KIND.MENU
                ? "border-saffron bg-saffron text-charcoal"
                : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
            }`}
          >
            {tr("Ajouter un plat au menu", "Add a dish to menu")}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel((prev) => (prev === KIND.INGREDIENT ? "" : KIND.INGREDIENT))}
            className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              activePanel === KIND.INGREDIENT
                ? "border-saffron bg-saffron text-charcoal"
                : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
            }`}
          >
            {tr("Ajouter un ingrédient", "Add ingredient")}
          </button>
        </div>

        {activePanel === KIND.MENU && (
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-100">
              {tr("Listing categories menu :", "Menu category listing:")}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {menuCategories.map((category) => {
                const isSelected = String(selectedMenuCategoryId) === String(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedMenuCategoryId((prev) =>
                        String(prev) === String(category.id) ? "" : String(category.id)
                      )
                    }
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      isSelected
                        ? "border-saffron bg-saffron text-charcoal"
                        : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activePanel === KIND.INGREDIENT && (
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-100">
              {tr(
                "Listing categories Ingrédients & Extras :",
                "Ingredients & Extras category listing:"
              )}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ingredientCategories.map((category) => {
                const isSelected = String(selectedIngredientCategoryId) === String(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedIngredientCategoryId((prev) =>
                        String(prev) === String(category.id) ? "" : String(category.id)
                      )
                    }
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      isSelected
                        ? "border-saffron bg-saffron text-charcoal"
                        : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activePanel === KIND.MENU && (
          <>
            {!showMenuCategoryManager ? (
              <button
                type="button"
                onClick={() => setShowMenuCategoryManager(true)}
                className="rounded-full border border-saffron/70 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
              >
                {tr("AJOUTER UNE CATEGORIE >", "ADD A CATEGORY >")}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMenuCategoryManager(false)}
                    className="rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-100 transition hover:bg-white/10"
                  >
                    {tr("Fermer", "Close")}
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-white">
                    {tr("Catégorie non disponible ? Ajouter une catégorie :", "Missing category? Create one:")}
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <input
                        value={newMenuCategoryName}
                        onChange={(event) => setNewMenuCategoryName(event.target.value)}
                        placeholder={tr("Nom catégorie menu", "Menu category name")}
                      />
                      <textarea
                        rows={2}
                        value={newMenuCategoryDescription}
                        onChange={(event) => setNewMenuCategoryDescription(event.target.value)}
                        placeholder={tr("Description catégorie menu", "Menu category description")}
                      />
                    </div>
                    <button type="button" onClick={() => createCategoryByKind(KIND.MENU)}>
                      {tr("Créer", "Create")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {tr("Liste catégories plats", "Dish category list")}
                  </p>
                  <CategoryTable
                    title={tr("Liste catégorie menu", "Menu category list")}
                    categories={menuCategories}
                    kind={KIND.MENU}
                    token={token}
                    tr={tr}
                    onRefresh={async (updater) => {
                      if (typeof updater === "function") {
                        setMenuCategories((prev) => updater(prev));
                        return;
                      }
                      await refreshAfterAction();
                    }}
                    onError={setMessage}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {activePanel === KIND.INGREDIENT && (
          <>
            {!showIngredientCategoryManager ? (
              <button
                type="button"
                onClick={() => setShowIngredientCategoryManager(true)}
                className="rounded-full border border-saffron/70 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
              >
                {tr("AJOUTER UNE CATEGORIE >", "ADD A CATEGORY >")}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowIngredientCategoryManager(false)}
                    className="rounded-full border border-white/20 bg-black/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-100 transition hover:bg-white/10"
                  >
                    {tr("Fermer", "Close")}
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-white">
                    {tr(
                      "Catégorie Ingrédients & Extras non disponible ? Ajouter une catégorie :",
                      "Missing Ingredients & Extras category? Create one:"
                    )}
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-2">
                      <input
                        value={newIngredientCategoryName}
                        onChange={(event) => setNewIngredientCategoryName(event.target.value)}
                        placeholder={tr("Nom catégorie ingrédients", "Ingredient category name")}
                      />
                    </div>
                    <button type="button" onClick={() => createCategoryByKind(KIND.INGREDIENT)}>
                      {tr("Créer", "Create")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {tr("Liste catégories ingrédients", "Ingredient category list")}
                  </p>
                  <CategoryTable
                    title={tr("Liste catégorie ingrédients", "Ingredients category list")}
                    categories={ingredientCategories}
                    kind={KIND.INGREDIENT}
                    token={token}
                    tr={tr}
                    onRefresh={async (updater) => {
                      if (typeof updater === "function") {
                        setIngredientCategories((prev) => updater(prev));
                        return;
                      }
                      await refreshAfterAction();
                    }}
                    onError={setMessage}
                  />
                </div>
              </div>
            )}
          </>
        )}

      </section>

      {hasSelectedCategory && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="text-lg font-semibold text-white">
            {activePanel === KIND.MENU
              ? tr("Element 2 - Gestion du contenu", "Step 2 - Content management")
              : tr("Gestion ingrédients", "Ingredient management")}
          </h3>

          {activePanel === KIND.MENU ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
                <p className="mb-2 text-sm font-semibold text-white">{tr("Ajouter un plat au menu", "Add a dish to menu")}</p>
                <div className="grid gap-2 sm:grid-cols-4">
                  <input
                    placeholder={tr("Nom du plat", "Dish name")}
                    value={newProductName}
                    onChange={(event) => setNewProductName(event.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={tr("Prix", "Price")}
                    value={newProductPrice}
                    onChange={(event) => setNewProductPrice(event.target.value)}
                  />
                  <label className="flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-stone-100">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => setNewProductImageFile(event.target.files?.[0] || null)}
                    />
                    {newProductImageFile
                      ? tr("Photo selectionnee", "Photo selected")
                      : tr("Ajouter une photo", "Add photo")}
                  </label>
                  <button type="button" onClick={createMenuProduct}>{tr("Ajouter au menu", "Add to menu")}</button>
                </div>
                {newProductImageFile ? (
                  <p className="mt-2 text-xs text-stone-300">{newProductImageFile.name}</p>
                ) : null}
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-white">{tr("Listing complet du menu", "Full menu listing")}</p>
                {orderedMenuCategoryListForUi.map((category) => {
                  const rows = productsByCategory[String(category.id)] || [];
                  const isOpen = String(openMenuListingCategoryId) === String(category.id);
                  return (
                    <div
                      key={category.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal/35"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuListingCategoryId((prev) =>
                            String(prev) === String(category.id) ? "" : String(category.id)
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 bg-charcoal/35 px-4 py-3 text-left transition hover:bg-charcoal/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold uppercase tracking-wide text-saffron">{category.name}</p>
                          <p className="mt-1 text-xs text-stone-400">
                            {rows.length > 0
                              ? `${rows.length} ${tr("plat(s)", "dish(es)")}`
                              : tr("Aucun produit", "No product")}
                          </p>
                        </div>
                        <span className="shrink-0 text-stone-300">
                          <AccordionChevron open={isOpen} />
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-white/10 bg-black/10 p-3">
                          {rows.length === 0 ? (
                            <p className="text-xs text-stone-400">{tr("Aucun produit", "No product")}</p>
                          ) : (
                            <div className="space-y-2">
                              {rows.map((product) => (
                                <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-white">{product.name}</p>
                                    <p className="text-xs text-stone-300">{toMoney(product.basePrice)} EUR</p>
                                    <p className="text-[11px] text-stone-400">
                                      {product?.imageUrl
                                        ? tr("Photo liee", "Photo linked")
                                        : tr("Sans photo", "No photo")}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Link to={`/admin/editproduct/${product.id}`}>
                                      <button type="button">{tr("Modifier", "Edit")}</button>
                                    </Link>
                                    <ActionIconButton onClick={() => removeMenuProduct(product.id)} label={tr("Supprimer", "Delete")} variant="danger">
                                      <DeleteIcon />
                                    </ActionIconButton>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-charcoal/40 p-3">
                <p className="mb-2 text-sm font-semibold text-white">{tr("Ajouter un ingrédient", "Add ingredient")}</p>
                <div className="grid gap-2 sm:grid-cols-5">
                  <input
                    placeholder={tr("Nom ingrédient", "Ingredient name")}
                    value={newIngredientName}
                    onChange={(event) => setNewIngredientName(event.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={tr("Prix", "Price")}
                    value={newIngredientPrice}
                    onChange={(event) => setNewIngredientPrice(event.target.value)}
                  />
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-stone-100">
                    <input
                      type="checkbox"
                      checked={newIngredientIsExtra}
                      onChange={(event) => setNewIngredientIsExtra(event.target.checked)}
                    />
                    <span>{tr("Supplement", "Extra")}</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-stone-100">
                    <input
                      type="checkbox"
                      checked={newIngredientIsBaseIngredient}
                      onChange={(event) => setNewIngredientIsBaseIngredient(event.target.checked)}
                    />
                    <span>{tr("Base pizza", "Pizza base")}</span>
                  </label>
                  <button type="button" onClick={createMenuIngredient}>{tr("Ajouter un ingrédient", "Add ingredient")}</button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-white">{tr("Listing complet ingrédients", "Full ingredients listing")}</p>
                {orderedIngredientCategoryListForUi.map((category) => {
                  const rows = ingredientsByCategory[String(category.id)] || [];
                  const isOpen = String(openIngredientListingCategoryId) === String(category.id);
                  return (
                    <div
                      key={category.id}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal/35"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenIngredientListingCategoryId((prev) =>
                            String(prev) === String(category.id) ? "" : String(category.id)
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 bg-charcoal/35 px-4 py-3 text-left transition hover:bg-charcoal/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold uppercase tracking-wide text-saffron">{category.name}</p>
                          <p className="mt-1 text-xs text-stone-400">
                            {rows.length > 0
                              ? `${rows.length} ${tr("ingrédient(s)", "ingredient(s)")}`
                              : tr("Aucun ingrédient", "No ingredient")}
                          </p>
                        </div>
                        <span className="shrink-0 text-stone-300">
                          <AccordionChevron open={isOpen} />
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-white/10 bg-black/10 p-3">
                          {rows.length === 0 ? (
                            <p className="text-xs text-stone-400">{tr("Aucun ingrédient", "No ingredient")}</p>
                          ) : (
                            <div className="space-y-2">
                              {rows.map((ingredient) => (
                                <div key={ingredient.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                  <div className="min-w-0">
                                    {ingredient.isEditing ? (
                                      <div className="grid gap-2 sm:grid-cols-4">
                                        <input
                                          value={ingredient.tempName}
                                          onChange={(event) => patchIngredient(ingredient.id, { tempName: event.target.value })}
                                        />
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={ingredient.tempPrice}
                                          onChange={(event) => patchIngredient(ingredient.id, { tempPrice: event.target.value })}
                                        />
                                        <label className="flex items-center gap-2 text-xs text-stone-200">
                                          <input
                                            type="checkbox"
                                            checked={ingredient.tempIsExtra}
                                            onChange={(event) => patchIngredient(ingredient.id, { tempIsExtra: event.target.checked })}
                                          />
                                          <span>{tr("Supplement", "Extra")}</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-stone-200">
                                          <input
                                            type="checkbox"
                                            checked={ingredient.tempIsBaseIngredient}
                                            onChange={(event) =>
                                              patchIngredient(ingredient.id, {
                                                tempIsBaseIngredient: event.target.checked,
                                              })
                                            }
                                          />
                                          <span>{tr("Base pizza", "Pizza base")}</span>
                                        </label>
                                      </div>
                                    ) : (
                                      <div>
                                        <p className="truncate text-sm font-semibold text-white">{ingredient.name}</p>
                                        <p className="text-xs text-stone-300">
                                          {toMoney(ingredient.price)} EUR - {ingredient.isExtra ? tr("Supplement", "Extra") : tr("Standard", "Standard")}
                                          {ingredient.isBaseIngredient
                                            ? ` - ${tr("Base pizza", "Pizza base")}`
                                            : ""}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <StatusToggle
                                      checked={Boolean(ingredient.active)}
                                      onChange={() => toggleIngredientActive(ingredient)}
                                      labelOn={tr("Masquer", "Hide")}
                                      labelOff={tr("Afficher", "Show")}
                                    />
                                    {ingredient.isEditing ? (
                                      <ActionIconButton onClick={() => saveIngredient(ingredient)} label={tr("Valider", "Validate")} variant="success">
                                        <CheckIcon />
                                      </ActionIconButton>
                                    ) : (
                                      <ActionIconButton onClick={() => toggleIngredientEdit(ingredient)} label={tr("Modifier", "Edit")}>
                                        <EditIcon />
                                      </ActionIconButton>
                                    )}

                                    {ingredient.isEditing && (
                                      <button type="button" onClick={() => toggleIngredientEdit(ingredient)}>
                                        {tr("Annuler", "Cancel")}
                                      </button>
                                    )}

                                    <ActionIconButton onClick={() => removeIngredient(ingredient.id)} label={tr("Supprimer", "Delete")} variant="danger">
                                      <DeleteIcon />
                                    </ActionIconButton>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
