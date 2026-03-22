import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheInvalidate = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheInvalidate: (...args: unknown[]) => mockCacheInvalidate(...args),
}));

import {
  updateVersionLocalization,
  createVersionLocalization,
  deleteVersionLocalization,
  invalidateLocalizationsCache,
  updateAppInfoLocalization,
  createAppInfoLocalization,
  deleteAppInfoLocalization,
  invalidateAppInfoLocalizationsCache,
} from "@/lib/asc/localization-mutations";

describe("localization-mutations", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
  });

  describe("updateVersionLocalization", () => {
    it("PATCHes the localization with cleaned attributes", async () => {
      mockAscFetch.mockResolvedValue({});

      await updateVersionLocalization("loc-1", {
        whatsNew: "Bug fixes",
        supportUrl: "",
        marketingUrl: "https://example.com",
      });

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionLocalizations/loc-1",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.supportUrl).toBeNull();
      expect(body.data.attributes.marketingUrl).toBe("https://example.com");
      expect(body.data.attributes.whatsNew).toBe("Bug fixes");
    });
  });

  describe("createVersionLocalization", () => {
    it("POSTs a new localization and returns its ID", async () => {
      mockAscFetch.mockResolvedValue({ data: { id: "new-loc-1" } });

      const id = await createVersionLocalization("ver-1", "de-DE", {
        whatsNew: "Fehlerbehebungen",
        description: "",
      });

      expect(id).toBe("new-loc-1");
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionLocalizations",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.locale).toBe("de-DE");
      expect(body.data.attributes.whatsNew).toBe("Fehlerbehebungen");
      // Empty strings are stripped on create
      expect(body.data.attributes.description).toBeUndefined();
      expect(body.data.relationships.appStoreVersion.data.id).toBe("ver-1");
    });
  });

  describe("deleteVersionLocalization", () => {
    it("DELETEs the localization", async () => {
      mockAscFetch.mockResolvedValue(null);

      await deleteVersionLocalization("loc-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionLocalizations/loc-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("invalidateLocalizationsCache", () => {
    it("invalidates the cache for the given version", () => {
      invalidateLocalizationsCache("ver-1");
      expect(mockCacheInvalidate).toHaveBeenCalledWith("localizations:ver-1");
    });
  });

  describe("updateAppInfoLocalization", () => {
    it("PATCHes the app info localization with cleaned attributes", async () => {
      mockAscFetch.mockResolvedValue({});

      await updateAppInfoLocalization("info-loc-1", {
        name: "My App",
        privacyPolicyUrl: "",
        privacyChoicesUrl: "",
      });

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.name).toBe("My App");
      expect(body.data.attributes.privacyPolicyUrl).toBeNull();
      expect(body.data.attributes.privacyChoicesUrl).toBeNull();
    });
  });

  describe("createAppInfoLocalization", () => {
    it("POSTs a new app info localization and returns its ID", async () => {
      mockAscFetch.mockResolvedValue({ data: { id: "new-info-loc-1" } });

      const id = await createAppInfoLocalization("info-1", "fr-FR", {
        name: "Mon App",
        subtitle: "",
      });

      expect(id).toBe("new-info-loc-1");
      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.locale).toBe("fr-FR");
      expect(body.data.attributes.name).toBe("Mon App");
      expect(body.data.attributes.subtitle).toBeUndefined();
      expect(body.data.relationships.appInfo.data.id).toBe("info-1");
    });
  });

  describe("deleteAppInfoLocalization", () => {
    it("DELETEs the app info localization", async () => {
      mockAscFetch.mockResolvedValue(null);

      await deleteAppInfoLocalization("info-loc-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appInfoLocalizations/info-loc-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("invalidateAppInfoLocalizationsCache", () => {
    it("invalidates the cache for the given app info", () => {
      invalidateAppInfoLocalizationsCache("info-1");
      expect(mockCacheInvalidate).toHaveBeenCalledWith("appInfoLocalizations:info-1");
    });
  });
});
