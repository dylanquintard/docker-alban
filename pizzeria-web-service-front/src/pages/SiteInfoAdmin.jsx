import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminSiteSettings,
  translateSiteSettingsToEnglish,
  uploadSiteHeaderLogo,
  updateSiteSettings,
} from "../api/site-settings.api";
import { uploadGalleryImage } from "../api/gallery.api";
import { getAllProducts } from "../api/admin.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { mergeSiteSettings } from "../site/siteSettings";

function createFormFromSettings(settings) {
  const merged = mergeSiteSettings(settings);
  return {
    ...merged,
    seo: {
      ...merged.seo,
      headerLogoFile: null,
      headerLogoPreviewUrl: merged.seo.headerLogoUrl || "",
      defaultOgImageFile: null,
      defaultOgImagePreviewUrl: merged.seo.defaultOgImageUrl || "",
    },
  };
}

function AccordionSection({
  sectionRef,
  eyebrow,
  title,
  description,
  isOpen,
  onToggle,
  onSave,
  onTranslate,
  saving,
  translating,
  saveLabel,
  children,
}) {
  const chevronClassName = `h-4 w-4 transition-transform duration-200 ${
    isOpen ? "rotate-180" : "rotate-0"
  }`;

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-charcoal/35"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-charcoal/35 px-4 py-3 text-left transition hover:bg-charcoal/50"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-saffron">{eyebrow}</p>
          <p className="mt-1 text-xs text-stone-400">
            {description || title}
          </p>
        </div>
        <span className="shrink-0 text-stone-300" aria-hidden="true">
          <svg
            viewBox="0 0 20 20"
            className={chevronClassName}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m5 7 5 6 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div className="border-t border-white/10 bg-black/10 p-4">
          <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
          {children}
          <div className="mt-5 flex flex-wrap gap-3">
            {onTranslate ? (
              <button
                type="button"
                onClick={onTranslate}
                disabled={saving || translating}
                className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {translating
                  ? "Génération..."
                  : "Générer l'anglais"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSave}
              disabled={saving || translating}
              className="rounded-full bg-saffron px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? `${saveLabel}...` : saveLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LocalizedField({ label, value, onChange, multiline = false }) {
  const inputClassName =
    "rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <label className="grid gap-1 text-xs text-stone-300">
        <span>{label} FR</span>
        {multiline ? (
          <textarea
            rows={4}
            value={value.fr}
            onChange={(event) => onChange("fr", event.target.value)}
            className={`${inputClassName} leading-7`}
          />
        ) : (
          <input
            value={value.fr}
            onChange={(event) => onChange("fr", event.target.value)}
            className={inputClassName}
          />
        )}
      </label>
      <label className="grid gap-1 text-xs text-stone-300">
        <span>{label} EN</span>
        {multiline ? (
          <textarea
            rows={4}
            value={value.en}
            onChange={(event) => onChange("en", event.target.value)}
            className={`${inputClassName} leading-7`}
          />
        ) : (
          <input
            value={value.en}
            onChange={(event) => onChange("en", event.target.value)}
            className={inputClassName}
          />
        )}
      </label>
    </div>
  );
}

function parseMultilineEntries(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim());
}

function mergeTranslatedMultilineValue(previousValue, translatedValue) {
  const frenchLines = parseMultilineEntries(translatedValue?.fr ?? previousValue?.fr);
  const englishLines = parseMultilineEntries(translatedValue?.en ?? previousValue?.en);
  const lineCount = Math.max(frenchLines.length, englishLines.length);

  return {
    fr: frenchLines.join("\n").trim(),
    en: Array.from({ length: lineCount }, (_value, index) => {
      return englishLines[index] || frenchLines[index] || "";
    })
      .filter(Boolean)
      .join("\n")
      .trim(),
  };
}

function parseHighlightedIngredientList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function serializeHighlightedIngredientList(items) {
  return items
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .join("\n");
}

function normalizeLocalizedValue(value) {
  return {
    fr: String(value?.fr || ""),
    en: String(value?.en || ""),
  };
}

