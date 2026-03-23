import { describe, expect, it } from "vitest";
import { buildMenuGroups } from "./MenuBoard";

const tr = (fr) => fr;

describe("buildMenuGroups", () => {
  it("matches products to categories even when ids mix strings and numbers", () => {
    const groups = buildMenuGroups(
      [
        { id: 1, name: "Pizzas", description: "" },
        { id: "2", name: "Desserts", description: "" },
      ],
      [
        { id: 101, name: "Margherita", categoryId: "1" },
        { id: 102, name: "Tiramisu", categoryId: 2 },
      ],
      tr
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("Pizzas");
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].name).toBe("Margherita");
    expect(groups[1].title).toBe("Desserts");
    expect(groups[1].items).toHaveLength(1);
    expect(groups[1].items[0].name).toBe("Tiramisu");
  });
});
