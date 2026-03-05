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
  updateVersionAttributes,
  enablePhasedRelease,
  disablePhasedRelease,
  createVersion,
  deleteVersion,
  cancelSubmission,
  submitForReview,
  releaseVersion,
  selectBuildForVersion,
  invalidateVersionsCache,
} from "@/lib/asc/version-mutations";

describe("version-mutations", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
  });

  describe("updateVersionAttributes", () => {
    it("PATCHes version with given attributes", async () => {
      mockAscFetch.mockResolvedValue({});

      await updateVersionAttributes("ver-1", {
        releaseType: "MANUAL",
        earliestReleaseDate: "2025-01-01T00:00:00Z",
      });

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersions/ver-1",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.type).toBe("appStoreVersions");
      expect(body.data.id).toBe("ver-1");
      expect(body.data.attributes.releaseType).toBe("MANUAL");
      expect(body.data.attributes.earliestReleaseDate).toBe("2025-01-01T00:00:00Z");
    });
  });

  describe("enablePhasedRelease", () => {
    it("POSTs a phased release for the version", async () => {
      mockAscFetch.mockResolvedValue({});

      await enablePhasedRelease("ver-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionPhasedReleases",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.phasedReleaseState).toBe("INACTIVE");
      expect(body.data.relationships.appStoreVersion.data.id).toBe("ver-1");
    });
  });

  describe("disablePhasedRelease", () => {
    it("DELETEs the phased release", async () => {
      mockAscFetch.mockResolvedValue(null);

      await disablePhasedRelease("phased-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionPhasedReleases/phased-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("createVersion", () => {
    it("POSTs a new version and returns its ID", async () => {
      mockAscFetch.mockResolvedValue({ data: { id: "new-ver-1" } });

      const id = await createVersion("app-1", "2.0.0", "IOS");

      expect(id).toBe("new-ver-1");
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersions",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.versionString).toBe("2.0.0");
      expect(body.data.attributes.platform).toBe("IOS");
      expect(body.data.relationships.app.data.id).toBe("app-1");
    });

    it("invalidates the versions cache after creation", async () => {
      mockAscFetch.mockResolvedValue({ data: { id: "new-ver-1" } });

      await createVersion("app-1", "2.0.0", "IOS");

      expect(mockCacheInvalidate).toHaveBeenCalledWith("versions:app-1");
    });
  });

  describe("deleteVersion", () => {
    it("DELETEs the version", async () => {
      mockAscFetch.mockResolvedValue(null);

      await deleteVersion("ver-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersions/ver-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("cancelSubmission", () => {
    it("fetches the submission then DELETEs it", async () => {
      mockAscFetch
        .mockResolvedValueOnce({ data: { id: "sub-1" } })
        .mockResolvedValueOnce(null);

      await cancelSubmission("ver-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersions/ver-1/appStoreVersionSubmission",
      );
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionSubmissions/sub-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("submitForReview", () => {
    it("creates submission, adds version item, then confirms", async () => {
      mockAscFetch
        .mockResolvedValueOnce({ data: { id: "sub-1" } }) // step 1: create submission
        .mockResolvedValueOnce({}) // step 2: add item
        .mockResolvedValueOnce({}); // step 3: confirm

      await submitForReview("app-1", "ver-1", "MAC_OS");

      // Step 1: create review submission
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/reviewSubmissions",
        expect.objectContaining({ method: "POST" }),
      );
      const step1Body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(step1Body.data.type).toBe("reviewSubmissions");
      expect(step1Body.data.attributes.platform).toBe("MAC_OS");
      expect(step1Body.data.relationships.app.data.id).toBe("app-1");

      // Step 2: add version as item
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/reviewSubmissionItems",
        expect.objectContaining({ method: "POST" }),
      );
      const step2Body = JSON.parse(mockAscFetch.mock.calls[1][1].body);
      expect(step2Body.data.type).toBe("reviewSubmissionItems");
      expect(step2Body.data.relationships.reviewSubmission.data.id).toBe("sub-1");
      expect(step2Body.data.relationships.appStoreVersion.data.id).toBe("ver-1");

      // Step 3: confirm submission
      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/reviewSubmissions/sub-1",
        expect.objectContaining({ method: "PATCH" }),
      );
      const step3Body = JSON.parse(mockAscFetch.mock.calls[2][1].body);
      expect(step3Body.data.attributes.submitted).toBe(true);
    });

    it("cleans up dangling submission when step 2 fails", async () => {
      mockAscFetch
        .mockResolvedValueOnce({ data: { id: "sub-1" } }) // step 1: create
        .mockRejectedValueOnce(new Error("add item failed")) // step 2: fails
        .mockResolvedValueOnce(null); // cleanup DELETE

      await expect(submitForReview("app-1", "ver-1", "IOS")).rejects.toThrow("add item failed");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/reviewSubmissions/sub-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("cleans up dangling submission when step 3 fails", async () => {
      mockAscFetch
        .mockResolvedValueOnce({ data: { id: "sub-1" } }) // step 1: create
        .mockResolvedValueOnce({}) // step 2: add item
        .mockRejectedValueOnce(new Error("confirm failed")) // step 3: fails
        .mockResolvedValueOnce(null); // cleanup DELETE

      await expect(submitForReview("app-1", "ver-1", "IOS")).rejects.toThrow("confirm failed");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/reviewSubmissions/sub-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("still throws original error when cleanup DELETE also fails", async () => {
      mockAscFetch
        .mockResolvedValueOnce({ data: { id: "sub-1" } }) // step 1: create
        .mockRejectedValueOnce(new Error("add item failed")) // step 2: fails
        .mockRejectedValueOnce(new Error("delete also failed")); // cleanup also fails

      await expect(submitForReview("app-1", "ver-1", "IOS")).rejects.toThrow("add item failed");
    });
  });

  describe("releaseVersion", () => {
    it("POSTs a release request for the version", async () => {
      mockAscFetch.mockResolvedValue({});

      await releaseVersion("ver-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersionReleaseRequests",
        expect.objectContaining({ method: "POST" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.type).toBe("appStoreVersionReleaseRequests");
      expect(body.data.relationships.appStoreVersion.data.id).toBe("ver-1");
    });
  });

  describe("selectBuildForVersion", () => {
    it("PATCHes the build relationship for the version", async () => {
      mockAscFetch.mockResolvedValue({});

      await selectBuildForVersion("ver-1", "build-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appStoreVersions/ver-1/relationships/build",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.type).toBe("builds");
      expect(body.data.id).toBe("build-1");
    });

    it("sends null data to remove the build", async () => {
      mockAscFetch.mockResolvedValue({});

      await selectBuildForVersion("ver-1", null);

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data).toBeNull();
    });
  });

  describe("invalidateVersionsCache", () => {
    it("invalidates the cache for the given app", () => {
      invalidateVersionsCache("app-1");
      expect(mockCacheInvalidate).toHaveBeenCalledWith("versions:app-1");
    });
  });
});
