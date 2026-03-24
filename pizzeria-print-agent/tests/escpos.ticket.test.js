const test = require("node:test");
const assert = require("node:assert/strict");

const { buildOrderTicketBuffer } = require("../src/escpos");

test("order ticket prints customer, pickup, items, note and total in business order", () => {
  const buffer = buildOrderTicketBuffer(
    {
      order: {
        id: 17,
        number: "A-17",
        pickup_time: "2026-03-24T20:00:00+01:00",
        location: {
          name: "Hayange",
          city: "Hayange",
        },
        customer: {
          first_name: "Alban",
          last_name: "Dupont",
          phone: "0601020304",
        },
        note: "Sans olive",
        total: "28.50",
        currency: "EUR",
        items: [
          {
            qty: 2,
            name: "Regina",
            added_ingredients: ["Burrata"],
            removed_ingredients: ["Olives"],
          },
        ],
      },
    },
    {
      agentName: "Agent Test",
    }
  );

  const content = buffer.toString("utf8");

  assert.match(content, /Nom: Dupont/);
  assert.match(content, /Prenom: Alban/);
  assert.match(content, /Numero client: 0601020304/);
  assert.match(content, /Ville: Hayange/);
  assert.match(content, /Heure retrait: 20:00/);
  assert.match(content, /2x Regina/);
  assert.match(content, /\+ Burrata/);
  assert.match(content, /- Olives/);
  assert.match(content, /Note commande: Sans olive/);
  assert.match(content, /Prix total: 28\.50 EUR/);

  assert.ok(content.indexOf("Nom: Dupont") < content.indexOf("Ville: Hayange"));
  assert.ok(content.indexOf("Ville: Hayange") < content.indexOf("DETAILS COMMANDE"));
  assert.ok(content.indexOf("DETAILS COMMANDE") < content.indexOf("Note commande: Sans olive"));
  assert.ok(content.indexOf("Note commande: Sans olive") < content.indexOf("Prix total: 28.50 EUR"));
});
