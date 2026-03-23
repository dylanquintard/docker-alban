import { useEffect, useState } from "react";
import { getPublicGallery } from "../api/gallery.api";
import GalleryShowcase from "../components/gallery/GalleryShowcase";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function Gallery() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const [galleryImages, setGalleryImages] = useState([]);
  const siteName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const title = tr(`Galerie | ${siteName}`, `Gallery | ${siteName}`);
  const description = tr(
    "Galerie photo du camion pizza, du four et des pizzas artisanales.",
    "Photo gallery of the pizza truck, oven and handmade pizzas."
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchGalleryImages() {
      try {
        const data = await getPublicGallery();
        if (!cancelled) {
          setGalleryImages(Array.isArray(data) ? data : []);
        }
      } catch (_err) {
        if (!cancelled) {
          setGalleryImages([]);
        }
      }
    }

    fetchGalleryImages();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="section-shell pb-20 pt-10">
      <SeoHead
        title={title}
        description={description}
        pathname="/gallery"
      />
      <GalleryShowcase images={galleryImages} />
    </div>
  );
}
