import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  createGalleryImage,
  deleteGalleryImage,
  getGalleryAdmin,
  uploadGalleryImage,
  updateGalleryImage,
} from "../api/gallery.api";
import GalleryAdminEditor from "../components/gallery/GalleryAdminEditor";
import { StatusToggle } from "../components/ui/AdminActions";

const HERO_IMAGE_LIMIT = 5;
const MIN_HOME_GALLERY_IMAGE_WIDTH = 1920;
const MIN_HOME_GALLERY_IMAGE_HEIGHT = 1080;

const emptyCreateForm = {
  title: "",
  description: "",
  active: true,
};

const emptyEditForm = {
  id: null,
  imageUrl: "",
  thumbnailUrl: "",
  title: "",
  description: "",
  sortOrder: 0,
  active: false,
};

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMinimumGallerySizeLabel() {
  return `${MIN_HOME_GALLERY_IMAGE_WIDTH} x ${MIN_HOME_GALLERY_IMAGE_HEIGHT}px`;
}

function buildGalleryPayload(form, sortOrder) {
  const title = String(form.title || "").trim();
  return {
    imageUrl: String(form.imageUrl || "").trim(),
    thumbnailUrl: String(form.thumbnailUrl || "").trim() || null,
    title: title || null,
    description: String(form.description || "").trim() || null,
    altText: title || null,
    sortOrder: Number(sortOrder || 0),
    active: Boolean(form.active),
  };
}

