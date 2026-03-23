export default function TrustHighlightsSection({ eyebrow, title, intro, items = [] }) {
  const normalizedItems = Array.isArray(items)
    ? items.filter((item) => item?.title && item?.text)
    : [];

  if (normalizedItems.length === 0) return null;

  return (
    <section className="section-shell space-y-6">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-sm uppercase tracking-[0.25em] text-saffron">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 font-display text-4xl uppercase tracking-wide text-white">
          {title}
        </h2>
        {intro ? <p className="mt-3 text-sm leading-7 text-stone-300 sm:text-base">{intro}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {normalizedItems.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5"
          >
            {item.kicker ? (
              <p className="text-[11px] uppercase tracking-[0.18em] text-saffron">{item.kicker}</p>
            ) : null}
            <h3 className="mt-3 text-lg font-bold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-stone-300">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
