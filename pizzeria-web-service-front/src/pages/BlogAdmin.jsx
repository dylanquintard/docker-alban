import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createBlogArticle,
  deleteBlogArticle,
  getAdminBlogArticles,
  updateBlogArticle,
} from "../api/blog.api";
import { uploadGalleryImage } from "../api/gallery.api";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { slugify } from "../utils/slugify";

function createParagraph(seed = {}) {
  return {
    id: seed.id || `paragraph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: seed.title || "",
    content: seed.content || "",
    image: seed.image?.imageUrl ? createImage(seed.image) : null,
  };
}

function createImage(seed = {}) {
  const legend = seed.caption || seed.altText || "";
  return {
    id: seed.id || `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageUrl: seed.imageUrl || "",
    altText: legend,
    caption: legend,
    file: null,
    previewUrl: seed.imageUrl || "",
  };
}

function createEmptyArticleForm() {
  return {
    title: "",
    slug: "",
    description: "",
    published: true,
    paragraphs: [createParagraph()],
  };
}

function createArticleFormFromRecord(article) {
  return {
    title: article.title || "",
    slug: article.slug || "",
    description: article.description || "",
    published: Boolean(article.published),
    paragraphs:
      Array.isArray(article.paragraphs) && article.paragraphs.length > 0
        ? article.paragraphs.map((paragraph, index) =>
            createParagraph({
              ...paragraph,
              image: paragraph.image || article.images?.[index] || null,
            })
          )
        : [createParagraph()],
  };
}

function formatArticleDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch (_err) {
    return "-";
  }
}

function validateArticleForm(form, tr) {
  if (!form.title.trim()) {
    return tr("Le titre de l'article est obligatoire.", "Article title is required.");
  }
  if (!form.description.trim()) {
    return tr("La description est obligatoire.", "Description is required.");
  }
  if (!Array.isArray(form.paragraphs) || form.paragraphs.length === 0) {
    return tr(
      "Ajoutez au moins un paragraphe a l'article.",
      "Add at least one paragraph to the article."
    );
  }

  for (const paragraph of form.paragraphs) {
    if (!paragraph.title.trim() || !paragraph.content.trim()) {
      return tr(
        "Chaque paragraphe doit avoir un titre et un contenu.",
        "Each paragraph needs a title and content."
      );
    }
  }

  for (const paragraph of form.paragraphs) {
    const hasImage = Boolean(paragraph.image?.file || String(paragraph.image?.imageUrl || "").trim());
    if (hasImage && !String(paragraph.image?.altText || paragraph.image?.caption || "").trim()) {
      return tr(
        "Chaque image doit avoir une legende d'image.",
        "Each image needs an image caption."
      );
    }
  }

  return "";
}

async function resolveParagraphImageForSave(image, token) {
  if (!image) {
    return null;
  }

  const legend = String(image.altText || image.caption || "").trim() || null;

  if (image.file) {
    const uploaded = await uploadGalleryImage(token, image.file);
    return {
      imageUrl: uploaded.imageUrl,
      altText: legend,
      caption: legend,
    };
  }

  if (!String(image.imageUrl || "").trim()) {
    return null;
  }

  return {
    imageUrl: String(image.imageUrl || "").trim(),
    altText: legend,
    caption: legend,
  };
}

async function normalizeArticlePayload(form, token) {
  return {
    title: form.title.trim(),
    slug: slugify(form.slug || form.title),
    description: form.description.trim(),
    published: Boolean(form.published),
    paragraphs: await Promise.all(
      form.paragraphs.map(async (paragraph) => ({
        title: paragraph.title.trim(),
        content: paragraph.content.trim(),
        image: await resolveParagraphImageForSave(paragraph.image, token),
      }))
    ),
  };
}

function EditorSectionTitle({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.25em] text-saffron">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-bold text-white">{title}</h3>
      {description ? <p className="mt-2 max-w-3xl text-sm text-stone-300">{description}</p> : null}
    </div>
  );
}

function getDangerButtonClassName(extra = "") {
  return `rounded-full border border-red-400/50 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 ${extra}`.trim();
}

