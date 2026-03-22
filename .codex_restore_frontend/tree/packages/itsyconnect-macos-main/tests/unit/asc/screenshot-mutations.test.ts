import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheInvalidate = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheInvalidate: (...args: unknown[]) => mockCacheInvalidate(...args),
}));

vi.stubGlobal("fetch", mockFetch);

import {
  uploadScreenshot,
  deleteScreenshot,
  reorderScreenshots,
  createScreenshotSet,
  deleteScreenshotSet,
  invalidateScreenshotCache,
} from "@/lib/asc/screenshot-mutations";

describe("screenshot-mutations", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
    mockFetch.mockReset();
  });

  describe("uploadScreenshot", () => {
    it("reserves, uploads binary, and commits with MD5", async () => {
      const fileBuffer = Buffer.from("fake-png-data");

      // Step 1: Reserve
      mockAscFetch.mockResolvedValueOnce({
        data: {
          id: "ss-1",
          type: "appScreenshots",
          attributes: {
            uploadOperations: [
              {
                method: "PUT",
                url: "https://upload.example.com/chunk0",
                length: fileBuffer.length,
                offset: 0,
                requestHeaders: [
                  { name: "Content-Type", value: "application/octet-stream" },
                ],
              },
            ],
          },
        },
      });

      // Step 2: Upload binary
      mockFetch.mockResolvedValueOnce({ ok: true });

      // Step 3: Commit
      mockAscFetch.mockResolvedValueOnce({
        data: {
          id: "ss-1",
          type: "appScreenshots",
          attributes: {
            fileSize: fileBuffer.length,
            fileName: "screenshot.png",
            sourceFileChecksum: "abc123",
            assetDeliveryState: { state: "COMPLETE" },
            assetToken: "token-123",
          },
        },
      });

      const result = await uploadScreenshot("set-1", "screenshot.png", fileBuffer);

      expect(result.id).toBe("ss-1");
      expect(result.attributes.fileName).toBe("screenshot.png");

      // Verify reserve call
      const reserveBody = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(reserveBody.data.attributes.fileName).toBe("screenshot.png");
      expect(reserveBody.data.attributes.fileSize).toBe(fileBuffer.length);
      expect(reserveBody.data.relationships.appScreenshotSet.data.id).toBe("set-1");

      // Verify upload call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://upload.example.com/chunk0",
        expect.objectContaining({ method: "PUT" }),
      );

      // Verify commit call
      const commitBody = JSON.parse(mockAscFetch.mock.calls[1][1].body);
      expect(commitBody.data.attributes.uploaded).toBe(true);
      expect(commitBody.data.attributes.sourceFileChecksum).toBeTruthy();
    });

    it("throws when binary upload fails", async () => {
      const fileBuffer = Buffer.from("data");

      mockAscFetch.mockResolvedValueOnce({
        data: {
          id: "ss-1",
          attributes: {
            uploadOperations: [
              {
                method: "PUT",
                url: "https://upload.example.com/chunk0",
                length: fileBuffer.length,
                offset: 0,
                requestHeaders: [],
              },
            ],
          },
        },
      });

      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Server Error" });

      await expect(
        uploadScreenshot("set-1", "screenshot.png", fileBuffer),
      ).rejects.toThrow("Screenshot upload failed: 500");
    });
  });

  describe("deleteScreenshot", () => {
    it("DELETEs the screenshot", async () => {
      mockAscFetch.mockResolvedValue(null);

      await deleteScreenshot("ss-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appScreenshots/ss-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("reorderScreenshots", () => {
    it("PATCHes the screenshot set relationship order", async () => {
      mockAscFetch.mockResolvedValue(null);

      await reorderScreenshots("set-1", ["ss-2", "ss-1", "ss-3"]);

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appScreenshotSets/set-1/relationships/appScreenshots",
        expect.objectContaining({ method: "PATCH" }),
      );

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data).toEqual([
        { type: "appScreenshots", id: "ss-2" },
        { type: "appScreenshots", id: "ss-1" },
        { type: "appScreenshots", id: "ss-3" },
      ]);
    });
  });

  describe("createScreenshotSet", () => {
    it("POSTs a new screenshot set and returns its ID", async () => {
      mockAscFetch.mockResolvedValue({ data: { id: "new-set-1" } });

      const id = await createScreenshotSet("loc-1", "APP_IPHONE_67");

      expect(id).toBe("new-set-1");

      const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
      expect(body.data.attributes.screenshotDisplayType).toBe("APP_IPHONE_67");
      expect(
        body.data.relationships.appStoreVersionLocalization.data.id,
      ).toBe("loc-1");
    });
  });

  describe("deleteScreenshotSet", () => {
    it("DELETEs the screenshot set", async () => {
      mockAscFetch.mockResolvedValue(null);

      await deleteScreenshotSet("set-1");

      expect(mockAscFetch).toHaveBeenCalledWith(
        "/v1/appScreenshotSets/set-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("invalidateScreenshotCache", () => {
    it("invalidates the cache for the given localization", () => {
      invalidateScreenshotCache("loc-1");
      expect(mockCacheInvalidate).toHaveBeenCalledWith("screenshotSets:loc-1");
    });
  });
});
