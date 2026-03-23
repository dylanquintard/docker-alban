const prisma = require("../lib/prisma");

function parsePositiveInt(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("active must be a boolean");
}

function parseRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function parseOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid string field");
  const normalized = value.trim();
  return normalized || null;
}

function parseOptionalDecimal(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`${fieldName} must be a valid number`);
  return parsed;
}

function compactWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCityCandidate(value) {
  const normalized = compactWhitespace(value).replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "");
  return normalized;
}

function isLikelyStreetSegment(value) {
  const normalized = compactWhitespace(value).toLowerCase();
  if (!normalized) return false;

  const streetKeywords = [
    "rue",
    "avenue",
    "av",
    "boulevard",
    "bd",
    "chemin",
    "impasse",
    "allee",
    "allée",
    "route",
    "quai",
    "place",
    "lotissement",
    "residence",
    "résidence",
    "appartement",
    "appt",
    "bat",
    "batiment",
    "bâtiment",
  ];

  if (streetKeywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(normalized))) {
    return true;
  }

  return /^\d/.test(normalized);
}

function extractCityFromAddressLine(addressLine, postalCode, country) {
  const source = compactWhitespace(addressLine);
  if (!source) return "";

  const normalizedPostalCode = compactWhitespace(postalCode);
  if (normalizedPostalCode) {
    const postalPattern = new RegExp(
      `(?:^|\\b)${escapeRegExp(normalizedPostalCode)}\\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ'’\\-\\s]{1,})$`,
      "i"
    );
    const postalMatch = source.match(postalPattern);
    if (postalMatch?.[1]) {
      return normalizeCityCandidate(postalMatch[1]);
    }
  }

  const genericPostalMatch = source.match(/\b\d{4,5}\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ'’\-\s]{1,})$/);
  if (genericPostalMatch?.[1]) {
    return normalizeCityCandidate(genericPostalMatch[1]);
  }

  const countryPattern = compactWhitespace(country);
  const segments = source.split(",").map(compactWhitespace).filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    let candidate = segments[index];
    if (!candidate) continue;

    if (countryPattern) {
      candidate = candidate
        .replace(new RegExp(`\\b${escapeRegExp(countryPattern)}\\b`, "ig"), "")
        .trim();
    }

    candidate = candidate.replace(/^\d{4,5}\s+/, "").replace(/\b\d{4,5}\b/g, "").trim();
    if (!candidate) continue;
    if (isLikelyStreetSegment(candidate)) continue;
    if (/\d/.test(candidate)) continue;
    if (!/[a-zA-ZÀ-ÿ]/.test(candidate)) continue;

    return normalizeCityCandidate(candidate);
  }

  return "";
}

function deriveCityFromLocationInput(data = {}, fallbackCity = "") {
  const explicitCity = normalizeCityCandidate(data?.city);
  if (explicitCity) return explicitCity;

  const derivedFromLine2 = extractCityFromAddressLine(
    data?.addressLine2,
    data?.postalCode,
    data?.country
  );
  if (derivedFromLine2) return derivedFromLine2;

  const derivedFromLine1 = extractCityFromAddressLine(
    data?.addressLine1,
    data?.postalCode,
    data?.country
  );
  if (derivedFromLine1) return derivedFromLine1;

  const fallback = normalizeCityCandidate(fallbackCity);
  if (fallback) return fallback;

  throw new Error("city is required (or include city in address)");
}

async function getLocations(filters = {}) {
  const active = parseOptionalBoolean(filters.active);
  const where = active === undefined ? undefined : { active };

  return prisma.location.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

async function getLocationById(id) {
  const locationId = parsePositiveInt(id, "id");
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });
  if (!location) throw new Error("Location not found");
  return location;
}

async function createLocation(data) {
  const addressLine1 = parseRequiredString(data.addressLine1, "addressLine1");
  const addressLine2 = parseOptionalString(data.addressLine2);
  const postalCode = parseRequiredString(data.postalCode, "postalCode");
  const country =
    typeof data.country === "string" && data.country.trim()
      ? data.country.trim()
      : "France";
  const city = deriveCityFromLocationInput({
    city: data.city,
    addressLine1,
    addressLine2,
    postalCode,
    country,
  });

  return prisma.location.create({
    data: {
      name: city,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      country,
      latitude: parseOptionalDecimal(data.latitude, "latitude"),
      longitude: parseOptionalDecimal(data.longitude, "longitude"),
      notes: parseOptionalString(data.notes),
      active: parseOptionalBoolean(data.active) ?? true,
    },
  });
}

async function updateLocation(id, data) {
  const locationId = parsePositiveInt(id, "id");
  const existing = await prisma.location.findUnique({ where: { id: locationId } });
  if (!existing) throw new Error("Location not found");

  const nextAddressLine1 =
    data.addressLine1 === undefined
      ? existing.addressLine1
      : parseRequiredString(data.addressLine1, "addressLine1");
  const nextAddressLine2 =
    data.addressLine2 === undefined ? existing.addressLine2 : parseOptionalString(data.addressLine2);
  const nextPostalCode =
    data.postalCode === undefined
      ? existing.postalCode
      : parseRequiredString(data.postalCode, "postalCode");
  const nextCountry =
    data.country === undefined ? existing.country : parseRequiredString(data.country, "country");
  const nextCity = deriveCityFromLocationInput(
    {
      city: data.city === undefined ? existing.city : data.city,
      addressLine1: nextAddressLine1,
      addressLine2: nextAddressLine2,
      postalCode: nextPostalCode,
      country: nextCountry,
    },
    existing.city
  );

  return prisma.location.update({
    where: { id: locationId },
    data: {
      name: nextCity,
      addressLine1: nextAddressLine1,
      addressLine2: nextAddressLine2,
      postalCode: nextPostalCode,
      city: nextCity,
      country: nextCountry,
      latitude: parseOptionalDecimal(data.latitude, "latitude"),
      longitude: parseOptionalDecimal(data.longitude, "longitude"),
      notes: parseOptionalString(data.notes),
      active: parseOptionalBoolean(data.active),
    },
  });
}

async function activateLocation(id, active) {
  const locationId = parsePositiveInt(id, "id");
  return prisma.location.update({
    where: { id: locationId },
    data: { active: parseOptionalBoolean(active) ?? false },
  });
}

async function deleteLocation(id) {
  const locationId = parsePositiveInt(id, "id");
  return prisma.location.delete({ where: { id: locationId } });
}

module.exports = {
  deriveCityFromLocationInput,
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  activateLocation,
  deleteLocation,
};
