import { useCallback, useContext, useEffect, useState } from "react";
import { getAllProducts, updateProduct } from "../api/admin.api";
import { getAdminSiteSettings, updateSiteSettings } from "../api/site-settings.api";
import { uploadGalleryImage } from "../api/gallery.api";
import { StatusToggle } from "../components/ui/AdminActions";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
}

export default function GalleryMenuAdmin() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();
  const { applySettings } = useSiteSettings();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [busyProductId, setBusyProductId] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null);
  const [draftImageFile, setDraftImageFile] = useState(null);
  const [draftImagePreviewUrl, setDraftImagePreviewUrl] = useState("");
  const [draftRemoveImage, setDraftRemoveImage] = useState(false);
  const [showMenuProductImages, setShowMenuProductImages] = useState(true);
  const [togglingMenuImagesVisibility, setTogglingMenuImagesVisibility] = useState(false);

  const fetchProducts = useCallback(async () => {
    const data = await getAllProducts(token);
    setProducts(
      [...(Array.isArray(data) ? data : [])].sort((left, right) =>
        String(left?.name || "").localeCompare(String(right?.name || ""))
      )
    );
  }, [token]);

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN") return;
    setLoading(true);
    Promise.all([fetchProducts(), getAdminSiteSettings(token)])
      .then(([, settings]) => {
        setMessage("");
        setShowMenuProductImages(settings?.order?.showMenuProductImages !== false);
      })
      .catch((err) => {
        setMessage(
          err?.response?.data?.error ||
            tr("Erreur lors du chargement des produits", "Error while loading products")
        );
      })
      .finally(() => setLoading(false));
  }, [authLoading, fetchProducts, token, tr, user]);

  const handleToggleMenuImageVisibility = async () => {
    const nextValue = !showMenuProductImages;
    try {
      setTogglingMenuImagesVisibility(true);
      const updated = await updateSiteSettings(token, {
        order: {
          showMenuProductImages: nextValue,
        },
      });
      applySettings(updated);
      setShowMenuProductImages(updated?.order?.showMenuProductImages !== false);
      setMessage(
        nextValue
          ? tr("Affichage des images menu activé", "Menu image display enabled")
          : tr("Affichage des images menu désactivé", "Menu image display disabled")
      );
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Erreur lors de la mise à jour", "Error while updating")
      );
    } finally {
      setTogglingMenuImagesVisibility(false);
    }
  };

  const resetDraftState = useCallback(() => {
    if (draftImagePreviewUrl) {
      URL.revokeObjectURL(draftImagePreviewUrl);
    }
    setDraftImagePreviewUrl("");
    setDraftImageFile(null);
    setDraftRemoveImage(false);
  }, [draftImagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (draftImagePreviewUrl) {
        URL.revokeObjectURL(draftImagePreviewUrl);
      }
    };
  }, [draftImagePreviewUrl]);

  const handleSelectDraftImage = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;

    if (draftImagePreviewUrl) {
      URL.revokeObjectURL(draftImagePreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setDraftImageFile(file);
    setDraftImagePreviewUrl(previewUrl);
    setDraftRemoveImage(false);
  };

  const handleMarkDraftImageRemoved = () => {
    if (draftImagePreviewUrl) {
      URL.revokeObjectURL(draftImagePreviewUrl);
    }
    setDraftImagePreviewUrl("");
    setDraftImageFile(null);
    setDraftRemoveImage(true);
  };

  const handleValidateEdition = async (product) => {
    const hasPendingUpload = Boolean(draftImageFile);
    const hasPendingRemoval = Boolean(draftRemoveImage);

    if (!hasPendingUpload && !hasPendingRemoval) {
      setEditingProductId(null);
      resetDraftState();
      return;
    }

    setBusyProductId(Number(product.id));
    try {
      if (hasPendingUpload) {
        const uploaded = await uploadGalleryImage(token, draftImageFile);
        await updateProduct(token, product.id, {
          imageUrl: uploaded?.imageUrl || null,
          thumbnailUrl: uploaded?.thumbnailUrl || null,
          imageAlt: String(product?.name || "").trim() || null,
        });
      } else if (hasPendingRemoval) {
        await updateProduct(token, product.id, {
          imageUrl: null,
          thumbnailUrl: null,
          imageAlt: null,
        });
      }

      await fetchProducts();
      setMessage(
        hasPendingRemoval
          ? tr("Photo pizza retiree", "Pizza photo removed")
          : tr("Photo pizza mise a jour", "Pizza photo updated")
      );
      setEditingProductId(null);
      resetDraftState();
    } catch (err) {
      setMessage(
        err?.response?.data?.error || tr("Erreur lors de l'enregistrement", "Error while saving")
      );
    } finally {
      setBusyProductId(null);
    }
  };

  const handlePrimaryAction = async (product) => {
    if (Number(editingProductId) !== Number(product.id)) {
      resetDraftState();
      setEditingProductId(Number(product.id));
      return;
    }

    await handleValidateEdition(product);
  };

  if (authLoading || loading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Acces refuse : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          {tr("Galerie menu", "Menu gallery")}
        </h2>
        <p className="mt-1 text-sm text-stone-300">
          {tr(
            "Associez une photo a chaque pizza. Ces photos alimentent la galerie de la page /pizza.",
            "Attach one photo to each pizza. These photos feed the gallery on /pizza."
          )}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {tr("Affichage images menu", "Menu images display")}
          </p>
          <p className="text-xs text-stone-400">
            {tr(
              "Ce bouton affiche ou masque toutes les images dans les menus côté utilisateur.",
              "This toggle shows or hides all menu images for users."
            )}
          </p>
        </div>
        <StatusToggle
          checked={showMenuProductImages}
          disabled={togglingMenuImagesVisibility}
          onChange={handleToggleMenuImageVisibility}
          labelOn={tr("Actif", "Active")}
          labelOff={tr("Inactif", "Inactive")}
        />
      </div>

      {message ? (
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-100">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => {
          const isBusy = Number(busyProductId) === Number(product.id);
          const isEditing = Number(editingProductId) === Number(product.id);
          const persistedImageUrl = product?.thumbnailUrl || product?.imageUrl || "";
          const displayImageUrl = draftRemoveImage
            ? ""
            : draftImagePreviewUrl || persistedImageUrl;
          const canShowRemoveButton = Boolean(draftImageFile) || Boolean(persistedImageUrl);
          return (
            <article
              key={product.id}
              className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{product.name}</p>
                  <p className="text-xs text-stone-300">{formatPrice(product.basePrice)} EUR</p>
                  <p className="text-[11px] text-stone-400">
                    {persistedImageUrl
                      ? tr("Photo liee", "Photo linked")
                      : tr("Sans photo", "No photo")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handlePrimaryAction(product)}
                    className={
                      isEditing
                        ? "rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200"
                        : ""
                    }
                  >
                    {isBusy
                      ? tr("Enregistrement...", "Saving...")
                      : isEditing
                        ? tr("VALIDER", "SAVE")
                        : tr("Modifier", "Edit")}
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setEditingProductId(null);
                        resetDraftState();
                      }}
                    >
                      {tr("Annuler", "Cancel")}
                    </button>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <>
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-charcoal/35">
                    {displayImageUrl ? (
                      <img
                        src={displayImageUrl}
                        alt={product.imageAlt || product.name || tr("Photo pizza", "Pizza photo")}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center px-3 text-center text-xs text-stone-400">
                        {tr("Aucune photo associee", "No linked photo")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isBusy}
                        onChange={handleSelectDraftImage}
                      />
                      <span className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        {tr("Uploader photo", "Upload photo")}
                      </span>
                    </label>

                    {canShowRemoveButton ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={handleMarkDraftImageRemoved}
                        className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200"
                      >
                        {tr("Retirer photo", "Remove photo")}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
