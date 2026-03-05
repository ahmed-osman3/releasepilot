import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheInvalidatePrefix = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheInvalidatePrefix: (...args: unknown[]) => mockCacheInvalidatePrefix(...args),
}));

import {
  getBetaAppInfo,
  createBetaAppLocalization,
  deleteBetaAppLocalization,
  updateBetaAppLocalization,
  updateBetaAppReviewDetail,
  updateBetaLicenseAgreement,
} from "@/lib/asc/testflight/info";
import { INFO_TTL } from "@/lib/asc/testflight/types";

// ── Helpers ────────────────────────────────────────────────────────

function mockLocalizationsResponse(
  locs: Array<{
    id: string;
    locale: string;
    description?: string | null;
    feedbackEmail?: string | null;
    marketingUrl?: string | null;
    privacyPolicyUrl?: string | null;
  }>,
) {
  return {
    data: locs.map((l) => ({
      id: l.id,
      type: "betaAppLocalizations",
      attributes: {
        locale: l.locale,
        description: l.description ?? null,
        feedbackEmail: l.feedbackEmail ?? null,
        marketingUrl: l.marketingUrl ?? null,
        privacyPolicyUrl: l.privacyPolicyUrl ?? null,
      },
    })),
  };
}

function mockReviewDetailResponse(
  detail: {
    id: string;
    contactFirstName?: string | null;
    contactLastName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    demoAccountRequired?: boolean;
    demoAccountName?: string | null;
    demoAccountPassword?: string | null;
    notes?: string | null;
  } | null,
) {
  if (!detail) return { data: [] };
  return {
    data: [
      {
        id: detail.id,
        type: "betaAppReviewDetails",
        attributes: {
          contactFirstName: detail.contactFirstName ?? null,
          contactLastName: detail.contactLastName ?? null,
          contactPhone: detail.contactPhone ?? null,
          contactEmail: detail.contactEmail ?? null,
          demoAccountRequired: detail.demoAccountRequired ?? false,
          demoAccountName: detail.demoAccountName ?? null,
          demoAccountPassword: detail.demoAccountPassword ?? null,
          notes: detail.notes ?? null,
        },
      },
    ],
  };
}

function mockLicenseAgreementResponse(
  agreement: { id: string; agreementText?: string | null } | null,
) {
  if (!agreement) return { data: [] };
  return {
    data: [
      {
        id: agreement.id,
        type: "betaLicenseAgreements",
        attributes: {
          agreementText: agreement.agreementText ?? null,
        },
      },
    ],
  };
}

// ── getBetaAppInfo ─────────────────────────────────────────────────

