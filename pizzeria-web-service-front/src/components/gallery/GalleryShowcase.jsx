import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

const DEFAULT_GALLERY_IMAGE = "/pizza-background-1920.webp";
const FOCUSABLE_SELECTOR =
  "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export default function GalleryShowcase({ images = [], className = "" }) {
  const { tr } = useLanguage();
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const galleryModalRef = useRef(null);

  const fallbackGallery = [
    {
      id: "fallback-1",
      imageUrl: DEFAULT_GALLERY_IMAGE,
      title: tr("Four dore", "Golden oven"),
      description: tr("Image de reference", "Reference image"),
    },
  ];

  const displayedGallery =
    images.filter((image) => image?.imageUrl).length > 0
      ? images.filter((image) => image?.imageUrl)
      : fallbackGallery;

  const openGalleryAt = (index) => {
    setActiveGalleryIndex(index);
    setIsGalleryModalOpen(true);
  };

  const closeGallery = useCallback(() => setIsGalleryModalOpen(false), []);

  const showPreviousInGallery = useCallback(() => {
    setActiveGalleryIndex(
      (prev) => (prev - 1 + displayedGallery.length) % displayedGallery.length
    );
  }, [displayedGallery.length]);

  const showNextInGallery = useCallback(() => {
    setActiveGalleryIndex((prev) => (prev + 1) % displayedGallery.length);
  }, [displayedGallery.length]);

  useEffect(() => {
    if (!isGalleryModalOpen) return undefined;

    const modalElement = galleryModalRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusableElements = () => {
      if (!modalElement) return [];
      return Array.from(modalElement.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (element) =>
          element instanceof HTMLElement && !element.hasAttribute("disabled")
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

  return (
    <>
      <section className={className}>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayedGallery.map((image, index) => (
            <button
              key={image.id || `${image.imageUrl}-${index}`}
              type="button"
              onClick={() => openGalleryAt(index)}
              className="group relative overflow-hidden rounded-2xl border border-white/10 text-left"
            >
              <img
                src={image.thumbnailUrl || image.imageUrl}
                alt={image.altText || image.title || tr("Image galerie", "Gallery image")}
                loading="lazy"
                decoding="async"
                className="h-72 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-80"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/90 to-transparent p-3">
                <p className="theme-light-keep-white text-sm font-semibold text-white">
                  {image.title || tr("Galerie", "Gallery")}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {isGalleryModalOpen && activeGalleryImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
          <div
            ref={galleryModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-modal-title"
            tabIndex={-1}
            className="w-full max-w-6xl rounded-2xl border border-white/20 bg-charcoal/95 p-4 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-stone-400">
                {tr("Photo", "Photo")} {activeGalleryIndex + 1} /{" "}
                {displayedGallery.length}
              </p>
              <button
                type="button"
                onClick={closeGallery}
                className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                {tr("Fermer", "Close")}
              </button>
            </div>
            <h2 id="gallery-modal-title" className="sr-only">
              {tr("Galerie en plein ecran", "Fullscreen gallery")}
            </h2>

            <div className="relative">
              <div className="relative mx-auto w-fit overflow-hidden rounded-xl">
                <img
                  src={activeGalleryImage.imageUrl}
                  alt={
                    activeGalleryImage.altText ||
                    activeGalleryImage.title ||
                    tr("Image galerie", "Gallery image")
                  }
                  loading="eager"
                  decoding="async"
                  className="block max-h-[68vh] w-auto max-w-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/90 to-transparent p-3">
                  <p className="theme-light-keep-white text-sm font-semibold text-white">
                    {activeGalleryImage.title || tr("Galerie", "Gallery")}
                  </p>
                  <p className="theme-light-keep-white text-xs text-stone-300">
                    {activeGalleryImage.description ||
                      tr("Qualité artisanale", "Craft quality")}
                  </p>
                </div>
              </div>

              {displayedGallery.length > 1 && (
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
              )}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {displayedGallery.map((image, index) => (
                <button
                  key={image.id || `${image.imageUrl}-${index}`}
                  type="button"
                  onClick={() => setActiveGalleryIndex(index)}
                  className={`shrink-0 overflow-hidden rounded-lg border ${
                    index === activeGalleryIndex
                      ? "border-saffron"
                      : "border-white/20"
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
                    loading="lazy"
                    decoding="async"
                    className="h-16 w-24 object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
