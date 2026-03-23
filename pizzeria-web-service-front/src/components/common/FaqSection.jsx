import { useMemo, useState } from "react";

export default function FaqSection({
  title,
  items = [],
  eyebrow = "",
  intro = "",
  className = "",
}) {
  const normalizedItems = useMemo(
    () =>
      Array.isArray(items) ? items.filter((item) => item?.question && item?.answer) : [],
    [items]
  );
  const [openIndex, setOpenIndex] = useState(0);

  if (normalizedItems.length === 0) return null;

  return (
    <section className={`glass-panel p-6 sm:p-8 ${className}`.trim()}>
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-white">
        {title}
      </h2>
      {intro ? <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">{intro}</p> : null}

      <div className="mt-5 space-y-3">
        {normalizedItems.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <article
              key={`${item.question}-${index}`}
              className={`overflow-hidden rounded-[1.4rem] border transition ${
                isOpen
                  ? "border-saffron/35 bg-white/8 shadow-[0_12px_36px_rgba(0,0,0,0.16)]"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenIndex((current) => (current === index ? -1 : index))}
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border border-saffron/35 bg-saffron/10 text-xs font-bold text-saffron">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm font-semibold text-white sm:text-base">
                    {item.question}
                  </span>
                </div>
                <span
                  className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-full border text-sm transition ${
                    isOpen
                      ? "border-saffron/40 bg-saffron text-charcoal"
                      : "border-white/10 bg-black/20 text-stone-200"
                  }`}
                  aria-hidden="true"
                >
                  {isOpen ? "-" : "+"}
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-white/10 px-4 py-4 sm:px-5">
                  <p className="text-sm leading-7 text-stone-300">{item.answer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