function HighlightedIngredientsManager({
  items,
  pendingValue,
  isAdding,
  onPendingChange,
  onStartAdd,
  onConfirmAdd,
  onCancelAdd,
  onRemove,
  tr,
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {isAdding ? (
            <>
              <input
                value={pendingValue}
                onChange={(event) => onPendingChange(event.target.value)}
                placeholder={tr("Nom de l'ingrédient", "Ingredient name")}
                className="min-w-[240px] flex-1 rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
              <button
                type="button"
                onClick={onConfirmAdd}
                disabled={!pendingValue.trim()}
                className="rounded-full bg-saffron px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tr("Valider", "Confirm")}
              </button>
              <button
                type="button"
                onClick={onCancelAdd}
                className="rounded-full border border-white/20 bg-black/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
              >
                {tr("Annuler", "Cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartAdd}
              className="rounded-full border border-white/20 bg-black/20 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
            >
              {tr("Ajouter un ingrédient", "Add an ingredient")}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
          {tr("Liste actuelle", "Current list")}
        </p>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 px-4 py-4 text-sm text-stone-400">
            {tr(
              "Aucun ingrédient mis en avant pour le moment.",
              "No highlighted ingredients yet."
            )}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((ingredient, index) => (
              <div
                key={`${ingredient}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/20 bg-stone-200/20 px-3 py-2 text-sm text-stone-100"
              >
                <span className="min-w-0 flex-1 truncate">{ingredient}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20 text-xs text-stone-200 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-100"
                  aria-label={tr("Supprimer l'ingrédient", "Remove ingredient")}
                  title={tr("Supprimer", "Remove")}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteInfoAdmin() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();
  const { settings: publicSettings, applySettings } = useSiteSettings();

  const [form, setForm] = useState(() => createFormFromSettings(publicSettings));
  const [loading, setLoading] = useState(false);
  const [savingSectionId, setSavingSectionId] = useState(null);
  const [translatingSectionId, setTranslatingSectionId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [openSectionId, setOpenSectionId] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [highlightedIngredientDraft, setHighlightedIngredientDraft] = useState("");
  const [isAddingHighlightedIngredient, setIsAddingHighlightedIngredient] = useState(false);
  const sectionRefs = useRef({});

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN") return;

    let active = true;
    async function loadAdminSettings() {
      try {
        setLoading(true);
        const data = await getAdminSiteSettings(token);
        if (active) {
          setForm(createFormFromSettings(data));
        }
      } catch (err) {
        if (active) {
          setMessage(
            err?.response?.data?.error ||
              tr("Impossible de charger les informations du site.", "Unable to load site information.")
          );
          setMessageType("error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAdminSettings();
    return () => {
      active = false;
    };
  }, [authLoading, token, tr, user]);

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN") return;

    let active = true;
    async function loadProducts() {
      try {
        setLoadingProducts(true);
        const products = await getAllProducts(token);
        if (!active) return;
        const sorted = [...(Array.isArray(products) ? products : [])].sort((left, right) =>
          String(left?.name || "").localeCompare(String(right?.name || ""))
        );
        setAvailableProducts(sorted);
      } catch (_err) {
        if (!active) return;
        setAvailableProducts([]);
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [authLoading, token, user]);

  const feedbackClassName = useMemo(() => {
    if (messageType === "success") {
      return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
    }
    if (messageType === "error") {
      return "border-red-400/35 bg-red-500/10 text-red-100";
    }
    return "border-white/10 bg-white/5 text-stone-100";
  }, [messageType]);

  const saveButtonLabel = tr("Sauvegarder", "Save");
  const highlightedIngredients = useMemo(
    () => parseHighlightedIngredientList(form.home?.highlightedIngredients?.fr),
    [form.home?.highlightedIngredients?.fr]
  );
  const highlightedIngredientsEn = useMemo(
    () => parseHighlightedIngredientList(form.home?.highlightedIngredients?.en),
    [form.home?.highlightedIngredients?.en]
  );
  const featuredPizzaProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(form.pizzaPage?.featuredProductIds)
            ? form.pizzaPage.featuredProductIds
            : []
          )
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        )
      ),
    [form.pizzaPage?.featuredProductIds]
  );
  const selectableProducts = useMemo(() => availableProducts, [availableProducts]);

  const updateRootField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateRootLocalized = (field, locale, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [locale]: value,
      },
    }));
  };

  const updateNestedField = (section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const updateNestedLocalized = (section, field, locale, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: {
          ...prev[section][field],
          [locale]: value,
        },
      },
    }));
  };

  const updateHighlightedIngredients = (nextFrenchItems, nextEnglishItems) => {
    setForm((prev) => ({
      ...prev,
      home: {
        ...prev.home,
        highlightedIngredients: {
          fr: serializeHighlightedIngredientList(nextFrenchItems),
          en: serializeHighlightedIngredientList(nextEnglishItems),
        },
      },
    }));
  };

  const toggleFeaturedPizzaProduct = (productId) => {
    const normalizedId = Number(productId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) return;

    setForm((prev) => {
      const current = Array.isArray(prev.pizzaPage?.featuredProductIds)
        ? prev.pizzaPage.featuredProductIds
        : [];
      const exists = current.some((entry) => Number(entry) === normalizedId);
      const nextIds = exists
        ? current.filter((entry) => Number(entry) !== normalizedId)
        : [...current, normalizedId];

      return {
        ...prev,
        pizzaPage: {
          ...prev.pizzaPage,
          featuredProductIds: nextIds,
        },
      };
    });
  };

  const handleStartAddHighlightedIngredient = () => {
    setIsAddingHighlightedIngredient(true);
    setHighlightedIngredientDraft("");
  };

  const handleCancelAddHighlightedIngredient = () => {
    setIsAddingHighlightedIngredient(false);
    setHighlightedIngredientDraft("");
  };

  const handleConfirmAddHighlightedIngredient = () => {
    const nextIngredient = highlightedIngredientDraft.trim();
    if (!nextIngredient) return;

    const currentFrenchItems = parseHighlightedIngredientList(form.home?.highlightedIngredients?.fr);
    const currentEnglishItems = parseHighlightedIngredientList(form.home?.highlightedIngredients?.en);
    updateHighlightedIngredients(
      [...currentFrenchItems, nextIngredient],
      [...currentEnglishItems, nextIngredient]
    );
    setIsAddingHighlightedIngredient(false);
    setHighlightedIngredientDraft("");
  };

  const handleRemoveHighlightedIngredient = (indexToRemove) => {
    const currentFrenchItems = parseHighlightedIngredientList(form.home?.highlightedIngredients?.fr);
    const currentEnglishItems = parseHighlightedIngredientList(form.home?.highlightedIngredients?.en);
    updateHighlightedIngredients(
      currentFrenchItems.filter((_entry, index) => index !== indexToRemove),
      currentEnglishItems.filter((_entry, index) => index !== indexToRemove)
    );
  };

  const handleOgImageUpload = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        defaultOgImageFile: file,
        defaultOgImagePreviewUrl: previewUrl,
      },
    }));
  };

  const handleHeaderLogoUpload = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        headerLogoFile: file,
        headerLogoPreviewUrl: previewUrl,
      },
    }));
  };

  const toggleSection = (sectionId) => {
    setOpenSectionId((current) => (current === sectionId ? null : sectionId));
  };

  useEffect(() => {
    if (!openSectionId) return;
    const targetNode = sectionRefs.current[openSectionId];
    if (targetNode && typeof targetNode.scrollIntoView === "function") {
      window.requestAnimationFrame(() => {
        targetNode.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [openSectionId]);

  const getSectionPayload = (sectionId) => {
    switch (sectionId) {
      case "identity":
        return {
          siteName: form.siteName.trim(),
          siteTagline: form.siteTagline,
          siteDescription: form.siteDescription,
          seo: {
            headerLogoUrl: form.seo.headerLogoUrl,
          },
        };
      case "contact":
        return { contact: form.contact };
      case "social":
        return { social: form.social };
      case "seo":
        return {
          seo: {
            defaultMetaTitle: form.seo.defaultMetaTitle,
            defaultMetaDescription: form.seo.defaultMetaDescription,
            defaultOgImageUrl: form.seo.defaultOgImageUrl,
            canonicalSiteUrl: form.seo.canonicalSiteUrl,
          },
        };
      case "home":
        return {
          home: {
            heroTitle: normalizeLocalizedValue(form.home.heroTitle),
            heroSubtitle: normalizeLocalizedValue(form.home.heroSubtitle),
            primaryCtaLabel: normalizeLocalizedValue(form.home.primaryCtaLabel),
            secondaryCtaLabel: normalizeLocalizedValue(form.home.secondaryCtaLabel),
            reassuranceText: normalizeLocalizedValue(form.home.reassuranceText),
            highlightedIngredients: {
              fr: serializeHighlightedIngredientList(highlightedIngredients),
              en: serializeHighlightedIngredientList(
                highlightedIngredientsEn.length > 0 ? highlightedIngredientsEn : highlightedIngredients
              ),
            },
          },
        };
      case "announcement":
        return { announcement: form.announcement };
      case "pizzaPage":
        return {
          pizzaPage: {
            sectionTitle: normalizeLocalizedValue(form.pizzaPage?.sectionTitle),
            sectionDescription: normalizeLocalizedValue(form.pizzaPage?.sectionDescription),
            featuredProductIds: Array.from(
              new Set(
                (Array.isArray(form.pizzaPage?.featuredProductIds)
                  ? form.pizzaPage.featuredProductIds
                  : []
                )
                  .map((value) => Number(value))
                  .filter((value) => Number.isInteger(value) && value > 0)
              )
            ),
          },
        };
      case "blog":
        return { blog: form.blog };
      case "contactPage":
        return { contactPage: form.contactPage };
      case "order":
        return { order: form.order };
      case "footer":
        return { footer: form.footer };
      default:
        throw new Error("Unknown section");
    }
  };

  const saveSection = async (sectionId) => {
    if (!token) return;

    try {
      setSavingSectionId(sectionId);
      setMessage("");

      let payload = null;

      switch (sectionId) {
        case "identity": {
          let headerLogoUrl = String(form.seo.headerLogoUrl || "").trim();
          let faviconUrl = String(form.seo.faviconUrl || "").trim();
          if (form.seo.headerLogoFile) {
            const uploaded = await uploadSiteHeaderLogo(token, form.seo.headerLogoFile);
            headerLogoUrl = uploaded.imageUrl;
            faviconUrl = uploaded.faviconUrl || uploaded.imageUrl || faviconUrl;
          }

          payload = {
            siteName: form.siteName.trim(),
            siteTagline: form.siteTagline,
            siteDescription: form.siteDescription,
            seo: {
              headerLogoUrl,
              faviconUrl,
            },
          };
          break;
        }
        case "contact":
          payload = { contact: form.contact };
          break;
        case "social":
          payload = { social: form.social };
          break;
        case "seo": {
          let defaultOgImageUrl = String(form.seo.defaultOgImageUrl || "").trim();
          if (form.seo.defaultOgImageFile) {
            const uploaded = await uploadGalleryImage(token, form.seo.defaultOgImageFile);
            defaultOgImageUrl = uploaded.imageUrl;
          }

          payload = {
            seo: {
              defaultMetaTitle: form.seo.defaultMetaTitle,
              defaultMetaDescription: form.seo.defaultMetaDescription,
              defaultOgImageUrl,
              canonicalSiteUrl: form.seo.canonicalSiteUrl,
            },
          };
          break;
        }
        case "home":
          payload = getSectionPayload("home");
          break;
        case "announcement":
          payload = {
            announcement: {
              enabled: Boolean(form.announcement.enabled),
              variant: form.announcement.variant,
              linkUrl: form.announcement.enabled ? form.announcement.linkUrl : "",
              text: form.announcement.enabled
                ? form.announcement.text
                : { fr: "", en: "" },
            },
          };
          break;
        case "pizzaPage":
          payload = getSectionPayload("pizzaPage");
          break;
        case "blog":
          payload = { blog: form.blog };
          break;
        case "contactPage":
          payload = { contactPage: form.contactPage };
          break;
        case "order":
          payload = { order: form.order };
          break;
        case "footer":
          payload = { footer: form.footer };
          break;
        default:
          throw new Error("Unknown section");
      }

      const saved = await updateSiteSettings(token, payload);
      const shouldKeepLocalSectionState =
        sectionId === "home" || sectionId === "announcement";
      const nextSettings = shouldKeepLocalSectionState
        ? mergeSiteSettings({
            ...mergeSiteSettings(saved),
            home: sectionId === "home" ? mergeSiteSettings(form).home : mergeSiteSettings(saved).home,
            announcement:
              sectionId === "announcement"
                ? mergeSiteSettings(form).announcement
                : mergeSiteSettings(saved).announcement,
          })
        : mergeSiteSettings(saved);

      applySettings(nextSettings);
      setForm(createFormFromSettings(nextSettings));
      setMessage(tr("Section enregistrée.", "Section saved."));
      setMessageType("success");
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Impossible d'enregistrer cette section.", "Unable to save this section.")
      );
      setMessageType("error");
    } finally {
      setSavingSectionId(null);
    }
  };

  const mergeTranslatedSection = (sectionId, translated) => {
    setForm((prev) => {
      const next = { ...prev };

      switch (sectionId) {
        case "identity":
          next.siteName = translated.siteName ?? prev.siteName;
          next.siteTagline = translated.siteTagline ?? prev.siteTagline;
          next.siteDescription = translated.siteDescription ?? prev.siteDescription;
          next.seo = {
            ...prev.seo,
            ...(translated.seo || {}),
            headerLogoFile: prev.seo.headerLogoFile,
            headerLogoPreviewUrl:
              prev.seo.headerLogoPreviewUrl ||
              translated.seo?.headerLogoUrl ||
              prev.seo.headerLogoUrl ||
              "",
            defaultOgImageFile: prev.seo.defaultOgImageFile,
            defaultOgImagePreviewUrl: prev.seo.defaultOgImagePreviewUrl,
          };
          break;
        case "contact":
          next.contact = {
            ...prev.contact,
            ...(translated.contact || {}),
          };
          break;
        case "seo":
          next.seo = {
            ...prev.seo,
            ...(translated.seo || {}),
            defaultOgImageFile: prev.seo.defaultOgImageFile,
            defaultOgImagePreviewUrl:
              prev.seo.defaultOgImagePreviewUrl ||
              translated.seo?.defaultOgImageUrl ||
              prev.seo.defaultOgImageUrl ||
              "",
          };
          break;
        case "home":
          next.home = {
            ...prev.home,
            ...(translated.home || {}),
            highlightedIngredients:
              translated.home?.highlightedIngredients !== undefined
                ? mergeTranslatedMultilineValue(
                    prev.home.highlightedIngredients,
                    translated.home.highlightedIngredients
                  )
                : prev.home.highlightedIngredients,
          };
          break;
        case "announcement":
          next.announcement = translated.announcement ?? prev.announcement;
          break;
        case "pizzaPage":
          next.pizzaPage = {
            ...prev.pizzaPage,
            ...(translated.pizzaPage || {}),
          };
          break;
        case "blog":
          next.blog = translated.blog ?? prev.blog;
          break;
        case "contactPage":
          next.contactPage = translated.contactPage ?? prev.contactPage;
          break;
        case "order":
          next.order = translated.order ?? prev.order;
          break;
        case "footer":
          next.footer = translated.footer ?? prev.footer;
          break;
        default:
          break;
      }

      return next;
    });
  };

  const handleTranslateSection = async (sectionId) => {
    if (!token) return;

    try {
      setTranslatingSectionId(sectionId);
      setMessage("");
      const translated = await translateSiteSettingsToEnglish(token, getSectionPayload(sectionId));
      mergeTranslatedSection(sectionId, translated);
      setMessage(
        tr(
          "Traduction anglaise générée pour cette section.",
          "English translation generated for this section."
        )
      );
      setMessageType("success");
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr(
            "Impossible de générer la traduction anglaise.",
            "Unable to generate the English translation."
          )
      );
      setMessageType("error");
    } finally {
      setTranslatingSectionId(null);
    }
  };

  if (authLoading || loading) {
    return <p>{tr("Chargement...", "Loading...")}</p>;
  }

  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.16),_transparent_36%),linear-gradient(135deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.02))] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">
          {tr("Info site", "Site info")}
        </p>
        <h2 className="mt-2 text-3xl font-bold text-white">
          {tr("Informations globales du site", "Global site information")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
          {tr(
            "Chaque bloc s'ouvre au clic, se referme au reclique, et se sauvegarde separement pour garder une administration claire.",
            "Each block opens on click, closes when clicked again, and saves independently for a cleaner admin expérience."
          )}
        </p>
      </header>

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackClassName}`}>{message}</div>
      ) : null}

      <div className="space-y-6">
        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.identity = node;
          }}
          eyebrow={tr("Identite", "Identity")}
          title={tr("Nom, baseline et description", "Name, tagline and description")}
          description={tr(
            "Base du site et de plusieurs zones SEO.",
            "Base content used across the site and several SEO areas."
          )}
          isOpen={openSectionId === "identity"}
          onToggle={() => toggleSection("identity")}
          onSave={() => saveSection("identity")}
          onTranslate={() => handleTranslateSection("identity")}
          saving={savingSectionId === "identity"}
          translating={translatingSectionId === "identity"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <label className="grid gap-1 text-xs text-stone-300">
              <span>{tr("Nom du site", "Site name")}</span>
              <input
                value={form.siteName}
                onChange={(event) => updateRootField("siteName", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>

            <LocalizedField
              label={tr("Baseline", "Tagline")}
              value={form.siteTagline}
              onChange={(locale, value) => updateRootLocalized("siteTagline", locale, value)}
            />

            <LocalizedField
              label={tr("Description courte", "Short description")}
              value={form.siteDescription}
              multiline
              onChange={(locale, value) => updateRootLocalized("siteDescription", locale, value)}
            />

            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/20">
                {form.seo.headerLogoPreviewUrl || form.seo.headerLogoUrl ? (
                  <img
                    src={form.seo.headerLogoPreviewUrl || form.seo.headerLogoUrl}
                    alt={tr("Logo du site", "Site logo")}
                    className="h-40 w-full object-contain p-5"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-stone-400">
                    {tr("Aucun logo défini.", "No logo set.")}
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-xs text-stone-300">
                  <span>{tr("Uploader le logo header", "Upload header logo")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleHeaderLogoUpload(event.target.files?.[0] || null)}
                    className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-saffron file:px-3 file:py-2 file:text-xs file:font-bold file:text-charcoal"
                  />
                </label>
                <label className="grid gap-1 text-xs text-stone-300">
                  <span>{tr("URL logo actuelle", "Current logo URL")}</span>
                  <input
                    value={form.seo.headerLogoUrl}
                    onChange={(event) => {
                      updateNestedField("seo", "headerLogoUrl", event.target.value);
                      updateNestedField("seo", "headerLogoPreviewUrl", event.target.value);
                    }}
                    className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.contact = node;
          }}
          eyebrow={tr("Coordonnées", "Contact details")}
          title={tr("Infos de contact", "Contact information")}
          description={tr(
            "Coordonnées visibles sur le site et dans la page contact.",
            "Contact details shown across the site and on the contact page."
          )}
          isOpen={openSectionId === "contact"}
          onToggle={() => toggleSection("contact")}
          onSave={() => saveSection("contact")}
          onTranslate={() => handleTranslateSection("contact")}
          saving={savingSectionId === "contact"}
          translating={translatingSectionId === "contact"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-xs text-stone-300">
              <span>{tr("Telephone", "Phone")}</span>
              <input
                type="tel"
                value={form.contact.phone}
                onChange={(event) => updateNestedField("contact", "phone", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-stone-300">
              <span>Email</span>
              <input
                type="email"
                value={form.contact.email}
                onChange={(event) => updateNestedField("contact", "email", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-stone-300 lg:col-span-2">
              <span>{tr("Adresse affichee", "Displayed address")}</span>
              <input
                value={form.contact.address}
                onChange={(event) => updateNestedField("contact", "address", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-stone-300 lg:col-span-2">
              <span>{tr("Lien Google Maps", "Google Maps link")}</span>
              <input
                type="url"
                value={form.contact.mapsUrl}
                onChange={(event) => updateNestedField("contact", "mapsUrl", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-4">
            <LocalizedField
              label={tr("Zone desservie", "Service area")}
              value={form.contact.serviceArea}
              onChange={(locale, value) =>
                setForm((prev) => ({
                  ...prev,
                  contact: {
                    ...prev.contact,
                    serviceArea: {
                      ...prev.contact.serviceArea,
                      [locale]: value,
                    },
                  },
                }))
              }
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.social = node;
          }}
          eyebrow={tr("Reseaux", "Social media")}
          title={tr("Liens publics", "Public links")}
          description={tr(
            "Liens utilises dans la page contact et les zones de confiance.",
            "Links used in the contact page and trust areas."
          )}
          isOpen={openSectionId === "social"}
          onToggle={() => toggleSection("social")}
          onSave={() => saveSection("social")}
          saving={savingSectionId === "social"}
          translating={false}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-1 text-xs text-stone-300">
              <span>Instagram</span>
              <input
                type="url"
                value={form.social.instagramUrl}
                onChange={(event) => updateNestedField("social", "instagramUrl", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-stone-300">
              <span>Facebook</span>
              <input
                type="url"
                value={form.social.facebookUrl}
                onChange={(event) => updateNestedField("social", "facebookUrl", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-stone-300">
              <span>TikTok</span>
              <input
                type="url"
                value={form.social.tiktokUrl}
                onChange={(event) => updateNestedField("social", "tiktokUrl", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.seo = node;
          }}
          eyebrow={tr("SEO global", "Global SEO")}
          title={tr("Meta par defaut", "Default metadata")}
          description={tr(
            "Meta title, meta description, image de partage et URL canonique.",
            "Meta title, meta description, sharing image and canonical URL."
          )}
          isOpen={openSectionId === "seo"}
          onToggle={() => toggleSection("seo")}
          onSave={() => saveSection("seo")}
          onTranslate={() => handleTranslateSection("seo")}
          saving={savingSectionId === "seo"}
          translating={translatingSectionId === "seo"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Meta title par defaut", "Default meta title")}
              value={form.seo.defaultMetaTitle}
              onChange={(locale, value) => updateNestedLocalized("seo", "defaultMetaTitle", locale, value)}
            />

            <LocalizedField
              label={tr("Meta description par defaut", "Default meta description")}
              value={form.seo.defaultMetaDescription}
              multiline
              onChange={(locale, value) =>
                updateNestedLocalized("seo", "defaultMetaDescription", locale, value)
              }
            />

            <label className="grid gap-1 text-xs text-stone-300">
              <span>{tr("URL canonique du site", "Canonical site URL")}</span>
              <input
                type="url"
                value={form.seo.canonicalSiteUrl}
                onChange={(event) => updateNestedField("seo", "canonicalSiteUrl", event.target.value)}
                className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/20">
                {form.seo.defaultOgImagePreviewUrl || form.seo.defaultOgImageUrl ? (
                  <img
                    src={form.seo.defaultOgImagePreviewUrl || form.seo.defaultOgImageUrl}
                    alt={tr("Image de partage", "Sharing image")}
                    className="h-48 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-stone-400">
                    {tr("Aucune image définie.", "No image set.")}
                  </div>
                )}
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-xs text-stone-300">
                  <span>{tr("Uploader l'image de partage", "Upload sharing image")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleOgImageUpload(event.target.files?.[0] || null)}
                    className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-saffron file:px-3 file:py-2 file:text-xs file:font-bold file:text-charcoal"
                  />
                </label>
                <label className="grid gap-1 text-xs text-stone-300">
                  <span>{tr("URL image actuelle", "Current image URL")}</span>
                  <input
                    value={form.seo.defaultOgImageUrl}
                    onChange={(event) => {
                      updateNestedField("seo", "defaultOgImageUrl", event.target.value);
                      updateNestedField("seo", "defaultOgImagePreviewUrl", event.target.value);
                    }}
                    className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                  />
                </label>
              </div>
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.home = node;
          }}
          eyebrow={tr("Accueil", "Home")}
          title={tr("Hero et reassurance", "Hero and reassurance")}
          description={tr(
            "Textes principaux de la page d'accueil.",
            "Main copy for the home page."
          )}
          isOpen={openSectionId === "home"}
          onToggle={() => toggleSection("home")}
          onSave={() => saveSection("home")}
          onTranslate={() => handleTranslateSection("home")}
          saving={savingSectionId === "home"}
          translating={translatingSectionId === "home"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Titre hero", "Hero title")}
              value={form.home.heroTitle}
              onChange={(locale, value) => updateNestedLocalized("home", "heroTitle", locale, value)}
            />
            <LocalizedField
              label={tr("Sous-titre hero", "Hero subtitle")}
              value={form.home.heroSubtitle}
              multiline
              onChange={(locale, value) => updateNestedLocalized("home", "heroSubtitle", locale, value)}
            />
            <LocalizedField
              label={tr("Bouton principal", "Primary button")}
              value={form.home.primaryCtaLabel}
              onChange={(locale, value) =>
                updateNestedLocalized("home", "primaryCtaLabel", locale, value)
              }
            />
            <LocalizedField
              label={tr("Bouton secondaire", "Secondary button")}
              value={form.home.secondaryCtaLabel}
              onChange={(locale, value) =>
                updateNestedLocalized("home", "secondaryCtaLabel", locale, value)
              }
            />
            <LocalizedField
              label={tr("Texte de reassurance", "Reassurance text")}
              value={form.home.reassuranceText}
              onChange={(locale, value) =>
                updateNestedLocalized("home", "reassuranceText", locale, value)
              }
            />
            <div className="grid gap-3">
              <p className="text-xs text-stone-300">
                {tr(
                  "Ingrédients mis en avant Accueil",
                  "Highlighted home ingredients"
                )}
              </p>
              <HighlightedIngredientsManager
                items={highlightedIngredients}
                pendingValue={highlightedIngredientDraft}
                isAdding={isAddingHighlightedIngredient}
                onPendingChange={setHighlightedIngredientDraft}
                onStartAdd={handleStartAddHighlightedIngredient}
                onConfirmAdd={handleConfirmAddHighlightedIngredient}
                onCancelAdd={handleCancelAddHighlightedIngredient}
                onRemove={handleRemoveHighlightedIngredient}
                tr={tr}
              />
            </div>
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.pizzaPage = node;
          }}
          eyebrow={tr("Page pizza", "Pizza page")}
          title={tr("Produits mis en avant", "Featured products")}
          description={tr(
            "Choisissez les produits et le texte à afficher sur la page /pizza.",
            "Choose products and text to display on the /pizza page."
          )}
          isOpen={openSectionId === "pizzaPage"}
          onToggle={() => toggleSection("pizzaPage")}
          onSave={() => saveSection("pizzaPage")}
          onTranslate={() => handleTranslateSection("pizzaPage")}
          saving={savingSectionId === "pizzaPage"}
          translating={translatingSectionId === "pizzaPage"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-3">
            <LocalizedField
              label={tr("Titre du paragraphe", "Paragraph title")}
              value={form.pizzaPage.sectionTitle}
              onChange={(locale, value) =>
                updateNestedLocalized("pizzaPage", "sectionTitle", locale, value)
              }
            />
            <LocalizedField
              label={tr("Contenu du paragraphe", "Paragraph content")}
              value={form.pizzaPage.sectionDescription}
              multiline
              onChange={(locale, value) =>
                updateNestedLocalized("pizzaPage", "sectionDescription", locale, value)
              }
            />
            <p className="text-xs text-stone-300">
              {tr(
                "Activez les produits à mettre en avant. L'ordre de sélection est conservé.",
                "Enable products to feature. Selection order is preserved."
              )}
            </p>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-stone-300">
              {tr("Sélectionnées", "Selected")}: {featuredPizzaProductIds.length}
            </div>

            {loadingProducts ? (
              <p className="text-sm text-stone-300">{tr("Chargement...", "Loading...")}</p>
            ) : selectableProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 px-4 py-4 text-sm text-stone-400">
                {tr("Aucun produit détecté.", "No products detected.")}
              </div>
            ) : (
              <div className="grid gap-2">
                {selectableProducts.map((product) => {
                  const isChecked = featuredPizzaProductIds.some(
                    (entry) => Number(entry) === Number(product.id)
                  );
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-charcoal/40 px-3 py-2 text-sm text-stone-100"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-100">
                        {product.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFeaturedPizzaProduct(product.id)}
                        aria-pressed={isChecked}
                        className={`inline-flex min-w-[74px] items-center justify-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                          isChecked
                            ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                            : "border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        }`}
                      >
                        {isChecked ? tr("Actif", "On") : tr("Inactif", "Off")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.announcement = node;
          }}
          eyebrow={tr("Annonce", "Announcement")}
          title={tr("Bandeau public", "Public banner")}
          description={tr(
            "Message ponctuel affiche en haut du site.",
            "Temporary message displayed at the top of the site."
          )}
          isOpen={openSectionId === "announcement"}
          onToggle={() => toggleSection("announcement")}
          onSave={() => saveSection("announcement")}
          onTranslate={() => handleTranslateSection("announcement")}
          saving={savingSectionId === "announcement"}
          translating={translatingSectionId === "announcement"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100">
              <input
                type="checkbox"
                checked={form.announcement.enabled}
                onChange={(event) => updateNestedField("announcement", "enabled", event.target.checked)}
              />
              <span>{tr("Activer le bandeau", "Enable banner")}</span>
            </label>

            {form.announcement.enabled ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <label className="grid gap-1 text-xs text-stone-300">
                    <span>{tr("Type", "Type")}</span>
                    <select
                      value={form.announcement.variant}
                      onChange={(event) => updateNestedField("announcement", "variant", event.target.value)}
                      className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                    >
                      <option value="info">{tr("Nouveau", "New")}</option>
                      <option value="alert">{tr("Important", "Important")}</option>
                      <option value="success">{tr("Offres", "Offers")}</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-stone-300">
                    <span>{tr("Lien du bandeau", "Banner link")}</span>
                    <input
                      value={form.announcement.linkUrl}
                      onChange={(event) => updateNestedField("announcement", "linkUrl", event.target.value)}
                      className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                    />
                  </label>
                </div>

                <LocalizedField
                  label={tr("Texte du bandeau", "Banner text")}
                  value={form.announcement.text}
                  multiline
                  onChange={(locale, value) =>
                    updateNestedLocalized("announcement", "text", locale, value)
                  }
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 px-4 py-4 text-sm text-stone-400">
                {tr(
                  "Bandeau désactivé. Activez-le pour définir son type, son lien et son texte.",
                  "Banner disabled. Enable it to define its type, link and message."
                )}
              </div>
            )}
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.blog = node;
          }}
          eyebrow={tr("Blog", "Blog")}
          title={tr("Introduction du blog", "Blog introduction")}
          description={tr(
            "Textes d'introduction visibles sur la page blog.",
            "Introductory texts displayed on the blog page."
          )}
          isOpen={openSectionId === "blog"}
          onToggle={() => toggleSection("blog")}
          onSave={() => saveSection("blog")}
          onTranslate={() => handleTranslateSection("blog")}
          saving={savingSectionId === "blog"}
          translating={translatingSectionId === "blog"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Titre blog", "Blog title")}
              value={form.blog.introTitle}
              onChange={(locale, value) => updateNestedLocalized("blog", "introTitle", locale, value)}
            />
            <LocalizedField
              label={tr("Texte d'introduction", "Intro text")}
              value={form.blog.introText}
              multiline
              onChange={(locale, value) => updateNestedLocalized("blog", "introText", locale, value)}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.contactPage = node;
          }}
          eyebrow={tr("Contact", "Contact")}
          title={tr("Page contact", "Contact page")}
          description={tr(
            "Textes d'introduction de la page contact.",
            "Introductory text for the contact page."
          )}
          isOpen={openSectionId === "contactPage"}
          onToggle={() => toggleSection("contactPage")}
          onSave={() => saveSection("contactPage")}
          onTranslate={() => handleTranslateSection("contactPage")}
          saving={savingSectionId === "contactPage"}
          translating={translatingSectionId === "contactPage"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Titre de page", "Page title")}
              value={form.contactPage.pageTitle}
              onChange={(locale, value) =>
                updateNestedLocalized("contactPage", "pageTitle", locale, value)
              }
            />
            <LocalizedField
              label={tr("Texte principal", "Main text")}
              value={form.contactPage.introText}
              multiline
              onChange={(locale, value) =>
                updateNestedLocalized("contactPage", "introText", locale, value)
              }
            />
            <LocalizedField
              label={tr("Texte secondaire", "Secondary text")}
              value={form.contactPage.helperText}
              multiline
              onChange={(locale, value) =>
                updateNestedLocalized("contactPage", "helperText", locale, value)
              }
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.order = node;
          }}
          eyebrow={tr("Commande", "Ordering")}
          title={tr("Messages du parcours commande", "Order flow messages")}
          description={tr(
            "Petits textes de guidage dans la commande.",
            "Short guidance texts inside the order flow."
          )}
          isOpen={openSectionId === "order"}
          onToggle={() => toggleSection("order")}
          onSave={() => saveSection("order")}
          onTranslate={() => handleTranslateSection("order")}
          saving={savingSectionId === "order"}
          translating={translatingSectionId === "order"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Texte aide retrait", "Pickup help text")}
              value={form.order.pickupIntroText}
              multiline
              onChange={(locale, value) => updateNestedLocalized("order", "pickupIntroText", locale, value)}
            />
            <LocalizedField
              label={tr("Texte confirmation", "Confirmation text")}
              value={form.order.pickupConfirmationText}
              multiline
              onChange={(locale, value) =>
                updateNestedLocalized("order", "pickupConfirmationText", locale, value)
              }
            />
          </div>
        </AccordionSection>

        <AccordionSection
          sectionRef={(node) => {
            sectionRefs.current.footer = node;
          }}
          eyebrow={tr("Footer", "Footer")}
          title={tr("Pied de page", "Footer")}
          description={tr(
            "Textes visibles en bas du site.",
            "Texts displayed at the bottom of the site."
          )}
          isOpen={openSectionId === "footer"}
          onToggle={() => toggleSection("footer")}
          onSave={() => saveSection("footer")}
          onTranslate={() => handleTranslateSection("footer")}
          saving={savingSectionId === "footer"}
          translating={translatingSectionId === "footer"}
          saveLabel={saveButtonLabel}
        >
          <div className="grid gap-4">
            <LocalizedField
              label={tr("Texte principal", "Main text")}
              value={form.footer.shortText}
              multiline
              onChange={(locale, value) => updateNestedLocalized("footer", "shortText", locale, value)}
            />
            <LocalizedField
              label={tr("Texte legal court", "Short legal text")}
              value={form.footer.legalText}
              multiline
              onChange={(locale, value) => updateNestedLocalized("footer", "legalText", locale, value)}
            />
            <LocalizedField
              label={tr("Copyright", "Copyright")}
              value={form.footer.copyright}
              onChange={(locale, value) => updateNestedLocalized("footer", "copyright", locale, value)}
            />
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}
