import { useContext, useEffect, useMemo, useState } from "react";
import {
  createFaqEntry,
  deleteFaqEntry,
  getAdminFaqEntries,
  getAdminFaqTargets,
  updateFaqEntry,
} from "../api/faq.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

function createDraftFaq(path, nextSortOrder) {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetPath: path,
    question: "",
    answer: "",
    sortOrder: nextSortOrder,
    active: true,
    isDraft: true,
  };
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function sortFaqItems(items) {
  return [...items].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder || 0);
    const rightOrder = Number(right?.sortOrder || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });
}

function resequenceFaqItems(items) {
  return sortFaqItems(items).map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

function getFaqTargetTypeLabel(type, tr) {
  switch (type) {
    case "blog":
      return tr("Article", "Article");
    case "location":
      return tr("Local", "Local");
    case "custom":
      return tr("Perso", "Custom");
    default:
      return tr("Page", "Page");
  }
}

function getFaqTargetTypeClass(type) {
  switch (type) {
    case "blog":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "location":
      return "border-sky-400/30 bg-sky-500/10 text-sky-100";
    case "custom":
      return "border-violet-400/30 bg-violet-500/10 text-violet-100";
    default:
      return "border-white/10 bg-white/5 text-stone-200";
  }
}

function summarizeAnswer(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 140) return text;
  return `${text.slice(0, 137).trim()}...`;
}

function getSecondaryButtonClassName(extra = "") {
  return `rounded-full border border-white/20 bg-black/20 text-white transition hover:bg-white/10 ${extra}`.trim();
}

function getGhostButtonClassName(extra = "") {
  return `rounded-full border border-white/15 text-stone-200 transition hover:bg-white/10 ${extra}`.trim();
}

function ensurePizzaFaqTarget(targets, tr) {
  const source = Array.isArray(targets) ? targets : [];
  const hasPizzaTarget = source.some(
    (target) => String(target?.path || "").trim().toLowerCase() === "/pizza"
  );

  if (hasPizzaTarget) {
    return source;
  }

  return [
    ...source,
    {
      path: "/pizza",
      label: tr("Nos pizzas", "Our pizzas"),
      type: "static",
      absoluteUrl: "/pizza",
      faqCount: 0,
    },
  ];
}