describe("getBetaAppInfo", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("returns cached data when available", async () => {
    const cached = {
      localizations: [],
      reviewDetail: null,
      licenseAgreement: null,
    };
    mockCacheGet.mockReturnValue(cached);

    const result = await getBetaAppInfo("app-1");
    expect(result).toBe(cached);
    expect(mockCacheGet).toHaveBeenCalledWith("tf-info:app-1");
    expect(mockAscFetch).not.toHaveBeenCalled();
  });

  it("bypasses cache when forceRefresh is true", async () => {
    mockCacheGet.mockReturnValue({ localizations: [], reviewDetail: null, licenseAgreement: null });
    mockAscFetch
      .mockResolvedValueOnce(mockLocalizationsResponse([]))
      .mockResolvedValueOnce(mockReviewDetailResponse(null))
      .mockResolvedValueOnce(mockLicenseAgreementResponse(null));

    await getBetaAppInfo("app-1", true);
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockAscFetch).toHaveBeenCalledTimes(3);
  });

  it("fetches localizations, review detail, and license agreement in parallel", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(
        mockLocalizationsResponse([
          { id: "loc-1", locale: "en-US", description: "English desc", feedbackEmail: "en@test.com" },
          { id: "loc-2", locale: "de-DE", description: "German desc", marketingUrl: "https://de.example.com" },
        ]),
      )
      .mockResolvedValueOnce(
        mockReviewDetailResponse({
          id: "review-1",
          contactFirstName: "Jane",
          contactLastName: "Doe",
          contactEmail: "jane@test.com",
          demoAccountRequired: true,
          demoAccountName: "demo@test.com",
          demoAccountPassword: "pass123",
        }),
      )
      .mockResolvedValueOnce(
        mockLicenseAgreementResponse({ id: "lic-1", agreementText: "License text here" }),
      );

    const result = await getBetaAppInfo("app-1");

    // Localizations
    expect(result.localizations).toHaveLength(2);
    expect(result.localizations[0]).toEqual({
      id: "loc-1",
      locale: "en-US",
      description: "English desc",
      feedbackEmail: "en@test.com",
      marketingUrl: null,
      privacyPolicyUrl: null,
    });
    expect(result.localizations[1]).toEqual({
      id: "loc-2",
      locale: "de-DE",
      description: "German desc",
      feedbackEmail: null,
      marketingUrl: "https://de.example.com",
      privacyPolicyUrl: null,
    });

    // Review detail
    expect(result.reviewDetail).toEqual({
      id: "review-1",
      contactFirstName: "Jane",
      contactLastName: "Doe",
      contactPhone: null,
      contactEmail: "jane@test.com",
      demoAccountRequired: true,
      demoAccountName: "demo@test.com",
      demoAccountPassword: "pass123",
      notes: null,
    });

    // License agreement
    expect(result.licenseAgreement).toEqual({
      id: "lic-1",
      agreementText: "License text here",
    });

    // Verify cache was populated
    expect(mockCacheSet).toHaveBeenCalledWith("tf-info:app-1", result, INFO_TTL);
  });

  it("handles empty responses for all three endpoints", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockLocalizationsResponse([]))
      .mockResolvedValueOnce(mockReviewDetailResponse(null))
      .mockResolvedValueOnce(mockLicenseAgreementResponse(null));

    const result = await getBetaAppInfo("app-1");

    expect(result.localizations).toEqual([]);
    expect(result.reviewDetail).toBeNull();
    expect(result.licenseAgreement).toBeNull();
  });

  it("handles single-object data (non-array) responses", async () => {
    mockCacheGet.mockReturnValue(null);

    // Simulate ASC returning a single object instead of an array
    mockAscFetch
      .mockResolvedValueOnce({
        data: {
          id: "loc-1",
          type: "betaAppLocalizations",
          attributes: {
            locale: "en-US",
            description: "Only locale",
            feedbackEmail: null,
            marketingUrl: null,
            privacyPolicyUrl: null,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "review-1",
          type: "betaAppReviewDetails",
          attributes: {
            contactFirstName: "John",
            contactLastName: "Smith",
            contactPhone: "+1234567890",
            contactEmail: "john@test.com",
            demoAccountRequired: false,
            demoAccountName: null,
            demoAccountPassword: null,
            notes: "Some notes",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: "lic-1",
          type: "betaLicenseAgreements",
          attributes: { agreementText: "Agreement" },
        },
      });

    const result = await getBetaAppInfo("app-1");

    expect(result.localizations).toHaveLength(1);
    expect(result.localizations[0].id).toBe("loc-1");
    expect(result.localizations[0].locale).toBe("en-US");
    expect(result.reviewDetail).not.toBeNull();
    expect(result.reviewDetail!.id).toBe("review-1");
    expect(result.reviewDetail!.notes).toBe("Some notes");
    expect(result.licenseAgreement).not.toBeNull();
    expect(result.licenseAgreement!.agreementText).toBe("Agreement");
  });

  it("calls the correct ASC API endpoints with query parameters", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockLocalizationsResponse([]))
      .mockResolvedValueOnce(mockReviewDetailResponse(null))
      .mockResolvedValueOnce(mockLicenseAgreementResponse(null));

    await getBetaAppInfo("app-42");

    expect(mockAscFetch).toHaveBeenCalledTimes(3);
    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/betaAppLocalizations?filter[app]=app-42"),
    );
    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/betaAppReviewDetails?filter[app]=app-42"),
    );
    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/betaLicenseAgreements?filter[app]=app-42"),
    );
  });

  it("handles getBetaAppInfo with minimal/missing attributes (exercises all ?? fallback branches)", async () => {
    mockCacheGet.mockReturnValue(null);

    // Localization with all optional attributes undefined (exercises ?? null at lines 42-45)
    mockAscFetch
      .mockResolvedValueOnce({
        data: [
          {
            id: "loc-sparse",
            type: "betaAppLocalizations",
            attributes: {
              locale: "en-US",
              // description, feedbackEmail, marketingUrl, privacyPolicyUrl all undefined
            },
          },
        ],
      })
      // Review detail with all optional attributes undefined (exercises ?? null/false at lines 54-61)
      .mockResolvedValueOnce({
        data: [
          {
            id: "review-sparse",
            type: "betaAppReviewDetails",
            attributes: {
              // contactFirstName, contactLastName, contactPhone, contactEmail,
              // demoAccountRequired, demoAccountName, demoAccountPassword, notes all undefined
            },
          },
        ],
      })
      // License agreement with undefined agreementText (exercises ?? null at line 71)
      .mockResolvedValueOnce({
        data: [
          {
            id: "lic-sparse",
            type: "betaLicenseAgreements",
            attributes: {
              // agreementText undefined
            },
          },
        ],
      });

    const result = await getBetaAppInfo("app-1");

    // Localization ?? null fallbacks
    expect(result.localizations).toHaveLength(1);
    expect(result.localizations[0].description).toBeNull();
    expect(result.localizations[0].feedbackEmail).toBeNull();
    expect(result.localizations[0].marketingUrl).toBeNull();
    expect(result.localizations[0].privacyPolicyUrl).toBeNull();

    // Review detail ?? null/false fallbacks
    expect(result.reviewDetail).not.toBeNull();
    expect(result.reviewDetail!.contactFirstName).toBeNull();
    expect(result.reviewDetail!.contactLastName).toBeNull();
    expect(result.reviewDetail!.contactPhone).toBeNull();
    expect(result.reviewDetail!.contactEmail).toBeNull();
    expect(result.reviewDetail!.demoAccountRequired).toBe(false);
    expect(result.reviewDetail!.demoAccountName).toBeNull();
    expect(result.reviewDetail!.demoAccountPassword).toBeNull();
    expect(result.reviewDetail!.notes).toBeNull();

    // License agreement ?? null fallback
    expect(result.licenseAgreement).not.toBeNull();
    expect(result.licenseAgreement!.agreementText).toBeNull();
  });

  it("handles falsy non-array data for review and license endpoints (exercises empty array fallback)", async () => {
    mockCacheGet.mockReturnValue(null);

    // reviewRes.data and licenseRes.data are null (not array, not truthy)
    // exercises: response.data ? [response.data] : [] where data is null
    mockAscFetch
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const result = await getBetaAppInfo("app-1");

    expect(result.localizations).toEqual([]);
    expect(result.reviewDetail).toBeNull();
    expect(result.licenseAgreement).toBeNull();
  });

  it("handles falsy localization data (exercises locArr empty array fallback)", async () => {
    mockCacheGet.mockReturnValue(null);

    // locRes.data is null → locArr fallback to []
    mockAscFetch
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const result = await getBetaAppInfo("app-1");

    expect(result.localizations).toEqual([]);
    expect(result.reviewDetail).toBeNull();
    expect(result.licenseAgreement).toBeNull();
  });
});

