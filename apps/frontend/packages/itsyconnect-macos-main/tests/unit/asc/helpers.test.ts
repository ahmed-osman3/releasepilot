import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

import { withCache, normalizeArray } from "@/lib/asc/helpers";

describe("withCache", () => {
  beforeEach(() => {
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it("returns cached value on hit", async () => {
    mockCacheGet.mockReturnValue("cached-data");
    const fetchFn = vi.fn();

    const result = await withCache("key", 1000, false, fetchFn);
    expect(result).toBe("cached-data");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("calls fetchFn on cache miss and caches result", async () => {
    mockCacheGet.mockReturnValue(null);
    const fetchFn = vi.fn().mockResolvedValue("fresh-data");

    const result = await withCache("key", 5000, false, fetchFn);
    expect(result).toBe("fresh-data");
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledWith("key", "fresh-data", 5000);
  });

  it("bypasses cache when forceRefresh is true", async () => {
    mockCacheGet.mockReturnValue("stale");
    const fetchFn = vi.fn().mockResolvedValue("refreshed");

    const result = await withCache("key", 1000, true, fetchFn);
    expect(result).toBe("refreshed");
    expect(mockCacheGet).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledWith("key", "refreshed", 1000);
  });

  it("propagates errors from fetchFn", async () => {
    mockCacheGet.mockReturnValue(null);
    const fetchFn = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(withCache("key", 1000, false, fetchFn)).rejects.toThrow("fetch failed");
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});

describe("normalizeArray", () => {
  it("passes through arrays unchanged", () => {
    const arr = [1, 2, 3];
    expect(normalizeArray(arr)).toBe(arr);
  });

  it("wraps a single item in an array", () => {
    expect(normalizeArray("hello")).toEqual(["hello"]);
  });

  it("returns empty array for null", () => {
    expect(normalizeArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeArray(undefined)).toEqual([]);
  });
});
