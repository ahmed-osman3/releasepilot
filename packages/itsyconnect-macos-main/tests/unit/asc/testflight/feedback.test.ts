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
  listFeedback,
  getFeedbackCrashLog,
  deleteFeedbackItem,
} from "@/lib/asc/testflight/feedback";
import { FEEDBACK_TTL } from "@/lib/asc/testflight/types";

// ── Mock ASC response helpers ──────────────────────────────────

function mockScreenshotResponse() {
  return {
    data: [
      {
        id: "ss-1",
        type: "betaFeedbackScreenshotSubmissions",
        attributes: {
          comment: "Button is misaligned on iPad",
          email: "tester1@example.com",
          createdDate: "2026-02-20T10:00:00Z",
          buildBundleId: "com.example.app",
          appPlatform: "IOS",
          devicePlatform: "IOS",
          deviceFamily: "iPad",
          deviceModel: "iPad Pro (12.9-inch)",
          osVersion: "18.3",
          locale: "en-US",
          architecture: "arm64e",
          connectionType: "WiFi",
          batteryPercentage: 85,
          timeZone: "America/New_York",
          appUptimeInMilliseconds: 120000,
          diskBytesAvailable: 50000000000,
          diskBytesTotal: 256000000000,
          screenWidthInPoints: 1024,
          screenHeightInPoints: 1366,
          pairedAppleWatch: "Apple Watch Series 9",
          screenshots: [
            {
              url: "https://cdn.apple.com/screenshot1.png",
              width: 2048,
              height: 2732,
              expirationDate: "2026-03-20T10:00:00Z",
            },
            {
              url: "https://cdn.apple.com/screenshot2.png",
              width: 2048,
              height: 2732,
              expirationDate: "2026-03-20T10:00:00Z",
            },
          ],
        },
        relationships: {
          tester: {
            data: { id: "tester-1", type: "betaTesters" },
          },
          build: {
            data: { id: "build-100", type: "builds" },
          },
        },
      },
    ],
    included: [
      {
        id: "tester-1",
        type: "betaTesters",
        attributes: {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane.smith@example.com",
        },
      },
      {
        id: "build-100",
        type: "builds",
        attributes: {
          version: "42",
        },
      },
    ],
  };
}

function mockCrashResponse() {
  return {
    data: [
      {
        id: "crash-1",
        type: "betaFeedbackCrashSubmissions",
        attributes: {
          comment: "App crashed when opening settings",
          email: "tester2@example.com",
          createdDate: "2026-02-21T14:30:00Z",
          buildBundleId: "com.example.app",
          appPlatform: "IOS",
          devicePlatform: "IOS",
          deviceFamily: "iPhone",
          deviceModel: "iPhone 16 Pro",
          osVersion: "18.3.1",
          locale: "en-GB",
          architecture: "arm64e",
          connectionType: "Cellular",
          batteryPercentage: 45,
          timeZone: "Europe/London",
          appUptimeInMilliseconds: 5000,
          diskBytesAvailable: 30000000000,
          diskBytesTotal: 128000000000,
          screenWidthInPoints: 393,
          screenHeightInPoints: 852,
          pairedAppleWatch: null,
        },
        relationships: {
          tester: {
            data: { id: "tester-2", type: "betaTesters" },
          },
          build: {
            data: { id: "build-101", type: "builds" },
          },
          crashLog: {
            data: { id: "log-1", type: "betaFeedbackCrashLogs" },
          },
        },
      },
    ],
    included: [
      {
        id: "tester-2",
        type: "betaTesters",
        attributes: {
          firstName: "Alex",
          lastName: "Johnson",
          email: "alex.j@example.com",
        },
      },
      {
        id: "build-101",
        type: "builds",
        attributes: {
          version: "43",
        },
      },
    ],
  };
}

function emptyResponse() {
  return { data: [] };
}

// ── listFeedback ───────────────────────────────────────────────

