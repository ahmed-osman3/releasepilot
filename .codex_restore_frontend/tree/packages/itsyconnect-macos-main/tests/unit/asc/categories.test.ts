import { describe, it, expect } from "vitest";
import { CATEGORIES, categoryName } from "@/lib/asc/categories";

describe("categories", () => {
  describe("CATEGORIES", () => {
    it("is a non-empty record", () => {
      expect(Object.keys(CATEGORIES).length).toBeGreaterThan(0);
    });

    it("maps known category IDs to display names", () => {
      expect(CATEGORIES.BOOKS).toBe("Books");
      expect(CATEGORIES.GAMES).toBe("Games");
      expect(CATEGORIES.FOOD_AND_DRINK).toBe("Food & drink");
    });
  });

  describe("categoryName", () => {
    it("returns the display name for a known category", () => {
      expect(categoryName("PRODUCTIVITY")).toBe("Productivity");
      expect(categoryName("HEALTH_AND_FITNESS")).toBe("Health & fitness");
    });

    it("returns the ID itself for an unknown category", () => {
      expect(categoryName("UNKNOWN_CATEGORY")).toBe("UNKNOWN_CATEGORY");
    });
  });
});
