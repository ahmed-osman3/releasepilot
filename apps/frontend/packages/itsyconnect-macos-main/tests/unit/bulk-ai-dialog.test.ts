import { describe, it, expect } from "vitest";
import { mergeBulkUpdates } from "@/components/bulk-ai-dialog";

describe("mergeBulkUpdates", () => {
  it("merges field updates into existing locale data", () => {
    const current = {
      "en-US": { description: "English desc", keywords: "a,b" },
      "de-DE": { description: "Old German", keywords: "alt" },
      "fr-FR": { description: "Old French", keywords: "vieux" },
    };
    const updates = {
      "de-DE": { description: "Neue Beschreibung", keywords: "neu,gut" },
      "fr-FR": { description: "Nouvelle description" },
    };
    const result = mergeBulkUpdates(current, updates);

    expect(result["en-US"]).toEqual({ description: "English desc", keywords: "a,b" });
    expect(result["de-DE"]).toEqual({ description: "Neue Beschreibung", keywords: "neu,gut" });
    expect(result["fr-FR"]).toEqual({ description: "Nouvelle description", keywords: "vieux" });
  });

  it("does not mutate the original object", () => {
    const current = {
      "en-US": { name: "App" },
      "de-DE": { name: "Alt" },
    };
    const updates = { "de-DE": { name: "Neu" } };
    const result = mergeBulkUpdates(current, updates);

    expect(result["de-DE"].name).toBe("Neu");
    expect(current["de-DE"].name).toBe("Alt");
  });

  it("handles empty updates", () => {
    const current = { "en-US": { description: "Hello" } };
    const result = mergeBulkUpdates(current, {});
    expect(result).toEqual(current);
  });

  it("adds new locales that did not exist before", () => {
    const current = { "en-US": { name: "App" } };
    const updates = { "ja": { name: "アプリ" } };
    const result = mergeBulkUpdates(current, updates);
    expect(result["ja"]).toEqual({ name: "アプリ" });
    expect(result["en-US"]).toEqual({ name: "App" });
  });

  it("preserves fields not present in updates", () => {
    const current = {
      "de-DE": { name: "Alt", subtitle: "Untertitel", privacyPolicyUrl: "https://example.com" },
    };
    const updates = { "de-DE": { name: "Neu" } };
    const result = mergeBulkUpdates(current, updates);
    expect(result["de-DE"]).toEqual({
      name: "Neu",
      subtitle: "Untertitel",
      privacyPolicyUrl: "https://example.com",
    });
  });
});
