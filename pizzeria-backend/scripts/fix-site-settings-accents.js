const prisma = require("../src/lib/prisma");

const SITE_SETTINGS_ID = 1;
const APPLY = process.argv.includes("--apply");

const REPLACEMENTS = [
  [
    "Decouvrez une selection de nos pizzas signatures, avec prix et ingredients.",
    "Découvrez une sélection de nos pizzas signatures, avec prix et ingrédients.",
  ],
  [
    "Une selection mise en avant par l'equipe. Commandez en ligne en quelques clics.",
    "Une sélection mise en avant par l'équipe. Commandez en ligne en quelques clics.",
  ],
  [
    "Choisissez les produits et le texte a afficher sur la page /pizza.",
    "Choisissez les produits et le texte à afficher sur la page /pizza.",
  ],
  [
    "Activez les produits a mettre en avant. L'ordre de selection est conserve.",
    "Activez les produits à mettre en avant. L'ordre de sélection est conservé.",
  ],
  ["Selection pizza", "Sélection pizza"],
  ["Aucun produit detecte.", "Aucun produit détecté."],
  ["Ingredients classiques", "Ingrédients classiques"],
  ["Apres cuisson", "Après cuisson"],
  ["A propos", "À propos"],
  ["Deconnexion", "Déconnexion"],
  ["Changer le theme", "Changer le thème"],
  ["Mise a jour...", "Mise à jour..."],
];

const EDITABLE_FIELDS = [
  "siteName",
  "siteTagline",
  "siteDescription",
  "contact",
  "social",
  "seo",
  "home",
  "blog",
  "contactPage",
  "order",
  "footer",
  "announcement",
  "pizzaPage",
];

function applyReplacements(value) {
  let next = String(value || "");
  for (const [source, target] of REPLACEMENTS) {
    next = next.split(source).join(target);
  }
  return next;
}

function transformValue(value, path, changes) {
  if (typeof value === "string") {
    if (path.includes(".en")) {
      return value;
    }
    const next = applyReplacements(value);
    if (next !== value) {
      changes.push({ path, before: value, after: next });
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      transformValue(entry, `${path}[${index}]`, changes)
    );
  }

  if (value && typeof value === "object") {
    const next = {};
    for (const [key, nested] of Object.entries(value)) {
      next[key] = transformValue(nested, `${path}.${key}`, changes);
    }
    return next;
  }

  return value;
}

async function main() {
  const settings = await prisma.siteSetting.findUnique({
    where: { id: SITE_SETTINGS_ID },
  });

  if (!settings) {
    console.log(`No SiteSetting found for id=${SITE_SETTINGS_ID}.`);
    return;
  }

  const changes = [];
  const updateData = {};

  for (const field of EDITABLE_FIELDS) {
    const currentValue = settings[field];
    const nextValue = transformValue(currentValue, field, changes);
    if (JSON.stringify(nextValue) !== JSON.stringify(currentValue)) {
      updateData[field] = nextValue;
    }
  }

  if (changes.length === 0) {
    console.log("No accent fixes needed in site settings.");
    return;
  }

  console.log(`Found ${changes.length} candidate replacement(s).`);
  for (const change of changes.slice(0, 25)) {
    console.log(`- ${change.path}`);
    console.log(`  before: ${change.before}`);
    console.log(`  after : ${change.after}`);
  }
  if (changes.length > 25) {
    console.log(`...and ${changes.length - 25} more change(s).`);
  }

  if (!APPLY) {
    console.log("Preview mode only. Re-run with --apply to persist changes.");
    return;
  }

  await prisma.siteSetting.update({
    where: { id: SITE_SETTINGS_ID },
    data: updateData,
  });

  console.log("Accent fixes applied to site settings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
