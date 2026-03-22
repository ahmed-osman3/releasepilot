import { describe, it, expect } from "vitest";
import { FREE_LIMITS, CHECKOUT_URL, IS_MAS, maskKey } from "@/lib/license-shared";

describe("license-shared", () => {
  describe("IS_MAS", () => {
    it("is false when NEXT_PUBLIC_MAS is not set", () => {
      expect(IS_MAS).toBe(false);
    });
  });

  describe("FREE_LIMITS", () => {
    it("has apps and teams limits", () => {
      expect(FREE_LIMITS.apps).toBe(1);
      expect(FREE_LIMITS.teams).toBe(1);
    });
  });

  describe("CHECKOUT_URL", () => {
    it("is a valid URL string", () => {
      expect(CHECKOUT_URL).toMatch(/^https:\/\//);
    });
  });

  describe("maskKey", () => {
    it("masks keys longer than 8 characters", () => {
      expect(maskKey("ABCDEFGHIJ")).toBe("ABCDEFGH...");
    });

    it("returns short keys unchanged", () => {
      expect(maskKey("ABC")).toBe("ABC");
    });

    it("returns exactly 8-char keys unchanged", () => {
      expect(maskKey("12345678")).toBe("12345678");
    });

    it("handles empty string", () => {
      expect(maskKey("")).toBe("");
    });
  });
});
