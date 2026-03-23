import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

const FOCUSABLE_SELECTOR =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export default function PizzaSpotlightGallery({ images = [] }) {
  const { tr } = useLanguage();
  const displayedGallery = images.filter((image) => image?.imageUrl);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const galleryModalRef = useRef(null);

  const primaryImage = displayedGallery[0] || null;
  const secondaryImages = displayedGallery.slice(1, 4);

  const openGalleryAt = (index) => {
    setActiveGalleryIndex(index);
    setIsGalleryModalOpen(true);
  };

  const closeGallery = useCallback(() => setIsGalleryModalOpen(false), []);

  const showPreviousInGallery = useCallback(() => {
    setActiveGalleryIndex((prev) => (prev - 1 + displayedGallery.length) % displayedGallery.length);
  }, [displayedGallery.length]);

  const showNextInGallery = useCallback(() => {
    setActiveGalleryIndex((prev) => (prev + 1) % displayedGallery.length);
  }, [displayedGallery.length]);

  useEffect(() => {
    if (!isGalleryModalOpen) return undefined;

    const modalElement = galleryModalRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

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
        closeGallery();
        return;
      }

      if (event.key === "Tab") {
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
        return;
      }

      if (displayedGallery.length <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousInGallery();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextInGallery();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
      }
    };
  }, [
    closeGallery,
    displayedGallery.length,
    isGalleryModalOpen,
    showNextInGallery,
    showPreviousInGallery,
  ]);

  const activeGalleryImage = displayedGallery[activeGalleryIndex] || null;

  if (!primaryImage) {
    return (
      <p className="text-sm text-stone-400">
        {tr("Aucune photo pizza disponible pour le moment.", "No pizza photo available yet.")}
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <button
          type="button"
          onClick={() => openGalleryAt(0)}
          className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-left"
        >
          <img
            src={primaryImage.imageUrl}
            alt={primaryImage.altText || primaryImage.title || tr("Photo pizza", "Pizza photo")}
            className="h-72 w-full object-cover transition duration-500 group-hover:scale-[1.03] sm:h-[380px]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/90 to-transparent p-3">
            <p className="theme-light-keep-white text-sm font-semibold text-white">
              {primaryImage.title || tr("Derniere photo", "Latest photo")}
            </p>
          </div>
        </button>

        {secondaryImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:grid-rows-3">
            {secondaryImages.map((image, index) => {
              const galleryIndex = index + 1;
              return (
                <button
                  key={image.id || `${image.imageUrl}-${galleryIndex}`}
                  type="button"
                  onClick={() => openGalleryAt(galleryIndex)}
                  className="group relative overflow-hidden rounded-xl border border-white/10"
                >
                  <img
                    src={image.thumbnailUrl || image.imageUrl}
                    alt={image.altText || image.title || tr("Photo pizza", "Pizza photo")}
                    className="h-24 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-[121px]"
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      {isGalleryModalOpen && activeGalleryImage ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
          <div
            ref={galleryModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pizza-gallery-modal-title"
            tabIndex={-1}
            className="w-full max-w-6xl rounded-2xl border border-white/20 bg-charcoal/95 p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-stone-400">
                {tr("Photo", "Photo")} {activeGalleryIndex + 1} / {displayedGallery.length}
              </p>
              <button
                type="button"
                onClick={closeGallery}
                className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                {tr("Fermer", "Close")}
              </button>
            </div>
            <h2 id="pizza-gallery-modal-title" className="sr-only">
              {tr("Galerie pizzas", "Pizza gallery")}
            </h2>

            <div className="relative">
              <div className="relative mx-auto w-fit overflow-hidden rounded-xl">
                <img
                  src={activeGalleryImage.imageUrl}
                  alt={
                    activeGalleryImage.altText ||
                    activeGalleryImage.title ||
                    tr("Photo pizza", "Pizza photo")
                  }
                  loading="eager"
                  decoding="async"
                  className="block max-h-[68vh] w-auto max-w-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/90 to-transparent p-3">
                  <p className="theme-light-keep-white text-sm font-semibold text-white">
                    {activeGalleryImage.title || tr("Galerie pizzas", "Pizza gallery")}
                  </p>
                </div>
              </div>

              {displayedGallery.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPreviousInGallery}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-charcoal/80 p-2 text-white transition hover:bg-charcoal"
                    aria-label={tr("Image precedente", "Previous image")}
                  >
                    {"<"}
                  </button>
                  <button
                    type="button"
                    onClick={showNextInGallery}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-charcoal/80 p-2 text-white transition hover:bg-charcoal"
                    aria-label={tr("Image suivante", "Next image")}
                  >
                    {">"}
                  </button>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {displayedGallery.map((image, index) => (
                <button
                  key={image.id || `${image.imageUrl}-${index}`}
                  type="button"
                  onClick={() => setActiveGalleryIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-lg border ${
                    index === activeGalleryIndex ? "border-saffron" : "border-white/20"
                  }`}
                  aria-label={`${tr("Aller a l'image", "Go to image")} ${index + 1}`}
                >
                  <img
                    src={image.thumbnailUrl || image.imageUrl}
                    alt={
                      image.altText ||
                      image.title ||
                      `${tr("Miniature", "Thumbnail")} ${index + 1}`
                    }
                    className="h-16 w-24 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
