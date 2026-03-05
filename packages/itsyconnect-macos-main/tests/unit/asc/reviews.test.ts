import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAscFetch = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheInvalidate = vi.fn();

vi.mock("@/lib/asc/client", () => ({
  ascFetch: (...args: unknown[]) => mockAscFetch(...args),
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheInvalidate: (...args: unknown[]) => mockCacheInvalidate(...args),
}));

import {
  listCustomerReviews,
  createReviewResponse,
  deleteReviewResponse,
  invalidateReviewsCache,
} from "@/lib/asc/reviews";

describe("listCustomerReviews", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
    mockCacheInvalidate.mockReset();
  });

  it("returns cached reviews when available", async () => {
    const cached = [{ id: "r1", attributes: { rating: 5, title: "Great" } }];
    mockCacheGet.mockReturnValue(cached);

    const result = await listCustomerReviews("app-1");
    expect(result).toEqual(cached);
    expect(mockAscFetch).not.toHaveBeenCalled();
  });

  it("fetches and transforms reviews from API", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch.mockResolvedValue({
      data: [
        {
          id: "r1",
          type: "customerReviews",
          attributes: {
            rating: 5,
            title: "Great app",
            body: "Love it",
            reviewerNickname: "User1",
            createdDate: "2026-01-15",
            territory: "USA",
          },
          relationships: {
            response: {
              data: { id: "resp-1", type: "customerReviewResponses" },
            },
          },
        },
        {
          id: "r2",
          type: "customerReviews",
          attributes: {
            rating: 3,
            title: "OK",
            body: "Decent",
            reviewerNickname: "User2",
            createdDate: "2026-01-10",
            territory: "GBR",
          },
        },
      ],
      included: [
        {
          id: "resp-1",
          type: "customerReviewResponses",
          attributes: {
            responseBody: "Thanks!",
            lastModifiedDate: "2026-01-16",
            state: "PUBLISHED",
          },
        },
      ],
    });

    const result = await listCustomerReviews("app-1");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("r1");
    expect(result[0].response).toBeDefined();
    expect(result[0].response!.attributes.responseBody).toBe("Thanks!");
    expect(result[1].id).toBe("r2");
    expect(result[1].response).toBeUndefined();
    expect(mockCacheSet).toHaveBeenCalledWith(
      "reviews:app-1:-createdDate",
      result,
      expect.any(Number),
    );
  });

  it("bypasses cache on forceRefresh", async () => {
    mockCacheGet.mockReturnValue([{ id: "old" }]);
    mockAscFetch.mockResolvedValue({ data: [], included: [] });

    const result = await listCustomerReviews("app-1", "-createdDate", true);
    expect(result).toEqual([]);
    expect(mockAscFetch).toHaveBeenCalled();
  });

  it("handles response with no included array", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch.mockResolvedValue({
      data: [
        {
          id: "r1",
          type: "customerReviews",
          attributes: {
            rating: 4,
            title: "Nice",
            body: "Good",
            reviewerNickname: "User",
            createdDate: "2026-01-01",
            territory: "USA",
          },
        },
      ],
    });

    const result = await listCustomerReviews("app-1");
    expect(result).toHaveLength(1);
    expect(result[0].response).toBeUndefined();
  });

  it("handles non-matching included types", async () => {
    mockCacheGet.mockReturnValue(null);
    mockAscFetch.mockResolvedValue({
      data: [
        {
          id: "r1",
          type: "customerReviews",
          attributes: {
            rating: 4,
            title: "Test",
            body: "Test",
            reviewerNickname: "X",
            createdDate: "2026-01-01",
            territory: "USA",
          },
          relationships: {
            response: {
              data: { id: "resp-1", type: "customerReviewResponses" },
            },
          },
        },
      ],
      included: [
        {
          id: "other-1",
          type: "otherType",
          attributes: { foo: "bar" },
        },
      ],
    });

    const result = await listCustomerReviews("app-1");
    expect(result[0].response).toBeUndefined();
  });
});

describe("createReviewResponse", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
  });

  it("POSTs a response and invalidates cache", async () => {
    mockAscFetch.mockResolvedValue({
      data: { id: "resp-1", type: "customerReviewResponses" },
    });

    const result = await createReviewResponse("r1", "Thank you!");
    expect(result).toEqual({ id: "resp-1" });
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/customerReviewResponses",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:");
  });
});

describe("deleteReviewResponse", () => {
  beforeEach(() => {
    mockAscFetch.mockReset();
    mockCacheInvalidate.mockReset();
  });

  it("DELETEs the response and invalidates cache", async () => {
    mockAscFetch.mockResolvedValue(null);

    await deleteReviewResponse("resp-1");
    expect(mockAscFetch).toHaveBeenCalledWith(
      "/v1/customerReviewResponses/resp-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:");
  });
});

describe("invalidateReviewsCache", () => {
  beforeEach(() => {
    mockCacheInvalidate.mockReset();
  });

  it("invalidates all sort variants for the app", () => {
    invalidateReviewsCache("app-1");
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:app-1:-createdDate");
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:app-1:createdDate");
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:app-1:-rating");
    expect(mockCacheInvalidate).toHaveBeenCalledWith("reviews:app-1:rating");
    expect(mockCacheInvalidate).toHaveBeenCalledTimes(4);
  });
});
