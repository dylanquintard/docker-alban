const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../src/lib/prisma");
const orderService = require("../src/services/order.service");

test("addToCart rejects inactive added ingredients", async () => {
  const originalTransaction = prisma.$transaction;
  let capturedIngredientWhere = null;

  prisma.$transaction = async (callback) =>
    callback({
      product: {
        findUnique: async () => ({
          id: 42,
          basePrice: 10,
          ingredients: [],
        }),
      },
      ingredient: {
        findMany: async (args) => {
          capturedIngredientWhere = args?.where || null;
          return [];
        },
      },
    });

  try {
    await assert.rejects(
      () =>
        orderService.addToCart(1, 42, 1, {
          addedIngredients: [99],
          removedIngredients: [],
        }),
      /Invalid added ingredient/
    );

    assert.deepEqual(capturedIngredientWhere, {
      id: { in: [99] },
      active: true,
    });
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

