function normalizeNamePart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function splitPersonName(person = {}) {
  const firstName = normalizeNamePart(
    person.firstName ?? person.firstname ?? person.givenName ?? ""
  );
  const lastName = normalizeNamePart(
    person.lastName ?? person.lastname ?? person.familyName ?? ""
  );

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(" "),
    };
  }

  const fullName = normalizeNamePart(person.name ?? person.fullName ?? "");
  if (!fullName) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const [derivedFirstName = "", ...rest] = fullName.split(" ");
  const derivedLastName = rest.join(" ");

  return {
    firstName: derivedFirstName,
    lastName: derivedLastName,
    fullName,
  };
}

export function buildFullName(firstName, lastName) {
  return [normalizeNamePart(firstName), normalizeNamePart(lastName)].filter(Boolean).join(" ");
}
