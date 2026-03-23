import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { getPublicFaqEntries } from "../../api/faq.api";
import { buildFaqJsonLd } from "../../seo/jsonLd";
import FaqSection from "./FaqSection";

function normalizePathname(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "/";
  const prefixed = rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
  const normalized = prefixed.replace(/\/+$/, "") || "/";
  return normalized === "/" ? "/" : normalized.toLowerCase();
}

export default function PageFaqSection({
  pathname = "",
  title = "Questions fréquentes",
  eyebrow = "",
  intro = "",
  className = "",
}) {
  const location = useLocation();
  const targetPath = useMemo(
    () => normalizePathname(pathname || location.pathname),
    [location.pathname, pathname]
  );
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadFaqs() {
      try {
        const data = await getPublicFaqEntries(targetPath);
        if (active) {
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (_err) {
        if (active) {
          setItems([]);
        }
      }
    }

    loadFaqs();
    return () => {
      active = false;
    };
  }, [targetPath]);

  const faqJsonLd = useMemo(() => buildFaqJsonLd(items), [items]);

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <>
      {faqJsonLd ? (
        <Helmet>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
        </Helmet>
      ) : null}
      <div style={{ marginTop: "2rem" }}>
        <FaqSection
          title={title}
          eyebrow={eyebrow}
          intro={intro}
          items={items}
          className={className}
        />
      </div>
    </>
  );
}
