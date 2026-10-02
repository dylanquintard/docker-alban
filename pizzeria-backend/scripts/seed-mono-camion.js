require("dotenv").config();
process.env.TZ = process.env.TZ || "UTC";

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../src/lib/prisma");
const { buildDateTime, getAnchorDateForDay, getDateRange } = require("../src/utils/weekly-timeslots");
const {
  withDefaultTenantData,
  withDefaultTenantWhere,
} = require("../src/services/tenant-context.service");

const DEFAULT_PASSWORD = process.env.SEED_MONO_PASSWORD || "ChangeMe123!";
const PRINT_AGENT_CODE = process.env.SEED_MONO_PRINT_AGENT_CODE || "agent-camion";
const PRINT_AGENT_TOKEN =
  process.env.SEED_MONO_PRINT_AGENT_TOKEN ||
  process.env.PRINT_AGENT_TOKEN ||
  "local-print-agent-token-at-least-32-chars";
const PRINTER_CODE = process.env.SEED_MONO_PRINTER_CODE || "pos-camion";
const WEEK_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function hashPrintAgentToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

async function upsertUser({ email, name, firstName, lastName, phone, role }) {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const existing = await prisma.user.findFirst({
    where: withDefaultTenantWhere({ email }),
  });
  const data = {
    name,
    firstName,
    lastName,
    phone,
    role,
    emailVerified: true,
    phoneVerified: true,
  };

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: withDefaultTenantData(data),
    });
  }

  return prisma.user.create({
    data: withDefaultTenantData({
      ...data,
      email,
      password,
    }),
  });
}

async function upsertCategory({ name, kind, sortOrder, customerCanCustomize = false }) {
  const existing = await prisma.category.findFirst({
    where: withDefaultTenantWhere({ name, kind }),
  });

  const data = {
    name,
    kind,
    sortOrder,
    active: true,
    customerCanCustomize,
  };

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        sortOrder,
        active: true,
        customerCanCustomize,
      },
    });
  }

  return prisma.category.create({
    data: withDefaultTenantData(data),
  });
}

async function upsertPrintAgent() {
  const data = {
    code: PRINT_AGENT_CODE,
    name: "Agent camion",
    tokenHash: hashPrintAgentToken(PRINT_AGENT_TOKEN),
    status: "OFFLINE",
  };

  const existing = await prisma.printAgent.findFirst({
    where: withDefaultTenantWhere({ code: PRINT_AGENT_CODE }),
  });

  if (existing) {
    return prisma.printAgent.update({
      where: { id: existing.id },
      data: withDefaultTenantData(data),
    });
  }

  return prisma.printAgent.create({ data: withDefaultTenantData(data) });
}

async function upsertPrinter(agent, location) {
  const data = {
    code: PRINTER_CODE,
    name: "Imprimante POS camion",
    model: "ESC/POS 80mm",
    paperWidthMm: 80,
    connectionType: "ETHERNET",
    ipAddress: process.env.SEED_MONO_PRINTER_IP || "192.168.1.50",
    port: Number(process.env.SEED_MONO_PRINTER_PORT || 9100),
    isActive: true,
    agentId: agent.id,
    locationId: location.id,
  };

  const existing = await prisma.printer.findFirst({
    where: withDefaultTenantWhere({ code: PRINTER_CODE }),
  });

  if (existing) {
    return prisma.printer.update({
      where: { id: existing.id },
      data: withDefaultTenantData(data),
    });
  }

  return prisma.printer.create({ data: withDefaultTenantData(data) });
}

async function upsertIngredient({ name, price, isExtra, isBaseIngredient, categoryId }) {
  const existing = await prisma.ingredient.findFirst({
    where: withDefaultTenantWhere({ name }),
  });
  if (existing) {
    return prisma.ingredient.update({
      where: { id: existing.id },
      data: {
        price,
        isExtra,
        isBaseIngredient,
        active: true,
        categoryId,
      },
    });
  }

  return prisma.ingredient.create({
    data: withDefaultTenantData({
      name,
      price,
      isExtra,
      isBaseIngredient,
      active: true,
      categoryId,
    }),
  });
}

