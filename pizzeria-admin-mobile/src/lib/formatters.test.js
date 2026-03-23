import { describe, expect, it } from "vitest";
import {
  formatDateLabel,
  formatDateTimeLabel,
  formatPrice,
  formatTimeLabel,
  getOrderDisplayName,
  getStatusLabel,
  normalizeWorkflowStatus,
  shiftIsoDate,
  toIsoDate,
} from "./formatters";

describe("formatters", () => {
  it("formats valid and invalid dates", () => {
    expect(formatDateLabel("2026-03-15T10:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatDateLabel("invalid")).toBe("--");
    expect(formatTimeLabel("2026-03-15T10:05:00.000Z")).toMatch(/\d{2}:\d{2}/);
    expect(formatTimeLabel("invalid")).toBe("--:--");
    expect(formatDateTimeLabel("2026-03-15T10:05:00.000Z")).toContain("/");
    expect(formatDateTimeLabel("invalid")).toBe("--");
  });

  it("formats prices and date shifts", () => {
    expect(formatPrice(12)).toContain("12");
    expect(formatPrice("invalid")).toBe("0,00 EUR");
    expect(toIsoDate("2026-03-15T10:00:00.000Z")).toBe("2026-03-15");
    expect(shiftIsoDate("2026-03-15", 1)).toBe("2026-03-16");
    expect(shiftIsoDate("invalid", 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes statuses and labels", () => {
    expect(normalizeWorkflowStatus({ workflowStatus: "validated" })).toBe("VALIDATE");
    expect(normalizeWorkflowStatus({ status: "PRINTED" })).toBe("FINALIZED");
    expect(normalizeWorkflowStatus({ status: "canceled" })).toBe("CANCELED");
    expect(normalizeWorkflowStatus({ status: "other" })).toBe("COMPLETED");
    expect(getStatusLabel("VALIDATE")).toBe("Validee");
    expect(getStatusLabel("FINALIZED")).toBe("Finalisee");
    expect(getStatusLabel("CANCELED")).toBe("Annulee");
    expect(getStatusLabel("other")).toBe("En cours");
  });

  it("resolves display name from available customer fields", () => {
    expect(getOrderDisplayName({ user: { firstName: "Lina", name: "Nom Fallback" } })).toBe("Lina");
    expect(getOrderDisplayName({ user: { name: "Nom Fallback" } })).toBe("Nom Fallback");
    expect(getOrderDisplayName({ customerName: "Client Local" })).toBe("Client Local");
    expect(getOrderDisplayName({})).toBe("Client");
  });
});

