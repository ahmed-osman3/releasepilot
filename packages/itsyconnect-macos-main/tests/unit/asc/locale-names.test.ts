import { describe, it, expect } from "vitest";
import { LOCALE_NAMES, localeName, sortLocales, FIELD_LIMITS, FIELD_MIN_LIMITS } from "@/lib/asc/locale-names";

describe("locale-names", () => {
  describe("LOCALE_NAMES", () => {
    it("is a non-empty record", () => {
      expect(Object.keys(LOCALE_NAMES).length).toBeGreaterThan(0);
    });

    it("maps known locale codes to display names", () => {
      expect(LOCALE_NAMES["en-US"]).toBe("English (US)");
      expect(LOCALE_NAMES["de-DE"]).toBe("German");
      expect(LOCALE_NAMES["ja"]).toBe("Japanese");
    });
  });

  describe("localeName", () => {
    it("returns the display name for a known locale", () => {
      expect(localeName("en-US")).toBe("English (US)");
      expect(localeName("fr-FR")).toBe("French (France)");
    });

    it("returns the locale code itself for an unknown locale", () => {
      expect(localeName("xx-YY")).toBe("xx-YY");
      expect(localeName("unknown")).toBe("unknown");
    });
  });

  describe("sortLocales", () => {
    it("places primary locale first", () => {
      const sorted = sortLocales(["de-DE", "en-US", "fr-FR"], "en-US");
      expect(sorted[0]).toBe("en-US");
    });

    it("sorts remaining locales alphabetically by display name", () => {
      const sorted = sortLocales(["ja", "de-DE", "en-US", "fr-FR"], "en-US");
      expect(sorted).toEqual(["en-US", "fr-FR", "de-DE", "ja"]);
    });

    it("does not mutate the original array", () => {
      const input = ["de-DE", "en-US"];
      sortLocales(input, "en-US");
      expect(input).toEqual(["de-DE", "en-US"]);
    });

    it("handles empty array", () => {
      expect(sortLocales([], "en-US")).toEqual([]);
    });
  });

  describe("FIELD_LIMITS", () => {
    it("has expected fields", () => {
      expect(FIELD_LIMITS.name).toBe(30);
      expect(FIELD_LIMITS.subtitle).toBe(30);
      expect(FIELD_LIMITS.description).toBe(4000);
      expect(FIELD_LIMITS.keywords).toBe(100);
      expect(FIELD_LIMITS.whatsNew).toBe(4000);
      expect(FIELD_LIMITS.promotionalText).toBe(170);
      expect(FIELD_LIMITS.supportUrl).toBe(2048);
      expect(FIELD_LIMITS.marketingUrl).toBe(2048);
    });

    it("all values are positive numbers", () => {
      for (const value of Object.values(FIELD_LIMITS)) {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  describe("FIELD_MIN_LIMITS", () => {
    it("has expected fields", () => {
      expect(FIELD_MIN_LIMITS.name).toBe(2);
      expect(FIELD_MIN_LIMITS.description).toBe(10);
      expect(FIELD_MIN_LIMITS.whatsNew).toBe(4);
    });

    it("all minimums are less than corresponding maximums", () => {
      for (const [field, min] of Object.entries(FIELD_MIN_LIMITS)) {
        const max = FIELD_LIMITS[field];
        expect(max).toBeDefined();
        expect(min).toBeLessThan(max);
      }
    });
  });
});