// ── createBetaAppLocalization ──────────────────────────────────────

describe("createBetaAppLocalization", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("POSTs a new localization and returns its ID", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-loc-1" } });

    const id = await createBetaAppLocalization("app-1", "fr-FR", {
      description: "Description en francais",
      feedbackEmail: "fr@test.com",
    });

    expect(id).toBe("new-loc-1");
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaAppLocalizations",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("betaAppLocalizations");
    expect(body.data.attributes.locale).toBe("fr-FR");
    expect(body.data.attributes.description).toBe("Description en francais");
    expect(body.data.attributes.feedbackEmail).toBe("fr@test.com");
    expect(body.data.relationships.app.data).toEqual({ type: "apps", id: "app-1" });
  });

  it("strips empty strings from fields", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-loc-2" } });

    await createBetaAppLocalization("app-1", "en-US", {
      description: "Hello",
      feedbackEmail: "",
      marketingUrl: "",
      privacyPolicyUrl: "https://privacy.example.com",
    });

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes.description).toBe("Hello");
    expect(body.data.attributes.feedbackEmail).toBeUndefined();
    expect(body.data.attributes.marketingUrl).toBeUndefined();
    expect(body.data.attributes.privacyPolicyUrl).toBe("https://privacy.example.com");
  });

  it("preserves null and falsy non-empty values", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-loc-3" } });

    await createBetaAppLocalization("app-1", "en-US", {
      description: null,
      feedbackEmail: "test@test.com",
    });

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes.description).toBeNull();
    expect(body.data.attributes.feedbackEmail).toBe("test@test.com");
  });

  it("invalidates the tf-info cache after creation", async () => {
    mockAscFetch.mockResolvedValue({ data: { id: "new-loc-4" } });

    await createBetaAppLocalization("app-1", "ja", { description: "Japanese" });

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-info:");
  });
});

