function normalizeLocationPart(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function getLocationDisplayName(location, fallback = "") {
  const name = normalizeLocationPart(location?.name);
  const street = normalizeLocationPart(location?.addressLine1);
  const city = normalizeLocationPart(location?.city);
  const addressLine2 = normalizeLocationPart(location?.addressLine2);

  return name || city || street || addressLine2 || fallback;
}
