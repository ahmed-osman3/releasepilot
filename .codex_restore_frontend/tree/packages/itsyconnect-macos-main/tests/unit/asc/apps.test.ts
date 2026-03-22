import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

import { listApps, buildIconUrl, updateAppAttributes } from "@/lib/asc/apps";

const TEMPLATE_URL =
  "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/cd/ef/AppIcon.icns/{w}x{h}bb.{f}";

function mockAppsResponse(
  apps: Array<{ id: string; name?: string }>,
) {
  return {
    data: apps.map((a) => ({
      id: a.id,
      attributes: {
        name: a.name ?? "App",
        bundleId: "com.test",
        sku: "SKU",
        primaryLocale: "en-US",
      },
    })),
  };
}

function mockBuildsResponse(templateUrl?: string) {
  if (!templateUrl) return { data: [] };
  return {
    data: [
      {
        id: "build-1",
        attributes: { iconAssetToken: { templateUrl } },
      },
    ],
  };
}

describe("buildIconUrl", () => {
  it("replaces placeholders with default size", () => {
    expect(buildIconUrl(TEMPLATE_URL)).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/cd/ef/AppIcon.icns/128x128bb.png",
    );
  });

  it("replaces placeholders with custom size", () => {
    expect(buildIconUrl(TEMPLATE_URL, 64)).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/cd/ef/AppIcon.icns/64x64bb.png",
    );
  });
});

describe("listApps", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it("returns cached data when available", async () => {
    const cached = [
      { id: "1", attributes: { name: "App", bundleId: "com.x", sku: "x", primaryLocale: "en-US", iconUrl: "http://icon" } },
    ];
    mockCacheGet.mockReturnValue(cached);

    const result = await listApps();
    expect(result).toBe(cached);
    expect(mockAscFetch).not.toHaveBeenCalled();
  });

  it("bypasses cache when forceRefresh is true", async () => {
    mockCacheGet.mockReturnValue([{ id: "old" }]);
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([]))
    ;

    await listApps(true);
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockAscFetch).toHaveBeenCalled();
  });

  it("fetches apps and build icons from ASC API", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([{ id: "123", name: "My App" }]))
      .mockResolvedValueOnce(mockBuildsResponse(TEMPLATE_URL));

    const result = await listApps();
    expect(result).toEqual([
      {
        id: "123",
        attributes: {
          name: "My App",
          bundleId: "com.test",
          sku: "SKU",
          primaryLocale: "en-US",
          iconUrl: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/cd/ef/AppIcon.icns/128x128bb.png",
        },
      },
    ]);
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/builds?filter[app]=123&sort=-uploadedDate&limit=1&fields[builds]=iconAssetToken",
    );
    expect(mockCacheSet).toHaveBeenCalledWith("apps", result, 3_600_000);
  });

  it("sets iconUrl to null when build has no icon token", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([{ id: "1" }]))
      .mockResolvedValueOnce({ data: [{ id: "b1", attributes: {} }] });

    const result = await listApps();
    expect(result[0].attributes.iconUrl).toBeNull();
  });

  it("sets iconUrl to null when no builds exist", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([{ id: "1" }]))
      .mockResolvedValueOnce(mockBuildsResponse());

    const result = await listApps();
    expect(result[0].attributes.iconUrl).toBeNull();
  });

  it("sets iconUrl to null when build fetch fails", async () => {
    mockCacheGet.mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([{ id: "1" }]))
      .mockRejectedValueOnce(new Error("network error"));

    const result = await listApps();
    expect(result[0].attributes.iconUrl).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to fetch build icon:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("handles empty app list", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch.mockResolvedValueOnce(mockAppsResponse([]));

    const result = await listApps();
    expect(result).toEqual([]);
    // Only the apps call, no build calls
    expect(mockAscFetch).toHaveBeenCalledTimes(1);
  });

  it("fetches icons independently per app", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockAppsResponse([{ id: "1" }, { id: "2" }]))
      .mockResolvedValueOnce(mockBuildsResponse(TEMPLATE_URL))
      .mockResolvedValueOnce(mockBuildsResponse());

    const result = await listApps();
    expect(result[0].attributes.iconUrl).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/ab/cd/ef/AppIcon.icns/128x128bb.png",
    );
    expect(result[1].attributes.iconUrl).toBeNull();
  });
});

describe("updateAppAttributes", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheSet.mockReset();
  });

  it("PATCHes the app and invalidates cache", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateAppAttributes("app-1", {
      contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT",
    });

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/apps/app-1",
      expect.objectContaining({ method: "PATCH" }),
    );

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.type).toBe("apps");
    expect(body.data.id).toBe("app-1");
    expect(body.data.attributes.contentRightsDeclaration).toBe(
      "DOES_NOT_USE_THIRD_PARTY_CONTENT",
    );

    expect(mockCacheSet).toHaveBeenCalledWith("apps", null, 0);
  });

  it("sends subscription URL attributes", async () => {
    mockAscFetch.mockResolvedValue({});

    await updateAppAttributes("app-1", {
      subscriptionStatusUrl: "https://example.com/sub",
      subscriptionStatusUrlForSandbox: null,
    });

    const body = JSON.parse(mockAscFetch.mock.calls[0][1].body);
    expect(body.data.attributes.subscriptionStatusUrl).toBe("https://example.com/sub");
    expect(body.data.attributes.subscriptionStatusUrlForSandbox).toBeNull();
  });
});