async function upsertProduct({ name, description, basePrice, categoryId }) {
  const existing = await prisma.product.findFirst({
    where: withDefaultTenantWhere({ name }),
  });
  if (existing) {
    return prisma.product.update({
      where: { id: existing.id },
      data: {
        description,
        basePrice,
        categoryId,
      },
    });
  }

  return prisma.product.create({
    data: withDefaultTenantData({
      name,
      description,
      basePrice,
      categoryId,
    }),
  });
}

async function linkIngredient(product, ingredient, options = {}) {
  return prisma.productIngredient.upsert({
    where: {
      productId_ingredientId: {
        productId: product.id,
        ingredientId: ingredient.id,
      },
    },
    update: {
      isBase: Boolean(options.isBase),
      isAfterCooking: Boolean(options.isAfterCooking),
      isRecommended: Boolean(options.isRecommended && ingredient.isExtra),
    },
    create: {
      productId: product.id,
      ingredientId: ingredient.id,
      isBase: Boolean(options.isBase),
      isAfterCooking: Boolean(options.isAfterCooking),
      isRecommended: Boolean(options.isRecommended && ingredient.isExtra),
    },
  });
}

async function upsertLocation() {
  const existing = await prisma.location.findFirst({
    where: withDefaultTenantWhere({
      addressLine1: "Place du Village",
      postalCode: "57000",
      city: "Metz",
    }),
  });

  const data = {
    name: "Metz",
    addressLine1: "Place du Village",
    addressLine2: null,
    postalCode: "57000",
    city: "Metz",
    country: "France",
    notes: "Emplacement de demo mono-camion",
    active: true,
  };

  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: withDefaultTenantData(data),
    });
  }

  return prisma.location.create({ data: withDefaultTenantData(data) });
}

async function upsertPrintSetup(location) {
  const agent = await upsertPrintAgent();
  const printer = await upsertPrinter(agent, location);

  return { agent, printer };
}

async function ensureWeeklyService({ dayOfWeek, startTime, endTime, slotDuration, maxPizzas, locationId, agentId }) {
  const anchorDate = getAnchorDateForDay(dayOfWeek);
  const anchorRange = getDateRange(anchorDate);
  const serviceStart = buildDateTime(anchorDate, startTime, "startTime");
  const serviceEnd = buildDateTime(anchorDate, endTime, "endTime");

  await prisma.timeSlot.deleteMany({
    where: withDefaultTenantWhere({
      serviceDate: {
        gte: anchorRange.start,
        lt: anchorRange.end,
      },
      locationId,
      agentId,
      currentPizzas: 0,
    }),
  });

  const existingCount = await prisma.timeSlot.count({
    where: withDefaultTenantWhere({
      serviceDate: anchorDate,
      locationId,
      startTime: { gte: serviceStart },
      endTime: { lte: serviceEnd },
    }),
  });

  if (existingCount > 0) return existingCount;

  const rows = [];
  let cursor = new Date(serviceStart);
  while (cursor < serviceEnd) {
    const nextEnd = new Date(Math.min(serviceEnd.getTime(), cursor.getTime() + slotDuration * 60_000));
    rows.push({
      startTime: new Date(cursor),
      endTime: nextEnd,
      maxPizzas,
      currentPizzas: 0,
      active: true,
      serviceDate: anchorDate,
      locationId,
      agentId,
    });
    cursor = nextEnd;
  }

  await prisma.timeSlot.createMany({
    data: rows.map((row) => withDefaultTenantData(row)),
  });
  return rows.length;
}