function GalleryImageCard({
  image,
  onClick,
  tr,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-black/20 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-saffron/50 hover:shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
    >
      <img
        src={image.thumbnailUrl || image.imageUrl}
        alt={image.altText || image.title || `${tr("Image", "Image")} ${image.id}`}
        className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
        <div className="flex flex-wrap items-center gap-2">
          {image.active && (
            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              {tr("Hero", "Hero")}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-white">
          {image.title || tr("Image sans titre", "Untitled image")}
        </p>
      </div>
    </button>
  );
}

function NewImagePreview({ previewUrl, file, onClear, tr }) {
  if (!previewUrl) return null;

  return (
    <div className="mx-auto max-w-md">
      <div className="relative overflow-hidden rounded-[26px] border border-white/15 bg-black/30 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <img
          src={previewUrl}
          alt={tr("Aperçu image sélectionnée", "Selected image preview")}
          className="h-64 w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3">
          <p className="truncate text-sm font-semibold text-white">
            {file?.name || tr("Image", "Image")}
          </p>
          {file?.size ? (
            <p className="text-xs text-stone-200">{formatFileSize(file.size)}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label={tr("Supprimer la sélection", "Clear sélection")}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/65 text-sm font-bold text-white transition hover:bg-black/80"
        >
          x
        </button>
      </div>
    </div>
  );
}

export default function GalleryAdmin() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [newImage, setNewImage] = useState(emptyCreateForm);
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreviewUrl, setNewImagePreviewUrl] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editImage, setEditImage] = useState(emptyEditForm);
  const [editImageOriginal, setEditImageOriginal] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const newImageLibraryInputRef = useRef(null);
  const newImageCameraInputRef = useRef(null);
  const editImageLibraryInputRef = useRef(null);
  const editImageCameraInputRef = useRef(null);

  const fetchImages = useCallback(async () => {
    try {
      const data = await getGalleryAdmin(token);
      setImages(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors du chargement de la galerie", "Error while loading gallery")
      );
    }
  }, [token, tr]);

  useEffect(() => {
    if (authLoading) return;
    if (!token || user?.role !== "ADMIN") return;
    fetchImages();
  }, [authLoading, token, user, fetchImages]);

  useEffect(() => {
    if (!newImageFile) {
      setNewImagePreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(newImageFile);
    setNewImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [newImageFile]);

  useEffect(() => {
    if (!editImageFile) {
      setEditImagePreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(editImageFile);
    setEditImagePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [editImageFile]);

  const sortedImages = useMemo(
    () =>
      [...images].sort((left, right) => {
        const leftOrder = Number(left?.sortOrder ?? 0);
        const rightOrder = Number(right?.sortOrder ?? 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
      }),
    [images]
  );

  const heroImagesCount = useMemo(
    () => sortedImages.filter((image) => image?.active).length,
    [sortedImages]
  );

  const nextSortOrder = useMemo(() => {
    if (sortedImages.length === 0) return 0;
    return Math.max(...sortedImages.map((image) => Number(image?.sortOrder ?? 0))) + 1;
  }, [sortedImages]);

  const editHeroCountWithoutCurrent = useMemo(
    () => heroImagesCount - (editImageOriginal?.active ? 1 : 0),
    [editImageOriginal, heroImagesCount]
  );

  const canEnableHeroOnEdit = editImage.active || editHeroCountWithoutCurrent < HERO_IMAGE_LIMIT;
  const canEnableHeroOnCreate = newImage.active || heroImagesCount < HERO_IMAGE_LIMIT;

  const hasEditChanges = useMemo(() => {
    if (!editImageOriginal) return false;

    return (
      String(editImage.title || "").trim() !== String(editImageOriginal.title || "").trim() ||
      String(editImage.description || "").trim() !==
        String(editImageOriginal.description || "").trim() ||
      Boolean(editImage.active) !== Boolean(editImageOriginal.active) ||
      Boolean(editImageFile)
    );
  }, [editImage, editImageFile, editImageOriginal]);

  const handleImagePick = (setFile, event) => {
    const pickedFile = event.target.files?.[0] || null;
    setFile(pickedFile);
    event.target.value = "";
  };

  const resetCreateForm = () => {
    setNewImage(emptyCreateForm);
    setNewImageFile(null);
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditImage(emptyEditForm);
    setEditImageOriginal(null);
    setEditImageFile(null);
    setIsEditMode(false);
  };

  const openEditModal = (image) => {
    const payload = {
      id: image.id,
      imageUrl: image.imageUrl || "",
      thumbnailUrl: image.thumbnailUrl || "",
      title: image.title || "",
      description: image.description || "",
      sortOrder: Number(image.sortOrder || 0),
      active: Boolean(image.active),
    };

    setEditingId(image.id);
    setEditImage(payload);
    setEditImageOriginal(payload);
    setEditImageFile(null);
    setIsEditMode(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!newImageFile) {
      setMessage(tr("Sélectionnez un fichier image.", "Select an image file."));
      return;
    }

    if (!String(newImage.title || "").trim()) {
      setMessage(tr("Le titre est obligatoire.", "Title is required."));
      return;
    }

    if (newImage.active && heroImagesCount >= HERO_IMAGE_LIMIT) {
      setMessage(
        tr(
          `Le Hero est limite a ${HERO_IMAGE_LIMIT} images.`,
          `The hero is limited to ${HERO_IMAGE_LIMIT} images.`
        )
      );
      return;
    }

    try {
      setLoading(true);
      const uploaded = await uploadGalleryImage(token, newImageFile);
      const payload = buildGalleryPayload(
        {
          ...newImage,
          imageUrl: uploaded.imageUrl,
          thumbnailUrl: uploaded.thumbnailUrl,
        },
        nextSortOrder
      );

      await createGalleryImage(token, payload);
      resetCreateForm();
      setMessage(tr("Image ajoutee.", "Image added."));
      fetchImages();
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la creation", "Error while creating")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(tr("Supprimer cette image ?", "Delete this image?"))) return;

    try {
      await deleteGalleryImage(token, id);
      if (editingId === id) {
        closeEditModal();
      }
      setMessage(tr("Image supprimée.", "Image deleted."));
      fetchImages();
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la suppression", "Error while deleting")
      );
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !editImageOriginal) return;

    if (!String(editImage.title || "").trim()) {
      setMessage(tr("Le titre est obligatoire.", "Title is required."));
      return;
    }

    if (editImage.active && editHeroCountWithoutCurrent >= HERO_IMAGE_LIMIT) {
      setMessage(
        tr(
          `Le Hero est limite a ${HERO_IMAGE_LIMIT} images.`,
          `The hero is limited to ${HERO_IMAGE_LIMIT} images.`
        )
      );
      return;
    }

    try {
      setLoading(true);

      let payload = buildGalleryPayload(
        {
          ...editImage,
          active: editImage.active,
        },
        editImage.sortOrder
      );

      if (editImageFile) {
        const uploaded = await uploadGalleryImage(token, editImageFile);
        payload = buildGalleryPayload(
          {
            ...editImage,
            imageUrl: uploaded.imageUrl,
            thumbnailUrl: uploaded.thumbnailUrl,
            active: editImage.active,
          },
          editImage.sortOrder
        );
      }

      await updateGalleryImage(token, editingId, payload);

      setMessage(tr("Image mise à jour.", "Image updated."));
      closeEditModal();
      fetchImages();
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
          tr("Erreur lors de la mise à jour", "Error while updating")
      );
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-stone-200">
          {message}
        </p>
      )}

      {editingId ? (
        <GalleryAdminEditor
          tr={tr}
          editingId={editingId}
          editImage={editImage}
          editImagePreviewUrl={editImagePreviewUrl}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          handleDelete={handleDelete}
          onClose={closeEditModal}
          editImageLibraryInputRef={editImageLibraryInputRef}
          editImageCameraInputRef={editImageCameraInputRef}
          handleImagePick={handleImagePick}
          setEditImageFile={setEditImageFile}
          setEditImage={setEditImage}
          heroImagesCount={heroImagesCount}
          heroImageLimit={HERO_IMAGE_LIMIT}
          canEnableHeroOnEdit={canEnableHeroOnEdit}
          setMessage={setMessage}
          handleUpdate={handleUpdate}
          loading={loading}
          hasEditChanges={hasEditChanges}
        />
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">
              {tr("Gestion de la galerie Home", "Home gallery management")}
            </h2>
            <p className="text-sm text-stone-300">
              {tr(
                "Les images actives alimentent le Hero defilant. La page Gallery affiche toutes les images. Le Hero est limite a 5 images.",
                "Active images feed the rotating hero. The Gallery page shows every image. The hero is limited to 5 images."
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  {tr("Images Hero", "Hero images")}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {heroImagesCount} / {HERO_IMAGE_LIMIT}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  {tr("Images total", "Total images")}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{sortedImages.length}</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleCreate}
            className="space-y-5 rounded-[28px] border border-white/10 bg-black/20 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6"
          >
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-semibold text-white">
                {tr("Ajouter une image", "Add image")}
              </h3>
              <p className="text-xs text-stone-400">
                {tr(
                  `Utilisez des images d'au minimum ${getMinimumGallerySizeLabel()} pour un rendu propre sur le Hero.`,
                  `Use images at least ${getMinimumGallerySizeLabel()} for a clean hero rendering.`
                )}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                onClick={() => newImageLibraryInputRef.current?.click()}
              >
                {tr("Choisir une photo", "Choose photo")}
              </button>
              <button
                type="button"
                className="rounded-full border border-sky-500/40 bg-sky-500/10 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
                onClick={() => newImageCameraInputRef.current?.click()}
              >
                {tr("Prendre une photo", "Take photo")}
              </button>
            </div>

            <input
              ref={newImageLibraryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleImagePick(setNewImageFile, event)}
            />
            <input
              ref={newImageCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => handleImagePick(setNewImageFile, event)}
            />

            <NewImagePreview
              previewUrl={newImagePreviewUrl}
              file={newImageFile}
              onClear={() => setNewImageFile(null)}
              tr={tr}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-1 text-sm text-stone-300">
                <span>{tr("Titre", "Title")}</span>
                <input
                  id="gallery-new-title"
                  required
                  placeholder={tr("Titre obligatoire", "Required title")}
                  value={newImage.title}
                  onChange={(event) =>
                    setNewImage((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-1 text-sm text-stone-300">
                <span>{tr("Description", "Description")}</span>
                <textarea
                  id="gallery-new-description"
                  rows="3"
                  placeholder={tr("Description optionnelle", "Optional description")}
                  value={newImage.description}
                  onChange={(event) =>
                    setNewImage((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
                <p className="font-semibold text-white">
                  {tr("Texte alternatif", "Alt text")}
                </p>
                <p className="mt-1 text-stone-300">
                  {String(newImage.title || "").trim() ||
                    tr("Le titre sera copie ici automatiquement.", "The title will be copied here automatically.")}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
                <p className="font-semibold text-white">
                  {tr("Ordre par defaut", "Default order")}
                </p>
                <p className="mt-1 text-stone-300">
                  {tr(
                    `Cette image sera ajoutee en position ${nextSortOrder + 1}.`,
                    `This image will be added in position ${nextSortOrder + 1}.`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {tr("Afficher dans Hero", "Show in hero")}
                </p>
                <p className="text-xs text-stone-400">
                  {tr(
                    `${heroImagesCount}/${HERO_IMAGE_LIMIT} images actuellement sélectionnées.`,
                    `${heroImagesCount}/${HERO_IMAGE_LIMIT} images currently selected.`
                  )}
                </p>
              </div>
              <StatusToggle
                checked={newImage.active}
                onChange={() => {
                  if (!newImage.active && !canEnableHeroOnCreate) {
                    setMessage(
                      tr(
                        `Le Hero est limite a ${HERO_IMAGE_LIMIT} images.`,
                        `The hero is limited to ${HERO_IMAGE_LIMIT} images.`
                      )
                    );
                    return;
                  }

                  setNewImage((prev) => ({ ...prev, active: !prev.active }));
                }}
                labelOn={tr("Retirer du Hero", "Remove from hero")}
                labelOff={tr("Ajouter au Hero", "Add to hero")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-saffron px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {tr("Ajouter", "Add")}
            </button>
          </form>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">
                {tr("Images enregistrees", "Saved images")}
              </h3>
              <p className="text-sm text-stone-400">
                {tr(
                  "Cliquez sur une image pour la modifier.",
                  "Click an image to edit it."
                )}
              </p>
            </div>

            {sortedImages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-stone-300">
                {tr("Aucune image enregistree.", "No saved image.")}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedImages.map((image) => (
                  <GalleryImageCard
                    key={image.id}
                    image={image}
                    onClick={() => openEditModal(image)}
                    tr={tr}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
