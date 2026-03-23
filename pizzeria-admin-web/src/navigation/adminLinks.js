export const ADMIN_WEB_LINKS = Object.freeze([
  {
    to: "/",
    labelFr: "Accueil",
    labelEn: "Home",
    descriptionFr: "Vue d'ensemble du panel et acces rapides.",
    descriptionEn: "Panel overview and quick access.",
  },
  {
    to: "/menu",
    labelFr: "Menu",
    labelEn: "Menu",
    descriptionFr: "Produits, categories et visuels du catalogue.",
    descriptionEn: "Products, categories and catalog visuals.",
  },
  {
    to: "/ingredients",
    labelFr: "Ingredients",
    labelEn: "Ingredients",
    descriptionFr: "Base ingredients, extras et tarifs.",
    descriptionEn: "Base ingredients, extras and pricing.",
  },
  {
    to: "/timeslots",
    labelFr: "Horaires & Emplacements",
    labelEn: "Schedules & Locations",
    descriptionFr: "Services, capacites et emplacements actifs.",
    descriptionEn: "Services, capacities and active locations.",
  },
  {
    to: "/gallery",
    labelFr: "Galerie",
    labelEn: "Gallery",
    descriptionFr: "Visuels hero, menu et medias du site.",
    descriptionEn: "Hero visuals, menu media and site assets.",
  },
  {
    to: "/print",
    labelFr: "Camions & Impressions",
    labelEn: "Trucks & Printing",
    descriptionFr: "Etat print, agents et suivi technique.",
    descriptionEn: "Print status, agents and technical follow-up.",
  },
  {
    to: "/blog",
    labelFr: "Blog",
    labelEn: "Blog",
    descriptionFr: "Articles, contenus et images editoriales.",
    descriptionEn: "Articles, content and editorial images.",
  },
  {
    to: "/faq",
    labelFr: "FAQ",
    labelEn: "FAQ",
    descriptionFr: "Questions dynamiques et affectation par page.",
    descriptionEn: "Dynamic questions and page assignments.",
  },
  {
    to: "/site-info",
    labelFr: "Info site",
    labelEn: "Site info",
    descriptionFr: "Identite, homepage, SEO, blog et SEO local.",
    descriptionEn: "Identity, homepage, SEO, blog and local SEO.",
  },
]);

export function getAdminWebLinks(tr) {
  return ADMIN_WEB_LINKS.map((item) => ({
    ...item,
    label: typeof tr === "function" ? tr(item.labelFr, item.labelEn) : item.labelFr,
    description:
      typeof tr === "function" ? tr(item.descriptionFr, item.descriptionEn) : item.descriptionFr,
  }));
}

export function getAdminSectionMeta(pathname, tr) {
  const normalizedPath = String(pathname || "").replace(/\/+$/, "") || "/";

  if (normalizedPath.startsWith("/editproduct/")) {
    return {
      label: typeof tr === "function" ? tr("Edition produit", "Product editor") : "Edition produit",
      description:
        typeof tr === "function"
          ? tr("Modification d'un produit existant.", "Edit an existing product.")
          : "Modification d'un produit existant.",
    };
  }

  const match = getAdminWebLinks(tr).find((item) => item.to === normalizedPath);
  if (match) {
    return {
      label: match.label,
      description: match.description,
    };
  }

  return {
    label: typeof tr === "function" ? tr("Administration", "Administration") : "Administration",
    description:
      typeof tr === "function"
        ? tr("Gestion du site et des contenus.", "Site and content management.")
        : "Gestion du site et des contenus.",
  };
}
