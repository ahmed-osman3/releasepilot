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
  updateReviewDetail,
  createReviewDetail,
  invalidateVersionsCache,
} from "@/lib/asc/review-mutations";

describe("review-mutations", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
  });

  describe("updateReviewDetail", () => {
    it("PATCHes the review detail with given attributes", async () => {
      mockAscFetch.mockResolvedValue({});

      await updateReviewDetail("review-1", {
        contactEmail: "test@example.com",
        notes: "Test notes",
      });

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreReviewDetails/review-1",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.type).toBe("appStoreReviewDetails");
      expect(body.data.id).toBe("review-1");
      expect(body.data.attributes.contactEmail).toBe("test@example.com");
      expect(body.data.attributes.notes).toBe("Test notes");
    });
  });

  describe("createReviewDetail", () => {
    it("POSTs a new review detail for the version", async () => {
      mockAscFetch.mockResolvedValue({});

      await createReviewDetail("ver-1", {
        contactEmail: "test@example.com",
        demoAccountRequired: false,
      });

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreReviewDetails",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.type).toBe("appStoreReviewDetails");
      expect(body.data.attributes.contactEmail).toBe("test@example.com");
      expect(body.data.relationships.appStoreVersion.data.id).toBe("ver-1");
    });
  });

  describe("invalidateVersionsCache", () => {
    it("invalidates the cache for the given app", () => {
      invalidateVersionsCache("app-1");
      expect(mockCacheInvalidate).toHaveBeenCalledWith("versions:app-1");
    });
  });
});
