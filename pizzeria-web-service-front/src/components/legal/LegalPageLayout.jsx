import SeoHead from "../seo/SeoHead";

export default function LegalPageLayout({
  title,
  description,
  pathname,
  eyebrow,
  pageTitle,
  intro,
  sections = [],
}) {
  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead title={title} description={description} pathname={pathname} />

      <header className="space-y-3">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-[0.25em] text-saffron">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          {pageTitle}
        </h1>
        {intro ? <p className="max-w-3xl text-sm leading-7 text-stone-300 sm:text-base">{intro}</p> : null}
      </header>

      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title} className="glass-panel p-6">
            <h2 className="text-xl font-bold text-white">{section.title}</h2>
            {(Array.isArray(section.paragraphs) ? section.paragraphs : []).map((paragraph, index) => (
              <p key={`${section.title}-${index}`} className="mt-3 text-sm leading-7 text-stone-300">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