async function closeUnseededWeeklyServices({ locationId, agentId, keepDays }) {
  const keepDaySet = new Set(keepDays);
  const daysToClose = WEEK_DAYS.filter((dayOfWeek) => !keepDaySet.has(dayOfWeek));

  for (const dayOfWeek of daysToClose) {
    const anchorDate = getAnchorDateForDay(dayOfWeek);
    const anchorRange = getDateRange(anchorDate);
    // eslint-disable-next-line no-await-in-loop
    await prisma.timeSlot.deleteMany({
      where: withDefaultTenantWhere({
        serviceDate: {
          gte: anchorRange.start,
          lt: anchorRange.end,
        },
        locationId,
        agentId,
        currentPizzas: 0,
      }),
    });
  }
}

async function upsertSiteSettings() {
  return prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      siteName: "Il Forno d'Oro",
      siteTagline: {
        fr: "Pizzas artisanales a emporter",
        en: "Artisan takeaway pizza",
      },
      siteDescription: {
        fr: "Commandez vos pizzas en ligne et recuperez-les au camion.",
        en: "Order pizza online and pick it up at the truck.",
      },
      contact: {
        phone: "+33100000000",
        email: "contact@ilfornodoro.fr",
        address: "Place du Village, 57000 Metz",
        mapsUrl: "",
        serviceArea: {
          fr: "Metz et alentours",
          en: "Metz and surrounding areas",
        },
      },
      social: {
        instagramUrl: "https://www.instagram.com/ilfornodoro_/",
        facebookUrl: "https://www.facebook.com/ilfornodoro",
        tiktokUrl: "",
      },
      order: {
        pickupIntroText: {
          fr: "Choisissez votre horaire de retrait au camion.",
          en: "Choose your pickup time at the truck.",
        },
        pickupConfirmationText: {
          fr: "Verifiez l'horaire et l'adresse avant de confirmer.",
          en: "Check the time and address before confirming.",
        },
        showMenuProductImages: false,
      },
    },
    create: {
      id: 1,
      siteName: "Il Forno d'Oro",
      siteTagline: {
        fr: "Pizzas artisanales a emporter",
        en: "Artisan takeaway pizza",
      },
      siteDescription: {
        fr: "Commandez vos pizzas en ligne et recuperez-les au camion.",
        en: "Order pizza online and pick it up at the truck.",
      },
      contact: {
        phone: "+33100000000",
        email: "contact@ilfornodoro.fr",
        address: "Place du Village, 57000 Metz",
        mapsUrl: "",
        serviceArea: {
          fr: "Metz et alentours",
          en: "Metz and surrounding areas",
        },
      },
      social: {
        instagramUrl: "https://www.instagram.com/ilfornodoro_/",
        facebookUrl: "https://www.facebook.com/ilfornodoro",
        tiktokUrl: "",
      },
      order: {
        pickupIntroText: {
          fr: "Choisissez votre horaire de retrait au camion.",
          en: "Choose your pickup time at the truck.",
        },
        pickupConfirmationText: {
          fr: "Verifiez l'horaire et l'adresse avant de confirmer.",
          en: "Check the time and address before confirming.",
        },
        showMenuProductImages: false,
      },
    },
  });
}

