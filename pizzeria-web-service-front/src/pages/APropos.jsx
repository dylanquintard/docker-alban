import { Link } from "react-router-dom";
import PageFaqSection from "../components/common/PageFaqSection";
import PublicReviewsSection from "../components/reviews/PublicReviewsSection";
import SeoHead from "../components/seo/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { buildBaseFoodEstablishmentJsonLd } from "../seo/jsonLd";
import { DEFAULT_SITE_SETTINGS } from "../site/siteSettings";

export default function APropos() {
  const { tr } = useLanguage();
  const { settings } = useSiteSettings();
  const companyName = settings.siteName || DEFAULT_SITE_SETTINGS.siteName;
  const title = tr(
    `À propos | ${companyName}, camion pizza napolitaine en Moselle`,
    `About | ${companyName}, Neapolitan pizza truck in Moselle`
  );
  const description = tr(
    `${companyName} est un camion pizza en Moselle, actif autour de Thionville et des communes voisines, avec une carte courte, une cuisson bois-gaz et un retrait organise.`,
    `${companyName} is a pizza truck in Moselle, active around Thionville and nearby towns, with a focused menu, wood-gas baking and organized pickup.`
  );
  const canonicalSiteUrl = String(settings.seo?.canonicalSiteUrl || "").trim();
  const defaultOgImageUrl = String(settings.seo?.defaultOgImageUrl || "").trim();
  const menuUrl = canonicalSiteUrl ? `${canonicalSiteUrl.replace(/\/+$/, "")}/menu` : "/menu";
  const socialUrls = [
    settings.social?.instagramUrl,
    settings.social?.facebookUrl,
    settings.social?.tiktokUrl,
  ].filter(Boolean);
  const aboutJsonLd = [
    buildBaseFoodEstablishmentJsonLd({
      pagePath: "/a-propos",
      pageName: title,
      description,
      siteName: companyName,
      siteUrl: canonicalSiteUrl || undefined,
      phone: settings.contact?.phone,
      email: settings.contact?.email,
      address: settings.contact?.address,
      mapUrl: settings.contact?.mapsUrl,
      image: defaultOgImageUrl,
      socialUrls,
      areaServed: ["Moselle", "Thionville"],
      extra: {
        "@type": "FoodTruck",
        hasMenu: menuUrl,
      },
    }),
  ].filter(Boolean);

  return (
    <div className="section-shell space-y-8 pb-20 pt-10">
      <SeoHead
        title={title}
        description={description}
        pathname="/a-propos"
        jsonLd={aboutJsonLd}
      />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-saffron">{tr("À propos", "About")}</p>
        <h1 className="font-display text-4xl uppercase tracking-wide text-white sm:text-5xl">
          {tr(
            `${companyName}, un camion pizza pense pour bien servir la Moselle`,
            `${companyName}, a pizza truck built to serve Moselle well`
          )}
        </h1>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr(
            `${companyName} est une structure mobile qui travaille la pizza avec une logique simple: une pâte préparée serieusement, une cuisson vive et un service organise pour le retrait.`,
            `${companyName} is a mobile setup built around a simple idea: serious dough work, lively baking and a service designed for smooth pickup.`
          )}
        </p>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr(
            "Le camion se déplace chaque semaine autour de Thionville et dans d autres communes de Moselle pour proposer une offre plus nette que la restauration rapide standard.",
            "The truck moves every week around Thionville and across other towns in Moselle to offer something sharper than standard fast food."
          )}
        </p>
        <p className="max-w-3xl text-sm text-stone-300 sm:text-base">
          {tr(
            "L objectif n est pas d en faire trop. Il est de sortir une pizza reguliere, chaude et bien tenue au moment ou le client la reçupere.",
            "The goal is not to overdo it. The goal is to serve a consistent, hot pizza that still holds together when the customer picks it up."
          )}
        </p>
        <Link
          to="/planing"
          className="inline-flex rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
        >
          {tr("Voir les emplacements et horaires", "See locations and opening hours")}
        </Link>
      </header>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white">{tr("Une presence mobile, pas un point fixe", "A mobile setup, not a fixed shop")}</h2>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Le camion n est pas pense comme une simple version roulante d une pizzeria classique. Le format mobile impose un autre rythme, une autre organisation et une autre lecture du service.",
            "The truck is not just a rolling version of a classic pizzeria. The mobile format requires a different pace, a different organization and a different service flow."
          )}
        </p>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "La tournée permet de venir au plus pres des clients, sans sacrifier la cuisson minute ni la qualité de sortie du four.",
            "The weekly route brings the truck closer to customers without sacrificing last-minute baking or the quality coming out of the oven."
          )}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-300">
          <li>{tr("passages hebdomadaires en Moselle", "weekly stops across Moselle")}</li>
          <li>{tr("secteurs proches de Thionville et de la Moselle", "areas around Thionville and Moselle")}</li>
          <li>{tr("retrait direct sur les points annonces dans le planning", "direct pickup at the stops announced in the schedule")}</li>
        </ul>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white">{tr("Une inspiration napolitaine prise au serieux", "A serious Neapolitan influence")}</h2>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "La reference napolitaine ne sert pas ici d emballage marketing. Elle guide surtout la maniere de travailler la pâte, de doser la garniture et de gerer le four.",
            "The Neapolitan reference is not just marketing here. It mainly shapes how the dough is made, how toppings are balanced and how the oven is managed."
          )}
        </p>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Cela passe par une pâte souple, une cuisson courte, une bordure bien developpee et une recette qui reste lisible jusqu a la derniere bouchee.",
            "That means supple dough, a short bake, a well-developed crust and a recipe that stays clear through the last bite."
          )}
        </p>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Le but n est pas de reproduire un folklore. Le but est de garder un produit coherent, bien execute et regulier.",
            "The aim is not to imitate folklore. The aim is to keep the product coherent, well-executed and consistent."
          )}
        </p>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white">{tr("Une pâte préparée pour tenir le service", "Dough prepared to handle service")}</h2>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "La qualité d une pizza commence longtemps avant la cuisson. La pâte est préparée en amont pour gagner en souplesse, en regularite et en confort de degustation.",
            "The quality of a pizza starts long before baking. The dough is prepared ahead of time to improve flexibility, consistency and eating comfort."
          )}
        </p>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Cette methode permet de garder un meilleur equilibre entre legerete, tenue et reactivite au four.",
            "This method helps keep a better balance between lightness, structure and oven response."
          )}
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-300">
          <li>{tr("texture plus aerienne", "lighter texture")}</li>
          <li>{tr("faconnage plus stable", "more stable shaping")}</li>
          <li>{tr("meilleure regularite pendant la tournée", "better consistency during service")}</li>
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="glass-panel p-6">
          <h2 className="text-xl font-bold text-white">{tr("Une carte courte pour mieux tenir la qualité", "A focused menu to protect quality")}</h2>
          <p className="mt-3 text-sm text-stone-300">
            {tr(
              "Une carte trop large fatigue la production et brouille le produit. Ici, le choix est inverse.",
              "A menu that is too large weakens production and blurs the product. Here, the choice goes the other way."
            )}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-300">
            <li>{tr("produits italiens sélectionnés pour leur tenue", "Italian products selected for their consistency")}</li>
            <li>{tr("recettes construites avec plus de retenue", "recipes built with more restraint")}</li>
            <li>{tr("execution plus fiable d un service a l autre", "more reliable execution from one service to the next")}</li>
          </ul>
        </article>
        <article className="glass-panel p-6">
          <h2 className="text-xl font-bold text-white">{tr("Un retrait simple a suivre", "A simple pickup flow")}</h2>
          <p className="mt-3 text-sm text-stone-300">
            {tr(
              "Le fonctionnement par créneaux permet de mieux organiser la cuisson et de limiter l attente autour du camion.",
              "The timeslot system helps organize baking and reduce waiting time around the truck."
            )}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-300">
            <li>{tr("Choisissez votre pizza", "Choose your pizza")}</li>
            <li>{tr("Sélectionnez votre créneau", "Select your timeslot")}</li>
            <li>{tr("Recuperez la commande directement au camion", "Pick up your order directly at the truck")}</li>
          </ol>
          <p className="mt-3 text-sm text-stone-300">
            {tr(
              "Ce format protege a la fois le rythme du service et la qualité de la pizza remise au client.",
              "This format protects both the service rhythm and the quality of the pizza handed to the customer."
            )}
          </p>
        </article>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white">{tr("Où trouver le camion en Moselle ?", "Where can you find the truck in Moselle?")}</h2>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            `${companyName} se deplace chaque semaine sur plusieurs communes de Moselle, autour de Thionville et des secteurs voisins.`,
            `${companyName} moves every week across several towns in Moselle, around Thionville and nearby areas.`
          )}
        </p>
        <p className="mt-3 text-sm text-stone-300">
          {tr(
            "Les lieux de passage et les horaires ne sont pas figes. Ils suivent la tournée publiee sur le planning.",
            "Locations and opening hours are not fixed. They follow the route published in the weekly schedule."
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/planing"
            className="rounded-full border border-saffron/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-saffron transition hover:bg-saffron/10"
          >
            {tr("Voir la tournée de la semaine", "See this week's route")}
          </Link>
          <Link
            to="/menu"
            className="rounded-full bg-saffron px-4 py-2 text-xs font-bold uppercase tracking-wide text-charcoal transition hover:bg-yellow-300"
          >
            {tr("Voir le menu", "See the menu")}
          </Link>
        </div>
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-xl font-bold text-white">{tr("Ce que les clients viennent chercher", "What customers come for")}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-300">
          <li>{tr("une pizza plus nette et moins standardisee", "a cleaner, less standardized pizza")}</li>
          <li>{tr("un retrait simple sur les points de passage", "simple pickup at each stop")}</li>
          <li>{tr("une cuisson minute qui reste reguliere", "made-to-order baking that stays consistent")}</li>
          <li>{tr("une offre mobile serieuse autour de Thionville et en Moselle", "a serious mobile offer around Thionville and across Moselle")}</li>
        </ul>
      </section>

      <PublicReviewsSection className="space-y-5" />

      <PageFaqSection
        pathname="/a-propos"
        title={tr("Questions fréquentes", "Frequently asked questions")}
      />
    </div>
  );
}
