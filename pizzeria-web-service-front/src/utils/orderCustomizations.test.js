import { getActiveRecommendedSupplements } from "./orderCustomizations";

test("getActiveRecommendedSupplements keeps only active recommended extras", () => {
  const result = getActiveRecommendedSupplements([
    {
      isRecommended: true,
      ingredient: { id: 1, name: "Burrata", isExtra: true, active: true },
    },
    {
      isRecommended: true,
      ingredient: { id: 2, name: "Truffe", isExtra: true, active: false },
    },
    {
      isRecommended: false,
      ingredient: { id: 3, name: "Olive", isExtra: true, active: true },
    },
    {
      isRecommended: true,
      ingredient: { id: 4, name: "Basilic", isExtra: false, active: true },
    },
  ]);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe(1);
});

test("getActiveRecommendedSupplements deduplicates by ingredient id", () => {
  const result = getActiveRecommendedSupplements([
    {
      isRecommended: true,
      ingredient: { id: 9, name: "Pecorino", isExtra: true, active: true },
    },
    {
      isRecommended: true,
      ingredient: { id: 9, name: "Pecorino", isExtra: true, active: true },
    },
  ]);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe(9);
});