describe("listFeedback", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("returns cached data when available", async () => {
    const cached = [{ id: "ss-1", type: "screenshot", createdDate: "2026-02-20T10:00:00Z" }];
    mockCacheGet.mockReturnValue(cached);

    const result = await listFeedback("app-1");

    expect(result).toBe(cached);
    expect(mockCacheGet).toHaveBeenCalledWith("tf-feedback:app-1");
    expect(mockAscFetch).not.toHaveBeenCalled();
  });

  it("fetches both screenshot and crash submissions, merges and sorts by date descending", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockScreenshotResponse())
      .mockResolvedValueOnce(mockCrashResponse());

    const result = await listFeedback("app-1");

    // Two parallel fetches: screenshots and crashes
    expect(mockAscFetch).toHaveBeenCalledTimes(2);
    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/apps/app-1/betaFeedbackScreenshotSubmissions?"),
    );
    expect(mockAscFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/apps/app-1/betaFeedbackCrashSubmissions?"),
    );

    // Merged result: crash (Feb 21) before screenshot (Feb 20)
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("crash-1");
    expect(result[0].type).toBe("crash");
    expect(result[1].id).toBe("ss-1");
    expect(result[1].type).toBe("screenshot");

    // Cache set with correct key and TTL
    expect(mockCacheSet).toHaveBeenCalledWith("tf-feedback:app-1", result, FEEDBACK_TTL);
  });

  it("bypasses cache when forceRefresh is true", async () => {
    mockCacheGet.mockReturnValue([{ id: "stale" }]);
    mockAscFetch
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1", true);

    expect(result).toEqual([]);
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(mockAscFetch).toHaveBeenCalledTimes(2);
  });

  it("parses included tester and build data correctly", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockScreenshotResponse())
      .mockResolvedValueOnce(mockCrashResponse());

    const result = await listFeedback("app-1");

    const screenshot = result.find((f) => f.id === "ss-1")!;
    expect(screenshot.testerName).toBe("Jane Smith");
    expect(screenshot.buildNumber).toBe("42");
    expect(screenshot.comment).toBe("Button is misaligned on iPad");
    expect(screenshot.email).toBe("tester1@example.com");
    expect(screenshot.buildBundleId).toBe("com.example.app");
    expect(screenshot.deviceModel).toBe("iPad Pro (12.9-inch)");
    expect(screenshot.osVersion).toBe("18.3");
    expect(screenshot.batteryPercentage).toBe(85);
    expect(screenshot.appUptimeMs).toBe(120000);
    expect(screenshot.screenWidth).toBe(1024);
    expect(screenshot.screenHeight).toBe(1366);
    expect(screenshot.pairedAppleWatch).toBe("Apple Watch Series 9");

    const crash = result.find((f) => f.id === "crash-1")!;
    expect(crash.testerName).toBe("Alex Johnson");
    expect(crash.buildNumber).toBe("43");
    expect(crash.comment).toBe("App crashed when opening settings");
    expect(crash.deviceModel).toBe("iPhone 16 Pro");
  });

  it("handles screenshot arrays", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockScreenshotResponse())
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");
    const item = result[0];

    expect(item.screenshots).toHaveLength(2);
    expect(item.screenshots[0]).toEqual({
      url: "https://cdn.apple.com/screenshot1.png",
      width: 2048,
      height: 2732,
      expirationDate: "2026-03-20T10:00:00Z",
    });
    expect(item.screenshots[1].url).toBe("https://cdn.apple.com/screenshot2.png");
  });

  it("crash items have empty screenshots array", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(mockCrashResponse());

    const result = await listFeedback("app-1");

    expect(result[0].type).toBe("crash");
    expect(result[0].screenshots).toEqual([]);
  });

  it("detects crash log relationship presence", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(mockScreenshotResponse())
      .mockResolvedValueOnce(mockCrashResponse());

    const result = await listFeedback("app-1");

    const screenshot = result.find((f) => f.type === "screenshot")!;
    expect(screenshot.hasCrashLog).toBe(false);

    const crash = result.find((f) => f.type === "crash")!;
    expect(crash.hasCrashLog).toBe(true);
  });

  it("handles crash submission without crashLog relationship", async () => {
    mockCacheGet.mockReturnValue(null);
    const crashRes = mockCrashResponse();
    (crashRes.data[0].relationships as Record<string, unknown>).crashLog = undefined;
    mockAscFetch
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(crashRes);

    const result = await listFeedback("app-1");

    expect(result[0].hasCrashLog).toBe(false);
  });

  it("handles tester with first name only (no last name)", async () => {
    mockCacheGet.mockReturnValue(null);
    const ssRes = mockScreenshotResponse();
    (ssRes.included[0] as Record<string, unknown>).attributes = {
      firstName: "Jane",
      email: "jane@example.com",
    };
    mockAscFetch
      .mockResolvedValueOnce(ssRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result[0].testerName).toBe("Jane");
  });

  it("handles missing tester in included array", async () => {
    mockCacheGet.mockReturnValue(null);
    const ssRes = mockScreenshotResponse();
    ssRes.included = ssRes.included.filter((i) => i.type !== "betaTesters");
    mockAscFetch
      .mockResolvedValueOnce(ssRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result[0].testerName).toBeNull();
  });

  it("handles missing build in included array", async () => {
    mockCacheGet.mockReturnValue(null);
    const ssRes = mockScreenshotResponse();
    ssRes.included = ssRes.included.filter((i) => i.type !== "builds");
    mockAscFetch
      .mockResolvedValueOnce(ssRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result[0].buildNumber).toBeNull();
  });

  it("handles response with no included array", async () => {
    mockCacheGet.mockReturnValue(null);
    const ssRes = mockScreenshotResponse();
    delete (ssRes as Record<string, unknown>).included;
    mockAscFetch
      .mockResolvedValueOnce(ssRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result[0].testerName).toBeNull();
    expect(result[0].buildNumber).toBeNull();
  });

  it("handles single resource (non-array) in data field", async () => {
    mockCacheGet.mockReturnValue(null);
    const singleRes = {
      data: {
        id: "ss-solo",
        type: "betaFeedbackScreenshotSubmissions",
        attributes: {
          comment: "Solo feedback",
          email: null,
          createdDate: "2026-02-15T08:00:00Z",
          buildBundleId: null,
          appPlatform: "IOS",
          devicePlatform: "IOS",
          deviceFamily: "iPhone",
          deviceModel: "iPhone 15",
          osVersion: "18.2",
          locale: "fr-FR",
          architecture: "arm64e",
          connectionType: "WiFi",
          batteryPercentage: 90,
          timeZone: "Europe/Paris",
          appUptimeInMilliseconds: 60000,
          diskBytesAvailable: 40000000000,
          diskBytesTotal: 128000000000,
          screenWidthInPoints: 393,
          screenHeightInPoints: 852,
          pairedAppleWatch: null,
          screenshots: [],
        },
      },
    };
    mockAscFetch
      .mockResolvedValueOnce(singleRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ss-solo");
    expect(result[0].comment).toBe("Solo feedback");
  });

  it("handles both lists empty", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch
      .mockResolvedValueOnce(emptyResponse())
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result).toEqual([]);
    expect(mockCacheSet).toHaveBeenCalledWith("tf-feedback:app-1", [], FEEDBACK_TTL);
  });

  it("handles items with missing/null attributes (exercises all ?? fallback branches)", async () => {
    mockCacheGet.mockReturnValue(null);

    // Tester with no firstName exercises the testerName null branch (line 76)
    // All device info attributes are undefined to exercise ?? null fallbacks (lines 105-127)
    const minimalScreenshotRes = {
      data: [
        {
          id: "ss-minimal",
          type: "betaFeedbackScreenshotSubmissions",
          attributes: {
            // comment, email, and all device info are intentionally omitted
            createdDate: "2026-02-18T09:00:00Z",
          },
          relationships: {
            tester: {
              data: { id: "tester-no-name", type: "betaTesters" },
            },
            build: {
              data: { id: "build-200", type: "builds" },
            },
          },
        },
      ],
      included: [
        {
          id: "tester-no-name",
          type: "betaTesters",
          attributes: {
            // No firstName – testerName should be null
            lastName: "OnlyLast",
            email: "nofirst@example.com",
          },
        },
        {
          id: "build-200",
          type: "builds",
          attributes: {
            // version missing – buildNumber should fall back via ??
          },
        },
      ],
    };

    mockAscFetch
      .mockResolvedValueOnce(minimalScreenshotRes)
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-1");

    expect(result).toHaveLength(1);
    const item = result[0];

    // testerName null because no firstName
    expect(item.testerName).toBeNull();

    // comment and email fallback to null via ??
    expect(item.comment).toBeNull();
    expect(item.email).toBeNull();

    // All device info attributes fallback to null via ??
    expect(item.buildBundleId).toBeNull();
    expect(item.appPlatform).toBeNull();
    expect(item.devicePlatform).toBeNull();
    expect(item.deviceFamily).toBeNull();
    expect(item.deviceModel).toBeNull();
    expect(item.osVersion).toBeNull();
    expect(item.locale).toBeNull();
    expect(item.architecture).toBeNull();
    expect(item.connectionType).toBeNull();
    expect(item.batteryPercentage).toBeNull();
    expect(item.timeZone).toBeNull();
    expect(item.appUptimeMs).toBeNull();
    expect(item.diskBytesAvailable).toBeNull();
    expect(item.diskBytesTotal).toBeNull();
    expect(item.screenWidth).toBeNull();
    expect(item.screenHeight).toBeNull();
    expect(item.pairedAppleWatch).toBeNull();

    // buildNumber null because version attribute is missing
    expect(item.buildNumber).toBeNull();
  });

  it("returns null testerName when firstName is whitespace-only", async () => {
    mockCacheGet.mockReturnValue(null);

    mockAscFetch
      .mockResolvedValueOnce({
        data: [
          {
            id: "ss-ws",
            type: "betaFeedbackScreenshotSubmissions",
            attributes: { createdDate: "2026-02-18T09:00:00Z" },
            relationships: {
              tester: { data: { id: "tester-ws", type: "betaTesters" } },
            },
          },
        ],
        included: [
          {
            id: "tester-ws",
            type: "betaTesters",
            attributes: { firstName: "  ", lastName: "" },
          },
        ],
      })
      .mockResolvedValueOnce(emptyResponse());

    const result = await listFeedback("app-ws");
    expect(result[0].testerName).toBeNull();
  });
});

