import { ClickCollectApp } from "../apps/click-collect";
import { CustomerInfoApp } from "../apps/customer-info";

export const appRegistry = [
  {
    id: "click-collect",
    name: "Click&Collect",
    shortName: "CC",
    subtitle: "Commandes & tickets",
    icon: "CC",
    defaultView: "orders",
    notificationScopes: ["orders", "tickets"],
    component: ClickCollectApp,
  },
  {
    id: "customer-info",
    name: "Infos Clients",
    shortName: "CI",
    subtitle: "Recherche & fiches",
    icon: "CI",
    defaultView: "search",
    notificationScopes: ["customers"],
    component: CustomerInfoApp,
  },
  {
    id: "stock",
    name: "Gestion des Stocks",
    shortName: "ST",
    subtitle: "Inventaire & alertes",
    icon: "ST",
    defaultView: "inventory",
    notificationScopes: ["stock"],
    comingSoon: true,
  },
];

export function getAppDefinition(appId) {
  return appRegistry.find((entry) => entry.id === appId) || null;
}
