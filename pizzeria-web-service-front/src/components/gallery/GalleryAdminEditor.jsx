import { ActionIconButton, EditIcon, StatusToggle } from "../ui/AdminActions";

export default function GalleryAdminEditor({
  tr,
  editingId,
  editImage,
  editImagePreviewUrl,
  isEditMode,
  setIsEditMode,
  handleDelete,
  onClose,
  editImageLibraryInputRef,
  editImageCameraInputRef,
  handleImagePick,
  setEditImageFile,
  setEditImage,
  heroImagesCount,
  heroImageLimit,
  canEnableHeroOnEdit,
  setMessage,
  handleUpdate,
  loading,
  hasEditChanges,
}) {
  return (
    <div className="rounded-[30px] border border-white/15 bg-charcoal p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-stone-400">
            {tr("Image", "Image")}
          </p>
          <h3 className="mt-1 truncate text-2xl font-bold text-white">
            {editImage.title || tr("Image sans titre", "Untitled image")}
          </h3>
          <p className="mt-2 text-sm text-stone-400">
            {isEditMode
              ? tr(
                  "Les champs sont modifiables. Mettez a jour pour enregistrer.",
                  "Fields are editable. Update to save."
                )
              : tr(
                  "Cliquez sur le crayon pour activer la modification.",
                  "Click the pencil to enable editing."
                )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionIconButton
            onClick={() => setIsEditMode((prev) => !prev)}
            label={isEditMode ? tr("Verrouiller", "Lock") : tr("Modifier", "Edit")}
            className="h-10 w-10 rounded-full border border-white/15 bg-white/5"
          >
            <EditIcon className="h-4 w-4" />
          </ActionIconButton>
          <button
            type="button"
            onClick={() => handleDelete(editingId)}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            {tr("Supprimer", "Delete")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {tr("Fermer", "Close")}
          </button>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/10 bg-black/25 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
          <img
            src={editImagePreviewUrl || editImage.imageUrl}
            alt={editImage.title || tr("Image galerie", "Gallery image")}
            className="mx-auto h-72 w-full object-cover"
          />
        </div>
      </div>

      {isEditMode ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            onClick={() => editImageLibraryInputRef.current?.click()}
          >
            {tr("Choisir une photo", "Choose photo")}
          </button>
          <button
            type="button"
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            onClick={() => editImageCameraInputRef.current?.click()}
          >
            {tr("Prendre une photo", "Take photo")}
          </button>
          <input
            ref={editImageLibraryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImagePick(setEditImageFile, event)}
          />
          <input
            ref={editImageCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => handleImagePick(setEditImageFile, event)}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 rounded-[26px] border border-white/10 bg-white/5 p-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm text-stone-300">
          <span>{tr("Titre image", "Image title")}</span>
          <input
            value={editImage.title}
            disabled={!isEditMode}
            onChange={(event) =>
              setEditImage((prev) => ({ ...prev, title: event.target.value }))
            }
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-200">
          <p className="font-semibold text-white">{tr("Texte alternatif", "Alt text")}</p>
          <p className="mt-1 text-stone-300">
            {String(editImage.title || "").trim() ||
              tr("Le titre sera copie automatiquement.", "The title will be copied automatically.")}
          </p>
        </div>

        <label className="grid gap-1 text-sm text-stone-300 lg:col-span-2">
          <span>{tr("Description", "Description")}</span>
          <textarea
            rows="4"
            value={editImage.description}
            disabled={!isEditMode}
            onChange={(event) =>
              setEditImage((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {tr("Actif / Inactif", "Active / Inactive")}
            </p>
            <p className="text-xs text-stone-400">
              {tr(
                `${heroImagesCount}/${heroImageLimit} images actives dans le Hero.`,
                `${heroImagesCount}/${heroImageLimit} active hero images.`
              )}
            </p>
          </div>
          <StatusToggle
            checked={editImage.active}
            disabled={!isEditMode}
            onChange={() => {
              if (!editImage.active && !canEnableHeroOnEdit) {
                setMessage(
                  tr(
                    `Le Hero est limite a ${heroImageLimit} images.`,
                    `The hero is limited to ${heroImageLimit} images.`
                  )
                );
                return;
              }

              setEditImage((prev) => ({
                ...prev,
                active: !prev.active,
              }));
            }}
            labelOn={tr("Desactiver", "Disable")}
            labelOff={tr("Activer", "Enable")}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-5">
        {isEditMode ? (
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading || !hasEditChanges}
            className="rounded-full bg-saffron px-5 py-2 text-sm font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tr("Mettre a jour", "Update")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
