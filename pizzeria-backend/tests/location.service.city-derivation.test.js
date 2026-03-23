const test = require("node:test");
const assert = require("node:assert/strict");

const { deriveCityFromLocationInput } = require("../src/services/location.service");

test("deriveCityFromLocationInput keeps explicit city when provided", () => {
  const city = deriveCityFromLocationInput({
    city: "Algrange",
    addressLine1: "12 Rue de la Gare",
    postalCode: "57440",
    country: "France",
  });

  assert.equal(city, "Algrange");
});

test("deriveCityFromLocationInput extracts city from postal+city in address line", () => {
  const city = deriveCityFromLocationInput({
    city: "",
    addressLine1: "12 Rue de la Gare, 57440 Algrange",
    addressLine2: "",
    postalCode: "57440",
    country: "France",
  });

  assert.equal(city, "Algrange");
});

test("deriveCityFromLocationInput extracts city from address line 2", () => {
  const city = deriveCityFromLocationInput({
    city: "",
    addressLine1: "12 Rue de la Gare",
    addressLine2: "57440 Algrange",
    postalCode: "57440",
    country: "France",
  });

  assert.equal(city, "Algrange");
});

test("deriveCityFromLocationInput throws when city cannot be inferred", () => {
  assert.throws(
    () =>
      deriveCityFromLocationInput({
        city: "",
        addressLine1: "12 Rue de la Gare",
        addressLine2: "",
        postalCode: "57440",
        country: "France",
      }),
    /city is required/i
  );
});
