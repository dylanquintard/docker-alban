export const DEFAULT_TOUR_CITIES = ["Thionville", "Moselle"];

const SPECIAL_CITY_PATHS = {
  moselle: "/camion-pizza-moselle",
};
export const BLOCKED_LOCAL_CITY_SLUGS = Object.freeze(["metz"]);

export const FIXED_LOCAL_CITY_SLUGS = Object.freeze(Object.keys(SPECIAL_CITY_PATHS));

export function slugifyCity(city) {
  return String(city || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getFixedCityPathBySlug(citySlug) {
  return SPECIAL_CITY_PATHS[slugifyCity(citySlug)] || "";
}

export function getCityPath(city) {
  const slug = slugifyCity(city);
  if (!slug) return "/camion-pizza-moselle";
  if (BLOCKED_LOCAL_CITY_SLUGS.includes(slug)) return "";
  return SPECIAL_CITY_PATHS[slug] || `/pizza-${slug}`;
}

export const SEO_KEYWORDS_SENTENCES = [
  "pizza napolitaine artisanale",
  "pizza napolitaine feu de bois",
  "camion pizza napolitaine",
  "pizza italienne traditionnelle",
  "pizza a emporter",
  "camion pizza thionville",
  "pizza artisanale moselle",
  "pizza feu de bois thionville",
  "pizza produits italiens",
];

export const LOCAL_PAGE_CONTENT = {
  thionville: {
    pathname: "/pizza-thionville",
    title: "Pizza napolitaine proche de Thionville | Camion pizza artisanal",
    description:
      "Camion pizza autour de Thionville: pâte travaillee, cuisson bois-gaz, carte courte et retrait organise sur les points de passage.",
    h1: "Pizza napolitaine artisanale autour de Thionville",
    intro:
      "Autour de Thionville, le camion propose une pizza d inspiration napolitaine pensee pour le retrait: une pâte souple, une cuisson vive et des recettes tenues sans surcharge.",
    sections: [
      {
        heading: "Une execution plus serieuse qu un simple effet de style",
        paragraphs: [
          "La base repose sur une fermentation préparée en amont et une cuisson minute au camion, afin de garder une pizza souple, lisible et reguliere.",
          "Les produits restent volontairement choisis avec retenue: farine Nuvola Super, tomates San Marzano, mozzarella fior di latte, parmigiano reggiano et quelques charcuteries italiennes selon les recettes.",
        ],
      },
      {
        heading: "Des passages organises autour de Thionville",
        paragraphs: [
          "Le camion se deplace sur plusieurs points de passage autour de Thionville selon le planning de la semaine.",
          "Les adresses et horaires varient en fonction de la tournée publiee. Le principe reste simple: commande, créneau, puis retrait sur place.",
        ],
      },
      {
        heading: "Un format pense pour le retrait sans perte de qualité",
        paragraphs: [
          "Le service est entierement tourne vers l emporter pour garder un rythme fluide et une cuisson bien cadree.",
          "Vous pouvez commander en ligne ou sur place selon disponibilite, puis reçuperer votre pizza chaude au moment prevu.",
        ],
      },
    ],
  },
  moselle: {
    pathname: "/camion-pizza-moselle",
    title: "Camion pizza en Moselle | Pizza napolitaine artisanale",
    description:
      "Camion pizza en Moselle: carte courte, cuisson vive et passages hebdomadaires autour de Thionville et des communes voisines.",
    h1: "Camion pizza en Moselle",
    intro:
      "Le camion circule dans plusieurs communes de Moselle avec une offre construite pour l emporter: une pâte tenue, un four bois-gaz et un retrait simple a suivre.",
    sections: [
      {
        heading: "Une tournée locale plutot qu un point fixe",
        paragraphs: [
          "La tournée passe par differents points autour de Thionville et d autres communes voisines selon la semaine.",
          "Les emplacements et horaires sont mis à jour regulierement pour rendre la commande et le retrait faciles a suivre.",
        ],
      },
      {
        heading: "Une carte courte, plus facile a tenir",
        paragraphs: [
          "Chaque pizza est préparée a la commande avec une base de produits italiens sélectionnés et une construction volontairement lisible.",
          "Le format camion aide a garder un service plus fluide, une cuisson plus reguliere et un retrait plus rapide.",
        ],
      },
      {
        heading: "Un fonctionnement simple pour commander",
        paragraphs: [
          "Commande en ligne ou sur place selon disponibilite, puis retrait dans le créneau choisi.",
          "L objectif reste le meme: une pizza chaude, bien cuite et remise sans attente inutile.",
        ],
      },
    ],
  },
};

function withCity(text, city) {
  return String(text || "").replaceAll("{city}", city);
}

function hashToIndex(value, modulo) {
  if (!modulo || modulo <= 0) return 0;

  let hash = 0;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 2147483647;
  }

  return Math.abs(hash) % modulo;
}

const DYNAMIC_CITY_VARIANTS = [
  {
    title: "Pizza napolitaine {city} | Camion pizza artisanal",
    h1: "Pizza napolitaine artisanale {city}",
    description:
      "Camion pizza a {city}: recettes d inspiration napolitaine, cuisson bois-gaz et retrait organise sur les passages de la semaine.",
    intro: [
      "Vous cherchez une pizza a {city} sans tomber sur une offre standardisee ?",
      "Le camion propose une pizza d inspiration napolitaine avec une pâte préparée en amont, une cuisson vive et des recettes volontairement lisibles.",
      "Le four bois-gaz permet de garder une sortie de cuisson rapide et reguliere, adaptee au retrait.",
      "Les passages a {city} dependent du planning en ligne et des points de retrait ouverts sur la semaine.",
    ],
    sections: [
      {
        heading: "Une pizza construite autour de peu d ingredients, mais bien tenus",
        paragraphs: [
          "La carte repose sur quelques produits reperes pour leur regularite: farine Nuvola Super, tomates San Marzano, mozzarella fior di latte, parmigiano reggiano et, selon les recettes, des charcuteries italiennes.",
          "La pâte est travaillee pour rester souple, aerienne et facile a lire en bouche.",
          "Le resultat cherche davantage l equilibre que la surcharge.",
        ],
      },
      {
        heading: "Le camion pizza {city} et la tournée active",
        paragraphs: [
          "Le camion dessert regulierement {city}, mais pas en point fixe permanent.",
          "Les emplacements changent selon la tournée hebdomadaire et les points de retrait ouverts.",
          "Chaque pizza est préparée sur place pour garder une qualité stable jusqu a la remise.",
        ],
      },
      {
        heading: "Un format pense pour l emporter autour de {city}",
        paragraphs: [
          "Les pizzas sont disponibles uniquement a emporter directement au camion.",
          "Chaque commande est lancee pour le retrait afin de remettre une pizza chaude, cuite minute et prête a repartir.",
        ],
      },
    ],
  },
  {
    title: "Pizza artisanale {city} | Camion pizza napolitain",
    h1: "Pizza italienne artisanale {city}",
    description:
      "Pizza artisanale {city}: pâte préparée avec soin, produits sélectionnés et cuisson bois-gaz pour le retrait.",
    intro: [
      "Le camion pizza dessert {city} avec une carte artisanale inspiree des codes napolitains, sans chercher l effet de catalogue.",
      "Chaque pizza est préparée avec une pâte maison et des produits choisis pour leur tenue au four comme pour leur gout.",
      "La cuisson bois-gaz donne une pizza souple, vive et plus nette a la degustation.",
    ],
    sections: [
      {
        heading: "Une base de travail claire et sans surcharge",
        paragraphs: [
          "La pâte suit un protocole de fermentation qui privilegie la souplesse et une bordure bien ouverte.",
          "Les ingredients restent simples, mais choisis avec rigueur: tomates San Marzano, mozzarella fior di latte, parmigiano reggiano et huile d olive selon les recettes.",
          "Cette sobriete donne une pizza plus lisible qu une recette surchargee.",
        ],
      },
      {
        heading: "Le camion pizza {city} et le planning",
        paragraphs: [
          "Le camion pizza passe a {city} selon le planning hebdomadaire publie.",
          "Les points de retrait peuvent varier, mais l objectif reste identique: servir une pizza préparée sur place, dans un format simple a reçuperer.",
        ],
      },
      {
        heading: "Une pizza a emporter lancee au bon moment",
        paragraphs: [
          "Chaque pizza est préparée au moment de la commande pour rester au plus juste sur la cuisson et la remise.",
          "Le service est uniquement a emporter directement au camion.",
        ],
      },
    ],
  },
  {
    title: "Pizza feu de bois {city} | Camion pizza",
    h1: "Pizza feu de bois artisanale {city}",
    description:
      "Pizza feu de bois {city}: cuisson vive, produits bien choisis et retrait direct au camion.",
    intro: [
      "A {city}, le camion propose des pizzas cuites dans un four bois-gaz pour garder une cuisson rapide et une pâte plus aerienne.",
      "Le travail ne se limite pas a la flamme: il repose aussi sur une pâte bien tenue et des recettes qui restent lisibles.",
      "Chaque pizza est préparée sur place au moment du service.",
    ],
    sections: [
      {
        heading: "Des ingredients choisis pour tenir la cuisson",
        paragraphs: [
          "La qualité d une pizza vient autant de la cuisson que de la tenue des produits au four.",
          "La base de travail inclut notamment farine Nuvola Super, tomates San Marzano, mozzarella fior di latte et parmigiano reggiano.",
          "L objectif est de garder un gout clair, pas de multiplier les ingredients sans necessite.",
        ],
      },
      {
        heading: "Le camion pizza et la tournée {city}",
        paragraphs: [
          "Le camion pizza se deplace a {city} selon les emplacements definis dans le planning.",
          "Les pizzas sont préparées directement au camion afin de garder une sortie de four propre et fraiche.",
        ],
      },
      {
        heading: "Retrait pizza {city}",
        paragraphs: [
          "Les pizzas sont disponibles uniquement a emporter.",
          "Le retrait se fait directement au camion lors du passage a {city}, sur créneau quand la commande est anticipee.",
        ],
      },
    ],
  },
  {
    title: "Camion pizza {city} | Pizza napolitaine artisanale",
    h1: "Camion pizza napolitaine {city}",
    description:
      "Camion pizza {city}: pizza d inspiration napolitaine, cuisson bois-gaz et organisation simple pour le retrait.",
    intro: [
      "Le camion pizza dessert {city} selon la tournée hebdomadaire.",
      "Chaque pizza est préparée avec une pâte maison et des ingredients choisis pour rester coherents de la cuisson a la degustation.",
      "La cuisson se fait dans un four bois-gaz pour garder un service rapide et une texture plus juste.",
    ],
    sections: [
      {
        heading: "Une pizza plus tenue qu une simple offre de passage",
        paragraphs: [
          "La pizza napolitaine est surtout affaire de methode: une pâte souple, une cuisson tres vive et une garniture tenue.",
          "Les recettes s appuient sur quelques produits clefs comme les tomates San Marzano, la mozzarella fior di latte et le parmigiano reggiano.",
          "Le but n est pas de surcharger la pizza, mais de sortir un produit net et regulier.",
        ],
      },
      {
        heading: "Ou retrouver le camion pizza autour de {city}",
        paragraphs: [
          "Le camion pizza passe a {city} selon les emplacements prevus dans la tournée.",
          "Les horaires et points de retrait sont consultables sur la page planning.",
        ],
      },
      {
        heading: "Pizza artisanale a emporter",
        paragraphs: [
          "Chaque pizza est préparée a la commande afin de garder une cuisson maitrisee.",
          "Le service est uniquement a emporter.",
        ],
      },
    ],
  },
  {
    title: "Pizza napolitaine traditionnelle {city} | Camion pizza",
    h1: "Pizza napolitaine traditionnelle {city}",
    description:
      "Pizza napolitaine traditionnelle {city}: travail de pâte, cuisson vive et retrait au camion.",
    intro: [
      "Vous cherchez une pizza napolitaine traditionnelle a {city} ?",
      "Le camion pizza propose des pizzas préparées avec une pâte artisanale, une cuisson bois-gaz et une lecture plus serieuse du produit.",
      "Le resultat recherche est une pizza souple, bien cuite et claire en bouche.",
    ],
    sections: [
      {
        heading: "Une pizza artisanale préparée avec une base simple",
        paragraphs: [
          "Chaque pizza s appuie sur quelques ingredients reconnus pour leur regularite: farine Nuvola Super, tomates San Marzano, mozzarella fior di latte et parmigiano reggiano.",
          "Cette base courte laisse plus de place a la cuisson et a l equilibre general.",
        ],
      },
      {
        heading: "Le camion pizza autour de {city}",
        paragraphs: [
          "Le camion pizza se deplace a {city} selon les emplacements annonces dans la tournée.",
          "Les pizzas sont préparées sur place afin de garantir leur fraicheur et une sortie de four propre.",
        ],
      },
      {
        heading: "Pizza a emporter",
        paragraphs: [
          "Les pizzas sont disponibles uniquement a emporter directement au camion, dans un format concu pour limiter l attente.",
        ],
      },
    ],
  },
];

const DYNAMIC_NEARBY_VARIANTS = [
  {
    heading: "Villes proches et emplacements autour de {city}",
    lead: "Voici quelques points de retrait actifs a {city} et dans les communes voisines.",
    footer: "Consultez la page planning pour verifier les prochains passages du camion.",
  },
  {
    heading: "Prochains passages proches de {city}",
    lead: "Les emplacements suivants proviennent du planning actuellement publie.",
    footer: "Les jours et horaires peuvent evoluer selon la tournée de la semaine.",
  },
  {
    heading: "Points de retrait disponibles autour de {city}",
    lead: "Retrouvez ci-dessous quelques emplacements ou le camion peut passer.",
    footer: "Pour la version complete et mise à jour, consultez la page planning du camion pizza.",
  },
  {
    heading: "Emplacements actuellement visibles pour {city}",
    lead: "Ces adresses sont mises a jour automatiquement depuis la configuration admin.",
    footer: "Pensez a verifier le planning avant de vous deplacer.",
  },
  {
    heading: "Retrait pizza autour de {city}",
    lead: "Selection de points de retrait disponibles selon les derniers créneaux ouverts.",
    footer: "Tous les details de passage restent centralises sur la page planning.",
  },
];

export function buildDynamicCityContent(cityValue, options = {}) {
  const city = String(cityValue || "").trim() || "Moselle";
  const slug = slugifyCity(city) || "moselle";
  const variantIndex = hashToIndex(slug, DYNAMIC_CITY_VARIANTS.length);
  const nearbyVariantIndex = hashToIndex(`${slug}-nearby`, DYNAMIC_NEARBY_VARIANTS.length);
  const variant = DYNAMIC_CITY_VARIANTS[variantIndex];
  const nearbyVariant = DYNAMIC_NEARBY_VARIANTS[nearbyVariantIndex];
  const locationHighlights = Array.isArray(options.locationHighlights)
    ? options.locationHighlights.filter(Boolean).slice(0, 3)
    : [];
  const introParagraphs = variant.intro.map((paragraph) => withCity(paragraph, city));
  const sections = variant.sections.map((section) => ({
    heading: withCity(section.heading, city),
    paragraphs: section.paragraphs.map((paragraph) => withCity(paragraph, city)),
  }));

  return {
    pathname: `/pizza-${slug}`,
    title: withCity(variant.title, city),
    description: withCity(variant.description, city),
    h1: withCity(variant.h1, city),
    intro: introParagraphs.join(" "),
    introParagraphs,
    sections,
    nearbySection: {
      heading: withCity(nearbyVariant.heading, city),
      lead: withCity(nearbyVariant.lead, city),
      footer: withCity(nearbyVariant.footer, city),
    },
    locationHighlights,
  };
}

