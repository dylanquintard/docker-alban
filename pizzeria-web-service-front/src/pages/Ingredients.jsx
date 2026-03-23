import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCategories } from "../api/category.api";
import {
  createIngredient,
  deleteIngredient,
  getAllIngredients,
  updateIngredient,
} from "../api/admin.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ActionIconButton, DeleteIcon, EditIcon } from "../components/ui/AdminActions";

const emptyNewIngredient = {
  name: "",
  price: "",
  isExtra: true,
};

function normalizeIngredientForList(ingredient) {
  return {
    ...ingredient,
    editPrice: false,
    tempPrice: ingredient.price,
  };
}

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric.toFixed(2);
}

export default function Ingredients() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [message, setMessage] = useState("");
  const [newIngredient, setNewIngredient] = useState(emptyNewIngredient);

  const fetchData = useCallback(async () => {
    try {
      const [ingredientsData, categoriesData] = await Promise.all([
        getAllIngredients(token),
        getCategories({ kind: "INGREDIENT" }),
      ]);
      setIngredients((Array.isArray(ingredientsData) ? ingredientsData : []).map(normalizeIngredientForList));
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors du chargement", "Error while loading"));
    }
  }, [token, tr]);

  useEffect(() => {
    if (authLoading || !user || !token) return;
    if (user.role !== "ADMIN") {
      setMessage(tr("Accès refusé : administrateur uniquement", "Access denied: admin only"));
      return;
    }

    fetchData();
  }, [authLoading, fetchData, token, user, tr]);

  const categoryTabs = useMemo(() => {
    const hasUncategorized = ingredients.some((entry) => !entry.categoryId);
    if (!hasUncategorized) return categories;
    return [
      ...categories,
      { id: "uncategorized", name: tr("Sans catégorie", "Uncategorized") },
    ];
  }, [categories, ingredients, tr]);

  useEffect(() => {
    if (categoryTabs.length === 0) {
      setActiveCategoryId("");
      return;
    }

    const exists = categoryTabs.some((entry) => String(entry.id) === String(activeCategoryId));
    if (!exists) {
      setActiveCategoryId(String(categoryTabs[0].id));
    }
  }, [activeCategoryId, categoryTabs]);

  const activeCategory = useMemo(
    () => categoryTabs.find((entry) => String(entry.id) === String(activeCategoryId)) || null,
    [activeCategoryId, categoryTabs]
  );

  const visibleIngredients = useMemo(() => {
    if (String(activeCategoryId) === "uncategorized") {
      return ingredients.filter((entry) => !entry.categoryId);
    }
    if (!activeCategoryId) return ingredients;
    return ingredients.filter((entry) => String(entry.categoryId ?? "") === String(activeCategoryId));
  }, [activeCategoryId, ingredients]);

  const updateIngredientState = (id, updater) => {
    setIngredients((prev) => prev.map((entry) => (entry.id === id ? updater(entry) : entry)));
  };

  const handleCreate = async () => {
    if (!newIngredient.name.trim()) {
      setMessage(tr("Le nom de l'ingrédient est obligatoire", "Ingredient name is required"));
      return;
    }
    if (!newIngredient.price) {
      setMessage(tr("Le prix est obligatoire", "Price is required"));
      return;
    }
    if (!activeCategoryId || String(activeCategoryId) === "uncategorized") {
      setMessage(tr("Sélectionnez d'abord une catégorie", "Select a category first"));
      return;
    }

    try {
      const created = await createIngredient(token, {
        name: newIngredient.name.trim(),
        price: Number(newIngredient.price),
        isExtra: Boolean(newIngredient.isExtra),
        categoryId: Number(activeCategoryId),
      });
      setIngredients((prev) => [...prev, normalizeIngredientForList(created)]);
      setNewIngredient(emptyNewIngredient);
      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la creation", "Error while creating"));
    }
  };

  const toggleEditPrice = (id) => {
    updateIngredientState(id, (entry) => ({ ...entry, editPrice: !entry.editPrice }));
  };

  const handleSave = async (entry) => {
    try {
      const updated = await updateIngredient(token, entry.id, {
        price: Number(entry.tempPrice),
      });
      updateIngredientState(entry.id, () => normalizeIngredientForList(updated));
      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating"));
    }
  };

  const handleToggleExtra = async (entry) => {
    try {
      const updated = await updateIngredient(token, entry.id, {
        isExtra: !entry.isExtra,
      });
      updateIngredientState(entry.id, () => normalizeIngredientForList(updated));
      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la mise à jour", "Error while updating"));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(tr("Supprimer cet ingrédient ?", "Delete this ingredient?"))) return;
    try {
      await deleteIngredient(token, id);
      setIngredients((prev) => prev.filter((entry) => entry.id !== id));
      setMessage("");
    } catch (err) {
      setMessage(err.response?.data?.error || tr("Erreur lors de la suppression", "Error while deleting"));
    }
  };

  if (authLoading) return <p>{tr("Chargement...", "Loading...")}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">{tr("Gestion des ingrédients", "Ingredient management")}</h2>
      {message && <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-200">{message}</p>}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <h3 className="text-lg font-semibold text-white">{tr("Ajouter un ingrédient", "Add ingredient")}</h3>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {categoryTabs.map((category) => {
            const isActive = String(category.id) === String(activeCategoryId);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(String(category.id))}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                  isActive
                    ? "border-saffron bg-saffron text-charcoal"
                    : "border-white/20 bg-black/20 text-stone-100 hover:bg-white/10"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            placeholder={tr("Nom", "Name")}
            value={newIngredient.name}
            onChange={(event) => setNewIngredient((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder={tr("Catégorie", "Category")}
            value={activeCategory?.name || ""}
            readOnly
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={tr("Prix", "Price")}
            value={newIngredient.price}
            onChange={(event) => setNewIngredient((prev) => ({ ...prev, price: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-stone-100">
            <input
              type="checkbox"
              checked={newIngredient.isExtra}
              onChange={(event) => setNewIngredient((prev) => ({ ...prev, isExtra: event.target.checked }))}
            />
            <span>{tr("Supplement", "Extra")}</span>
          </label>
        </div>

        <button type="button" onClick={handleCreate} className="w-full">
          {tr("Ajouter", "Add")}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">{tr("Ingrédients", "Ingredients")}</h3>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{tr("Nom", "Name")}</th>
                <th>{tr("Catégorie", "Category")}</th>
                <th>{tr("Prix", "Price")}</th>
                <th>{tr("Supplement", "Extra")}</th>
                <th>{tr("Actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleIngredients.length === 0 ? (
                <tr>
                  <td colSpan={6}>{tr("Aucun ingrédient dans cette catégorie.", "No ingredient in this category.")}</td>
                </tr>
              ) : (
                visibleIngredients.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.id}</td>
                    <td>{entry.name}</td>
                    <td>{entry.category?.name || "-"}</td>
                    <td>
                      {entry.editPrice ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.tempPrice}
                          onChange={(event) =>
                            updateIngredientState(entry.id, (item) => ({
                              ...item,
                              tempPrice: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        `${formatPrice(entry.price)} EUR`
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleExtra(entry)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          entry.isExtra
                            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-300"
                            : "border-white/20 bg-black/20 text-stone-200"
                        }`}
                      >
                        {entry.isExtra ? tr("Oui", "Yes") : tr("Non", "No")}
                      </button>
                    </td>
                    <td>
                      <div className="flex min-w-[160px] items-center gap-2">
                        {entry.editPrice ? (
                          <button type="button" onClick={() => handleSave(entry)}>
                            {tr("Sauvegarder", "Save")}
                          </button>
                        ) : (
                          <ActionIconButton
                            onClick={() => toggleEditPrice(entry.id)}
                            label={tr("Modifier le prix", "Edit price")}
                          >
                            <EditIcon />
                          </ActionIconButton>
                        )}
                        <ActionIconButton
                          onClick={() => handleDelete(entry.id)}
                          label={tr("Supprimer", "Delete")}
                          variant="danger"
                        >
                          <DeleteIcon />
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