export default function FaqAdmin() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [targets, setTargets] = useState([]);
  const [selectedPath, setSelectedPath] = useState("/");
  const [items, setItems] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingItemId, setSavingItemId] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [openItemId, setOpenItemId] = useState(null);

  const feedbackClassName = useMemo(() => {
    if (messageType === "success") {
      return "border-emerald-300/35 bg-emerald-500/10 text-emerald-100";
    }
    if (messageType === "error") {
      return "border-red-400/35 bg-red-500/10 text-red-100";
    }
    return "border-white/10 bg-white/5 text-stone-100";
  }, [messageType]);

  const targetStats = useMemo(() => {
    return targets.reduce(
      (accumulator, target) => {
        accumulator.totalPages += 1;
        accumulator.totalFaqs += Number(target?.faqCount || 0);
        if (target?.type === "blog") accumulator.blogPages += 1;
        if (target?.type === "location") accumulator.locationPages += 1;
        return accumulator;
      },
      { totalPages: 0, totalFaqs: 0, blogPages: 0, locationPages: 0 }
    );
  }, [targets]);

  const filteredTargets = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search);
    const source = normalizedSearch
      ? targets.filter((target) => {
          const haystack = `${target.label} ${target.path} ${target.absoluteUrl}`.toLowerCase();
          return haystack.includes(normalizedSearch);
        })
      : targets;

    return [...source].sort((left, right) => {
      const typeWeight = { static: 0, location: 1, blog: 2, custom: 3 };
      const leftWeight = typeWeight[left?.type] ?? 4;
      const rightWeight = typeWeight[right?.type] ?? 4;
      if (leftWeight !== rightWeight) return leftWeight - rightWeight;
      return String(left?.path || "").localeCompare(String(right?.path || ""), "fr");
    });
  }, [search, targets]);

  const selectedTarget =
    targets.find((target) => target.path === selectedPath) || {
      path: selectedPath,
      label: selectedPath,
      absoluteUrl: selectedPath,
      faqCount: items.length,
      type: "custom",
    };

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN") return;

    let active = true;

    async function loadTargets() {
      try {
        setLoadingTargets(true);
        const data = await getAdminFaqTargets(token);
        if (!active) return;
        const nextTargets = ensurePizzaFaqTarget(
          Array.isArray(data?.targets) ? data.targets : [],
          tr
        );
        setTargets(nextTargets);
        setSelectedPath((current) => {
          if (!current && nextTargets[0]?.path) return nextTargets[0].path;
          if (current && nextTargets.some((target) => target.path === current)) return current;
          return nextTargets[0]?.path || "/";
        });
      } catch (err) {
        if (!active) return;
        setMessage(
          err?.response?.data?.error ||
            tr("Impossible de charger les pages FAQ.", "Unable to load FAQ pages.")
        );
        setMessageType("error");
      } finally {
        if (active) {
          setLoadingTargets(false);
        }
      }
    }

    loadTargets();
    return () => {
      active = false;
    };
  }, [authLoading, token, tr, user]);

  useEffect(() => {
    if (authLoading || !token || user?.role !== "ADMIN" || !selectedPath) return;

    let active = true;

    async function loadItems() {
      try {
        setLoadingItems(true);
        const data = await getAdminFaqEntries(token, selectedPath);
        if (!active) return;
        const nextItems = resequenceFaqItems(Array.isArray(data?.items) ? data.items : []);
        setItems(nextItems);
        setOpenItemId(nextItems[0]?.id || null);
      } catch (err) {
        if (!active) return;
        setItems([]);
        setOpenItemId(null);
        setMessage(
          err?.response?.data?.error ||
            tr("Impossible de charger les FAQ de cette page.", "Unable to load this page FAQ.")
        );
        setMessageType("error");
      } finally {
        if (active) {
          setLoadingItems(false);
        }
      }
    }

    loadItems();
    return () => {
      active = false;
    };
  }, [authLoading, selectedPath, token, tr, user]);

  const reloadCurrentPage = async () => {
    const [targetsData, itemsData] = await Promise.all([
      getAdminFaqTargets(token),
      getAdminFaqEntries(token, selectedPath),
    ]);
    const nextTargets = ensurePizzaFaqTarget(
      Array.isArray(targetsData?.targets) ? targetsData.targets : [],
      tr
    );
    const nextItems = resequenceFaqItems(Array.isArray(itemsData?.items) ? itemsData.items : []);
    setTargets(nextTargets);
    setItems(nextItems);
    setOpenItemId((current) =>
      nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null
    );
  };

  const updateLocalItem = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const moveItem = (itemId, direction) => {
    setItems((prev) => {
      const ordered = sortFaqItems(prev);
      const currentIndex = ordered.findIndex((item) => item.id === itemId);
      if (currentIndex < 0) return prev;

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) return prev;

      const reordered = [...ordered];
      const [movedItem] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, movedItem);
      return resequenceFaqItems(reordered);
    });
  };

  const handleAddFaq = () => {
    setItems((prev) => {
      const nextDraft = createDraftFaq(selectedPath, prev.length);
      setOpenItemId(nextDraft.id);
      return [...prev, nextDraft];
    });
  };

  const handleSaveFaq = async (item) => {
    if (!token) return;

    try {
      setSavingItemId(item.id);
      setMessage("");

      const payload = {
        targetPath: selectedPath,
        question: item.question,
        answer: item.answer,
        sortOrder: Number(item.sortOrder || 0),
        active: Boolean(item.active),
      };

      if (String(item.id).startsWith("draft-")) {
        await createFaqEntry(token, payload);
      } else {
        await updateFaqEntry(token, item.id, payload);
      }

      await reloadCurrentPage();
      setMessage(tr("FAQ enregistree.", "FAQ saved."));
      setMessageType("success");
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Impossible d'enregistrer cette FAQ.", "Unable to save this FAQ.")
      );
      setMessageType("error");
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDeleteFaq = async (item) => {
    if (String(item.id).startsWith("draft-")) {
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setOpenItemId((current) => (current === item.id ? null : current));
      return;
    }

    try {
      setDeletingItemId(item.id);
      setMessage("");
      await deleteFaqEntry(token, item.id);
      await reloadCurrentPage();
      setMessage(tr("FAQ supprimée.", "FAQ deleted."));
      setMessageType("success");
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Impossible de supprimer cette FAQ.", "Unable to delete this FAQ.")
      );
      setMessageType("error");
    } finally {
      setDeletingItemId(null);
    }
  };

  if (authLoading || loadingTargets) {
    return <p>{tr("Chargement...", "Loading...")}</p>;
  }

  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-card sm:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("FAQ", "FAQ")}</p>
        <h2 className="mt-2 text-3xl font-bold text-white">
          {tr("Questions / réponses par page", "Questions / answers by page")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
          {tr(
            "Tout se gere ici page par page. Tu choisis une URL, tu ajoutes les questions utiles, puis tu retrouves automatiquement ces FAQ sur la page concernee.",
            "Everything is managed here page by page. Pick a URL, add useful questions, then the FAQ appears automatically on the matching page."
          )}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{tr("Pages pilotees", "Managed pages")}</p>
            <p className="mt-1 text-2xl font-bold text-white">{targetStats.totalPages}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{tr("FAQ totales", "Total FAQ")}</p>
            <p className="mt-1 text-2xl font-bold text-white">{targetStats.totalFaqs}</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{tr("Pages dynamiques", "Dynamic pages")}</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {targetStats.blogPages + targetStats.locationPages}
            </p>
          </div>
        </div>
      </header>

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${feedbackClassName}`}>{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-white/10 bg-white/5 p-4">
          <label className="grid gap-2 text-xs text-stone-300">
            <span>{tr("Rechercher une page", "Search a page")}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("Accueil, blog, /pizza...", "Home, blog, /pizza...")}
              className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
            />
          </label>

          <div className="mt-4 space-y-2">
            {filteredTargets.map((target) => {
              const isActive = target.path === selectedPath;
              return (
                <button
                  key={target.path}
                  type="button"
                  onClick={() => setSelectedPath(target.path)}
                  className={`w-full rounded-[1.25rem] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-white/20 bg-black/20 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
                      : "border-white/10 bg-black/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{target.label}</p>
                      <p className="mt-1 truncate text-xs text-stone-400">{target.path}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-stone-300">
                      {target.faqCount || 0}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${getFaqTargetTypeClass(target.type)}`}
                    >
                      {getFaqTargetTypeLabel(target.type, tr)}
                    </span>
                    <span className="truncate text-[11px] text-stone-500">{target.absoluteUrl}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("Page sélectionnée", "Selected page")}</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{selectedTarget.label}</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${getFaqTargetTypeClass(selectedTarget.type)}`}
                >
                  {getFaqTargetTypeLabel(selectedTarget.type, tr)}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-stone-300">
                  {items.length} {tr("FAQ", "FAQ")}
                </span>
              </div>
              <a
                href={selectedTarget.absoluteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm text-stone-300 underline decoration-saffron/70 underline-offset-4"
              >
                {selectedTarget.absoluteUrl}
              </a>
            </div>

            <button
              type="button"
              onClick={handleAddFaq}
              className={getSecondaryButtonClassName(
                "px-5 py-3 text-xs font-bold uppercase tracking-wide"
              )}
            >
              {tr("Ajouter une FAQ", "Add FAQ")}
            </button>
          </div>

          {loadingItems ? (
            <p className="text-sm text-stone-300">{tr("Chargement des FAQ...", "Loading FAQ...")}</p>
          ) : items.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/15 bg-black/10 px-5 py-6 text-sm text-stone-300">
              {tr(
                "Aucune FAQ pour cette page pour le moment. Ajoute la première question/réponse ici.",
                "No FAQ for this page yet. Add the first question/answer here."
              )}
            </div>
          ) : null}

          <div className="space-y-4">
            {sortFaqItems(items).map((item, index, orderedItems) => {
              const isOpen = openItemId === item.id;
              const isFirst = index === 0;
              const isLast = index === orderedItems.length - 1;

              return (
                <article
                  key={item.id}
                  className={`rounded-[1.4rem] border p-4 transition sm:p-5 ${
                    isOpen
                      ? "border-white/15 bg-black/20 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenItemId((current) => (current === item.id ? null : item.id))}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/20 text-sm font-bold text-white">
                          {index + 1}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                            item.active
                              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                              : "border-white/10 bg-white/5 text-stone-300"
                          }`}
                        >
                          {item.active ? tr("Active", "Active") : tr("Inactive", "Inactive")}
                        </span>
                        {String(item.id).startsWith("draft-") ? (
                          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-100">
                            {tr("Brouillon local", "Local draft")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-base font-semibold text-white">
                        {item.question || tr("Nouvelle question a renseigner", "New question to fill in")}
                      </p>
                      {!isOpen && item.answer ? (
                        <p className="mt-2 text-sm text-stone-400">{summarizeAnswer(item.answer)}</p>
                      ) : null}
                    </div>
                    <span
                      className={`mt-1 inline-flex h-10 w-10 flex-none items-center justify-center rounded-full border text-base font-bold transition ${
                        isOpen
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/15 bg-black/20 text-white"
                      }`}
                      aria-hidden="true"
                    >
                      {isOpen ? "\u2191" : "\u2193"}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="mt-5 grid gap-4 border-t border-white/10 pt-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, "up")}
                          disabled={isFirst}
                          className={getGhostButtonClassName(
                            "px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          )}
                        >
                          {tr("Monter", "Move up")}
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, "down")}
                          disabled={isLast}
                          className={getGhostButtonClassName(
                            "px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          )}
                        >
                          {tr("Descendre", "Move down")}
                        </button>
                        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-stone-200">
                          <input
                            type="checkbox"
                            checked={Boolean(item.active)}
                            onChange={(event) => updateLocalItem(item.id, "active", event.target.checked)}
                          />
                          <span>{tr("Visible publiquement", "Visible publicly")}</span>
                        </label>
                      </div>

                      <label className="grid gap-1 text-xs text-stone-300">
                        <span>{tr("Question", "Question")}</span>
                        <input
                          value={item.question}
                          onChange={(event) => updateLocalItem(item.id, "question", event.target.value)}
                          className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                        />
                      </label>

                      <label className="grid gap-1 text-xs text-stone-300">
                        <span>{tr("Reponse", "Answer")}</span>
                        <textarea
                          rows={6}
                          value={item.answer}
                          onChange={(event) => updateLocalItem(item.id, "answer", event.target.value)}
                          className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm leading-7 text-white"
                        />
                      </label>

                      <label className="grid max-w-[180px] gap-1 text-xs text-stone-300">
                        <span>{tr("Ordre d'affichage", "Display order")}</span>
                        <input
                          type="number"
                          min="0"
                          value={item.sortOrder}
                          onChange={(event) => updateLocalItem(item.id, "sortOrder", event.target.value)}
                          className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                        />
                      </label>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleSaveFaq(item)}
                          disabled={savingItemId === item.id || deletingItemId === item.id}
                          className="rounded-full bg-saffron px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {savingItemId === item.id
                            ? tr("Sauvegarde...", "Saving...")
                            : tr("Sauvegarder", "Save")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFaq(item)}
                          disabled={savingItemId === item.id || deletingItemId === item.id}
                          className="rounded-full border border-red-400/40 bg-red-500/10 px-5 py-3 text-xs font-bold uppercase tracking-wide text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {deletingItemId === item.id
                            ? tr("Suppression...", "Deleting...")
                            : tr("Supprimer", "Delete")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