// ── getFeedbackCrashLog ────────────────────────────────────────

describe("getFeedbackCrashLog", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
  });

  it("returns crash log text on success", async () => {
    mockAscFetch.mockResolvedValue({
      data: {
        attributes: {
          logText: "Exception Type: EXC_CRASH (SIGABRT)\nThread 0 Crashed",
        },
      },
    });

    const result = await getFeedbackCrashLog("crash-1");

    expect(result).toEqual({
      logText: "Exception Type: EXC_CRASH (SIGABRT)\nThread 0 Crashed",
    });
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaFeedbackCrashSubmissions/crash-1/crashLog",
    );
  });

  it("returns null on error", async () => {
    mockAscFetch.mockRejectedValue(new Error("Not found"));

    const result = await getFeedbackCrashLog("nonexistent");

    expect(result).toBeNull();
  });
});

// ── deleteFeedbackItem ─────────────────────────────────────────

describe("deleteFeedbackItem", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidatePrefix.mockReset();
  });

  it("deletes a screenshot submission", async () => {
    mockAscFetch.mockResolvedValue(null);

    await deleteFeedbackItem("ss-1", "screenshot");

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaFeedbackScreenshotSubmissions/ss-1",
      { method: "DELETE" },
    );
  });

  it("deletes a crash submission", async () => {
    mockAscFetch.mockResolvedValue(null);

    await deleteFeedbackItem("crash-1", "crash");

    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/betaFeedbackCrashSubmissions/crash-1",
      { method: "DELETE" },
    );
  });

  it("invalidates feedback cache after deletion", async () => {
    mockAscFetch.mockResolvedValue(null);

    await deleteFeedbackItem("ss-1", "screenshot");

    expect(mockCacheInvalidatePrefix).toHaveBeenCalledWith("tf-feedback:");
  });
});