async function seedMenu() {
  const pizzas = await upsertCategory({
    name: "Pizzas",
    kind: "PRODUCT",
    sortOrder: 10,
    customerCanCustomize: true,
  });
  const boissons = await upsertCategory({
    name: "Boissons",
    kind: "PRODUCT",
    sortOrder: 20,
  });
  const bases = await upsertCategory({
    name: "Bases",
    kind: "INGREDIENT",
    sortOrder: 10,
  });
  const fromages = await upsertCategory({
    name: "Fromages",
    kind: "INGREDIENT",
    sortOrder: 20,
  });
  const extras = await upsertCategory({
    name: "Extras",
    kind: "INGREDIENT",
    sortOrder: 30,
  });

  const tomate = await upsertIngredient({
    name: "Base tomate",
    price: 0,
    isExtra: false,
    isBaseIngredient: true,
    categoryId: bases.id,
  });
  const creme = await upsertIngredient({
    name: "Base creme",
    price: 0,
    isExtra: false,
    isBaseIngredient: true,
    categoryId: bases.id,
  });
  const mozzarella = await upsertIngredient({
    name: "Mozzarella",
    price: 1.5,
    isExtra: true,
    isBaseIngredient: false,
    categoryId: fromages.id,
  });
  const jambon = await upsertIngredient({
    name: "Jambon",
    price: 1.5,
    isExtra: true,
    isBaseIngredient: false,
    categoryId: extras.id,
  });
  const champignons = await upsertIngredient({
    name: "Champignons",
    price: 1,
    isExtra: true,
    isBaseIngredient: false,
    categoryId: extras.id,
  });
  const olives = await upsertIngredient({
    name: "Olives",
    price: 1,
    isExtra: true,
    isBaseIngredient: false,
    categoryId: extras.id,
  });

  const margherita = await upsertProduct({
    name: "Margherita",
    description: "Base tomate, mozzarella, basilic.",
    basePrice: 9.5,
    categoryId: pizzas.id,
  });
  const regina = await upsertProduct({
    name: "Regina",
    description: "Base tomate, mozzarella, jambon, champignons.",
    basePrice: 12,
    categoryId: pizzas.id,
  });
  const blanche = await upsertProduct({
    name: "Blanche",
    description: "Base creme, mozzarella, jambon.",
    basePrice: 12.5,
    categoryId: pizzas.id,
  });
  await upsertProduct({
    name: "Boisson 33cl",
    description: "Canette au choix.",
    basePrice: 2,
    categoryId: boissons.id,
  });

  await linkIngredient(margherita, tomate, { isBase: true });
  await linkIngredient(margherita, mozzarella);
  await linkIngredient(margherita, olives, { isRecommended: true });
  await linkIngredient(regina, tomate, { isBase: true });
  await linkIngredient(regina, mozzarella);
  await linkIngredient(regina, jambon);
  await linkIngredient(regina, champignons);
  await linkIngredient(blanche, creme, { isBase: true });
  await linkIngredient(blanche, mozzarella);
  await linkIngredient(blanche, jambon);

  return { products: [margherita, regina, blanche], ingredients: [tomate, creme, mozzarella, jambon, champignons, olives] };
}

async function main() {
  const [admin, client] = await Promise.all([
    upsertUser({
      email: "admin@mono-camion.local",
      name: "Admin Camion",
      firstName: "Admin",
      lastName: "Camion",
      phone: "+33100000000",
      role: "ADMIN",
    }),
    upsertUser({
      email: "client@mono-camion.local",
      name: "Client Test",
      firstName: "Client",
      lastName: "Test",
      phone: "+33600000000",
      role: "CLIENT",
    }),
  ]);

  const location = await upsertLocation();
  const { agent, printer } = await upsertPrintSetup(location);
  const menu = await seedMenu();
  await upsertSiteSettings();
  await closeUnseededWeeklyServices({
    locationId: location.id,
    agentId: agent.id,
    keepDays: ["FRIDAY", "SATURDAY"],
  });

  const fridaySlots = await ensureWeeklyService({
    dayOfWeek: "FRIDAY",
    startTime: "18:00",
    endTime: "22:00",
    slotDuration: 15,
    maxPizzas: 4,
    locationId: location.id,
    agentId: agent.id,
  });
  const saturdaySlots = await ensureWeeklyService({
    dayOfWeek: "SATURDAY",
    startTime: "18:00",
    endTime: "22:00",
    slotDuration: 15,
    maxPizzas: 4,
    locationId: location.id,
    agentId: agent.id,
  });

  console.log("Mono-camion seed ready");
  console.log({
    admin: admin.email,
    client: client.email,
    password: DEFAULT_PASSWORD,
    location: location.name,
    printAgent: agent.code,
    printAgentToken: PRINT_AGENT_TOKEN,
    printer: printer.code,
    products: menu.products.map((product) => product.name),
    fridaySlots,
    saturdaySlots,
  });
}

main()
  .catch((error) => {
    console.error("Mono-camion seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
