import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import GalleryAdmin from "./GalleryAdmin";
import GalleryMenuAdmin from "./GalleryMenuAdmin";

function normalizeTab(rawTab) {
  return String(rawTab || "").toLowerCase() === "menu" ? "menu" : "hero";
}

export default function GalleryTabsAdmin() {
  const { tr } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  const tabs = useMemo(
    () => [
      {
        id: "hero",
        label: tr("Galerie HERO", "Hero gallery"),
      },
      {
        id: "menu",
        label: tr("Galerie menu", "Menu gallery"),
      },
    ],
    [tr]
  );

  const handleTabChange = (tabId) => {
    const normalizedTab = normalizeTab(tabId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", normalizedTab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">{tr("Galerie", "Gallery")}</h2>
        <p className="text-sm text-stone-300">
          {tr(
            "Gerez les visuels Home et Menu depuis cette page.",
            "Manage Home and Menu visuals from this page."
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={
                isActive
                  ? "rounded-xl bg-saffron px-4 py-2 text-xs font-semibold uppercase tracking-wide text-charcoal"
                  : "rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-300 transition hover:bg-white/10 hover:text-white"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "menu" ? <GalleryMenuAdmin /> : <GalleryAdmin />}
    </div>
  );
}