function getSecondaryButtonClassName(extra = "") {
  return `rounded-full border border-white/20 bg-black/20 text-white transition hover:bg-white/10 ${extra}`.trim();
}

function getGhostButtonClassName(extra = "") {
  return `rounded-full border border-white/15 text-stone-200 transition hover:bg-white/10 ${extra}`.trim();
}

function ArticleEditor({
  form,
  setForm,
  onSubmit,
  onCancel,
  slugLocked,
  saving,
  submitLabel,
  title,
  subtitle,
  tr,
}) {
  const publicPathPreview = `/${form.slug || slugify(form.title || "article") || "article"}`;

  const updateTitle = (value) => {
    setForm((prev) => {
      return {
        ...prev,
        title: value,
        slug: slugLocked ? prev.slug : slugify(value),
      };
    });
  };

  const updateParagraph = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      paragraphs: prev.paragraphs.map((paragraph, paragraphIndex) =>
        paragraphIndex === index ? { ...paragraph, [field]: value } : paragraph
      ),
    }));
  };

  const addParagraph = () => {
    setForm((prev) => ({
      ...prev,
      paragraphs: [...prev.paragraphs, createParagraph()],
    }));
  };

  const removeParagraph = (index) => {
    setForm((prev) => {
      if (prev.paragraphs.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        paragraphs: prev.paragraphs.filter((_, paragraphIndex) => paragraphIndex !== index),
      };
    });
  };

  const moveParagraph = (index, direction) => {
    setForm((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.paragraphs.length) {
        return prev;
      }

      const nextParagraphs = [...prev.paragraphs];
      const [current] = nextParagraphs.splice(index, 1);
      nextParagraphs.splice(targetIndex, 0, current);

      return {
        ...prev,
        paragraphs: nextParagraphs,
      };
    });
  };

  const updateParagraphImage = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      paragraphs: prev.paragraphs.map((paragraph, paragraphIndex) =>
        paragraphIndex === index
          ? {
              ...paragraph,
              image: {
                ...(paragraph.image || createImage()),
                ...patch,
              },
            }
          : paragraph
      ),
    }));
  };

  const removeParagraphImage = (index) => {
    setForm((prev) => ({
      ...prev,
      paragraphs: prev.paragraphs.map((paragraph, paragraphIndex) =>
        paragraphIndex === index
          ? {
              ...paragraph,
              image: null,
            }
          : paragraph
      ),
    }));
  };

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-saffron">{subtitle}</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{title}</h3>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">URL publique</p>
          <code className="mt-2 block text-sm text-saffron">{publicPathPreview}</code>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1 text-xs text-stone-300">
          <span>{tr("Titre de l'article", "Article title")}</span>
          <input
            value={form.title}
            onChange={(event) => updateTitle(event.target.value)}
            className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
          />
        </label>

        <label className="grid gap-1 text-xs text-stone-300 lg:col-span-2">
          <span>{tr("Description / intro", "Description / intro")}</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            className="rounded-[1.5rem] border border-white/15 bg-charcoal/70 px-4 py-3 text-sm leading-7 text-white"
          />
        </label>
      </div>

      <label className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100">
        <input
          type="checkbox"
          checked={form.published}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, published: event.target.checked }))
          }
        />
        <span>{tr("Publier cet article sur le site", "Publish this article on the site")}</span>
      </label>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EditorSectionTitle
            eyebrow={tr("Contenu", "Content")}
            title={tr("Paragraphes", "Paragraphs")}
            description={tr(
              "Chaque bloc devient une section de l'article avec son titre et son contenu.",
              "Each block becomes an article section with its own title and content."
            )}
          />
          <button
            type="button"
            onClick={addParagraph}
            className={getSecondaryButtonClassName(
              "px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            )}
          >
            {tr("Ajouter un paragraphe", "Add paragraph")}
          </button>
        </div>

        {form.paragraphs.map((paragraph, index) => (
          <div
            key={paragraph.id}
            className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-saffron/35 bg-saffron/10 text-xs font-bold text-saffron">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-white">
                  {tr("Paragraphe", "Paragraph")} {index + 1}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => moveParagraph(index, "up")}
                  disabled={index === 0}
                  className={getGhostButtonClassName(
                    "px-3 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  {tr("Monter", "Move up")}
                </button>
                <button
                  type="button"
                  onClick={() => moveParagraph(index, "down")}
                  disabled={index === form.paragraphs.length - 1}
                  className={getGhostButtonClassName(
                    "px-3 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  )}
                >
                  {tr("Descendre", "Move down")}
                </button>
                <button
                  type="button"
                  onClick={() => removeParagraph(index)}
                  disabled={form.paragraphs.length === 1}
                  className={`${getDangerButtonClassName(
                    "px-3 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  )}`}
                >
                  {tr("Supprimer", "Delete")}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1 text-xs text-stone-300">
                <span>{tr("Titre du paragraphe", "Paragraph title")}</span>
                <input
                  value={paragraph.title}
                  onChange={(event) => updateParagraph(index, "title", event.target.value)}
                  className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1 text-xs text-stone-300">
                <span>{tr("Contenu", "Content")}</span>
                <textarea
                  rows={6}
                  value={paragraph.content}
                  onChange={(event) => updateParagraph(index, "content", event.target.value)}
                  className="rounded-[1.5rem] border border-white/15 bg-charcoal/70 px-4 py-3 text-sm leading-7 text-white"
                />
              </label>

              <div className="rounded-[1.25rem] border border-white/10 bg-charcoal/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {tr("Image du paragraphe", "Paragraph image")}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-stone-400">
                      {tr(
                        "Cette image s'affichera directement dans ce bloc de contenu. Une image maximum par paragraphe.",
                        "This image will appear directly inside this content block. One image max per paragraph."
                      )}
                    </p>
                  </div>

                  {paragraph.image?.imageUrl || paragraph.image?.previewUrl ? (
                    <button
                      type="button"
                      onClick={() => removeParagraphImage(index)}
                      className={getDangerButtonClassName(
                        "px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      )}
                    >
                      {tr("Retirer l'image", "Remove image")}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-black/20">
                    {paragraph.image?.previewUrl || paragraph.image?.imageUrl ? (
                      <img
                        src={paragraph.image.previewUrl || paragraph.image.imageUrl}
                        alt={
                          paragraph.image.altText ||
                          paragraph.image.caption ||
                          paragraph.title ||
                          tr("Image du paragraphe", "Paragraph image")
                        }
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-stone-400">
                        {tr("Aucune image sélectionnée.", "No image selected.")}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <label className="grid gap-1 text-xs text-stone-300">
                      <span>{tr("Uploader une image", "Upload image")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          if (!file) return;
                          const previewUrl = URL.createObjectURL(file);
                          updateParagraphImage(index, {
                            file,
                            previewUrl,
                          });
                        }}
                        className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-saffron file:px-3 file:py-2 file:text-xs file:font-bold file:text-charcoal"
                      />
                      <span className="text-[11px] leading-5 text-stone-500">
                        {tr(
                          "Import direct uniquement. Les URL externes ne sont pas utilisees ici.",
                          "Direct upload only. External image URLs are not used here."
                        )}
                      </span>
                    </label>

                    {paragraph.image?.imageUrl || paragraph.image?.previewUrl ? (
                      <label className="grid gap-1 text-xs text-stone-300">
                        <span>{tr("Legende de l'image", "Image caption")}</span>
                        <input
                          value={paragraph.image?.altText || paragraph.image?.caption || ""}
                          onChange={(event) =>
                            updateParagraphImage(index, {
                              altText: event.target.value,
                              caption: event.target.value,
                            })
                          }
                          className="rounded-2xl border border-white/15 bg-charcoal/70 px-4 py-3 text-sm text-white"
                          required
                        />
                      </label>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-xs leading-6 text-stone-400">
                        {tr(
                          "Ajoute une image pour afficher automatiquement ce visuel dans cette section de l'article.",
                          "Add an image to automatically show this visual in this article section."
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-full bg-saffron px-5 py-3 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? tr("Enregistrement...", "Saving...") : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={getSecondaryButtonClassName(
              "px-5 py-3 text-xs font-semibold uppercase tracking-wide"
            )}
          >
            {tr("Annuler", "Cancel")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function BlogAdmin() {
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const { tr } = useLanguage();

  const [articles, setArticles] = useState([]);
  const [createForm, setCreateForm] = useState(createEmptyArticleForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(createEmptyArticleForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const articleStats = useMemo(() => {
    const publishedCount = articles.filter((article) => article.published).length;
    const paragraphCount = articles.reduce(
      (total, article) => total + Number(article.paragraphCount || 0),
      0
    );
    const imageCount = articles.reduce(
      (total, article) => total + Number(article.imageCount || 0),
      0
    );

    return {
      articleCount: articles.length,
      publishedCount,
      paragraphCount,
      imageCount,
    };
  }, [articles]);

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminBlogArticles(token);
      setArticles(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Impossible de charger le blog admin.", "Unable to load admin blog.")
      );
    } finally {
      setLoading(false);
    }
  }, [token, tr]);

  useEffect(() => {
    if (authLoading) return;
    if (!token || user?.role !== "ADMIN") return;
    loadArticles();
  }, [authLoading, loadArticles, token, user]);

  const startEditing = (article) => {
    setIsCreateOpen(false);
    setEditingId(article.id);
    setEditForm(createArticleFormFromRecord(article));
    setMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(createEmptyArticleForm());
  };

  const handleCreate = async () => {
    const validationMessage = validateArticleForm(createForm, tr);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const payload = await normalizeArticlePayload(createForm, token);
      await createBlogArticle(token, payload);
      setCreateForm(createEmptyArticleForm());
      setIsCreateOpen(false);
      setMessage(tr("Article cree avec succes.", "Article created successfully."));
      await loadArticles();
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Erreur lors de la creation de l'article.", "Error while creating article.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const validationMessage = validateArticleForm(editForm, tr);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setSaving(true);
      const payload = await normalizeArticlePayload(editForm, token);
      await updateBlogArticle(token, editingId, payload);
      setMessage(tr("Article mis à jour avec succès.", "Article updated successfully."));
      cancelEditing();
      await loadArticles();
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Erreur lors de la mise à jour.", "Error while updating article.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (article) => {
    const confirmed = window.confirm(
      tr(
        `Supprimer l'article "${article.title}" ?`,
        `Delete the article "${article.title}"?`
      )
    );
    if (!confirmed) return;

    try {
      await deleteBlogArticle(token, article.id);
      if (editingId === article.id) {
        cancelEditing();
      }
      setMessage(tr("Article supprime.", "Article deleted."));
      await loadArticles();
    } catch (err) {
      setMessage(
        err?.response?.data?.error ||
          tr("Erreur lors de la suppression.", "Error while deleting article.")
      );
    }
  };

  const toggleCreatePanel = () => {
    setMessage("");
    setIsCreateOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen) {
        cancelEditing();
      }
      return nextOpen;
    });
  };

  if (authLoading) {
    return <p>{tr("Chargement...", "Loading...")}</p>;
  }

  if (!token || user?.role !== "ADMIN") {
    return <p>{tr("Accès refusé : administrateur uniquement", "Access denied: admin only")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="mt-2 text-3xl font-bold text-white">
              {tr("Creation d'articles blog", "Blog article creation")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              {tr(
                "Creez des articles avec plusieurs paragraphes, documentes vos paragraphes de photos (pas obligatoire), cependant toujours documente au moins une photo dans l'article sinon mauvais rendu. Vous pouvez modifier ces articles une fois ajoutes, le but de ces articles est creer de la visite sur le site et donc de la visibilite, voir guide SEO articles blogs pour plus d'infos.",
                "Create articles with multiple paragraphs, add photos to your paragraphs when needed, and always include at least one image in the article for a better visual result. You can edit articles after publishing them, and the goal is to bring traffic and visibility to the site. See the blog SEO guide for more details."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCreatePanel}
            className={getSecondaryButtonClassName(
              "px-5 py-3 text-xs font-bold uppercase tracking-wide"
            )}
          >
            {isCreateOpen
              ? tr("Fermer la creation", "Close creation")
              : tr("Ajouter un article", "Add article")}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
              {tr("Articles", "Articles")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{articleStats.articleCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
              {tr("Publies", "Published")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{articleStats.publishedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
              {tr("Paragraphes", "Paragraphs")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{articleStats.paragraphCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
              {tr("Images", "Images")}
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{articleStats.imageCount}</p>
          </div>
        </div>
      </header>

      {message ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-100">
          {message}
        </div>
      ) : null}

      {isCreateOpen ? (
        <ArticleEditor
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          slugLocked={false}
          saving={saving && !editingId}
          submitLabel={tr("Créer l'article", "Create article")}
          title={tr("Nouvel article", "New article")}
          subtitle={tr("Creation", "Creation")}
          tr={tr}
        />
      ) : null}

      {editingId ? (
        <ArticleEditor
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          onCancel={cancelEditing}
          slugLocked
          saving={saving && Boolean(editingId)}
          submitLabel={tr("Mettre à jour", "Update article")}
          title={tr("Edition de l'article", "Edit article")}
          subtitle={tr("Edition", "Edit")}
          tr={tr}
        />
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-saffron">
              {tr("Articles existants", "Existing articles")}
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white">
              {tr("Bibliotheque du blog", "Blog library")}
            </h3>
          </div>
          <Link
            to="/blog"
            className={getSecondaryButtonClassName(
              "px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            )}
          >
            {tr("Voir la page blog", "See blog page")}
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`blog-admin-skeleton-${index}`}
                className="animate-pulse rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
              >
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-4 h-8 w-3/4 rounded bg-white/10" />
                <div className="mt-4 h-16 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-8 text-center">
            <p className="text-sm text-stone-300">
              {tr(
                "Aucun article n'a encore ete cree.",
                "No article has been created yet."
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <article
                key={article.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
                  <div className="overflow-hidden rounded-[1.1rem] border border-white/10 bg-charcoal/40">
                    {article.featuredImage?.imageUrl ? (
                      <img
                        src={article.featuredImage.imageUrl}
                        alt={
                          article.featuredImage.altText ||
                          article.featuredImage.caption ||
                          article.title
                        }
                        className="h-full min-h-[140px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[140px] items-center justify-center px-3 text-center text-xs text-stone-400">
                        {tr("Sans visuel", "No image")}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em]">
                          <span
                            className={`rounded-full px-3 py-1 ${
                              article.published
                                ? "border border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
                                : "border border-amber-300/30 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            {article.published
                              ? tr("Publie", "Published")
                              : tr("Brouillon", "Draft")}
                          </span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-stone-300">
                            {formatArticleDate(article.updatedAt)}
                          </span>
                        </div>
                        <h4 className="mt-3 text-lg font-bold text-white">{article.title}</h4>
                      </div>

                      <code className="rounded-full border border-white/10 bg-charcoal/60 px-3 py-1 text-xs text-saffron">
                        /{article.slug}
                      </code>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-stone-300">{article.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(article)}
                        className={getSecondaryButtonClassName(
                          "px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                        )}
                      >
                        {tr("Modifier", "Edit")}
                      </button>
                      <Link
                        to={`/${article.slug}`}
                        className={getGhostButtonClassName(
                          "px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                        )}
                      >
                        {tr("Ouvrir", "Open")}
                      </Link>
                      <span
                        className="inline-flex rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-stone-400"
                      >
                        {article.paragraphCount} {tr("paragraphes", "paragraphs")}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-stone-400">
                      <span className="font-semibold text-stone-200">
                        {tr("Publie le", "Published on")}:{" "}
                      </span>
                      {formatArticleDate(article.publishedAt)}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(article)}
                        className={getDangerButtonClassName(
                          "px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                        )}
                      >
                        {tr("Supprimer", "Delete")}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
