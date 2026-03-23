export const ADMIN_NAV_LINKS = Object.freeze([
  { to: "/admin/orders", labelFr: "Commandes", labelEn: "Orders" },
  { to: "/admin/tickets", labelFr: "Tickets", labelEn: "Tickets" },
  { to: "/admin/menu", labelFr: "Menu", labelEn: "Menu" },
  { to: "/admin/timeslots", labelFr: "Horaires & Emplacements", labelEn: "Schedules & Locations" },
  { to: "/admin/gallery", labelFr: "Galerie", labelEn: "Gallery" },
  { to: "/admin/print", labelFr: "Camions & Impressions", labelEn: "Trucks & Printing" },
  { to: "/admin/users", labelFr: "Clients", labelEn: "Users" },
  { to: "/admin/blog", labelFr: "Blog", labelEn: "Blog" },
  { to: "/admin/faq", labelFr: "FAQ", labelEn: "FAQ" },
  { to: "/admin/site-info", labelFr: "Info site", labelEn: "Site info" },
]);

export function getAdminNavLinks(tr) {
  return ADMIN_NAV_LINKS.map((item) => ({
    to: item.to,
    label: typeof tr === "function" ? tr(item.labelFr, item.labelEn) : item.labelFr,
  }));
}