// ── deleteBetaAppLocalization ──────────────────────────────────────

describe("deleteBetaAppLocalization", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("DELETEs the localization by ID", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await deleteBetaAppLocalization("loc-99");

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaAppLocalizations/loc-99",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("invalidates the tf-info cache after deletion", async () => {
    mockAscFetch.mockResolvedValue(undefined);

    await deleteBetaAppLocalization("loc-99");

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-info:");
  });
});

// ── updateBetaAppLocalization ──────────────────────────────────────

describe("updateBetaAppLocalization", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("PATCHes the localization with provided fields", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppLocalization("loc-1", {
      description: "Updated description",
      marketingUrl: "https://new.example.com",
    });

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaAppLocalizations/loc-1",
      expect.objectContaining({ method: "PATCH" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("betaAppLocalizations");
    expect(body.data.id).toBe("loc-1");
    expect(body.data.attributes.description).toBe("Updated description");
    expect(body.data.attributes.marketingUrl).toBe("https://new.example.com");
  });

  it("sends partial fields without extra keys", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppLocalization("loc-2", { feedbackEmail: "new@test.com" });

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes).toEqual({ feedbackEmail: "new@test.com" });
  });

  it("invalidates the tf-info cache after update", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppLocalization("loc-1", { description: "x" });

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-info:");
  });
});

// ── updateBetaAppReviewDetail ──────────────────────────────────────

describe("updateBetaAppReviewDetail", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("PATCHes the review detail with provided fields", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppReviewDetail("detail-1", {
      contactFirstName: "Jane",
      contactLastName: "Doe",
      contactEmail: "jane@test.com",
      contactPhone: "+1234567890",
      demoAccountRequired: true,
      demoAccountName: "demo@test.com",
      demoAccountPassword: "secret",
      notes: "Test notes",
    });

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaAppReviewDetails/detail-1",
      expect.objectContaining({ method: "PATCH" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("betaAppReviewDetails");
    expect(body.data.id).toBe("detail-1");
    expect(body.data.attributes.contactFirstName).toBe("Jane");
    expect(body.data.attributes.contactLastName).toBe("Doe");
    expect(body.data.attributes.contactEmail).toBe("jane@test.com");
    expect(body.data.attributes.contactPhone).toBe("+1234567890");
    expect(body.data.attributes.demoAccountRequired).toBe(true);
    expect(body.data.attributes.demoAccountName).toBe("demo@test.com");
    expect(body.data.attributes.demoAccountPassword).toBe("secret");
    expect(body.data.attributes.notes).toBe("Test notes");
  });

  it("sends only the fields that were provided", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppReviewDetail("detail-2", {
      contactFirstName: "Alice",
      demoAccountRequired: false,
    });

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes).toEqual({
      contactFirstName: "Alice",
      demoAccountRequired: false,
    });
  });

  it("invalidates the tf-info cache after update", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaAppReviewDetail("detail-1", { notes: "Updated" });

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-info:");
  });
});

// ── updateBetaLicenseAgreement ─────────────────────────────────────

describe("updateBetaLicenseAgreement", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("PATCHes the license agreement with new text", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaLicenseAgreement("lic-1", "New agreement text");

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaLicenseAgreements/lic-1",
      expect.objectContaining({ method: "PATCH" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("betaLicenseAgreements");
    expect(body.data.id).toBe("lic-1");
    expect(body.data.attributes.agreementText).toBe("New agreement text");
  });

  it("sends empty string as agreement text", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaLicenseAgreement("lic-2", "");

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes.agreementText).toBe("");
  });

  it("invalidates the tf-info cache after update", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateBetaLicenseAgreement("lic-1", "Updated");

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-info:");
  });
});
