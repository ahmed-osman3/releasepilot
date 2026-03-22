import { ascFetch } from "./client";
import { cacheInvalidate } from "@/lib/cache";
import { withCache } from "./helpers";

const REVIEWS_TTL = 5 * 60 * 1000; // 5 min

export interface AscCustomerReview {
  id: string;
  attributes: {
    rating: number;
    title: string;
    body: string;
    reviewerNickname: string;
    createdDate: string;
    territory: string; // ISO 3166-1 alpha-3
  };
  response?: AscReviewResponse;
}

export interface AscReviewResponse {
  id: string;
  attributes: {
    responseBody: string;
    lastModifiedDate: string;
    state: "PENDING_PUBLISH" | "PUBLISHED";
  };
}

interface AscCustomerReviewsResponse {
  data: Array<{
    id: string;
    type: "customerReviews";
    attributes: AscCustomerReview["attributes"];
    relationships?: {
      response?: {
        data?: { id: string; type: "customerReviewResponses" } | null;
      };
    };
  }>;
  included?: Array<{
    id: string;
    type: "customerReviewResponses";
    attributes: AscReviewResponse["attributes"];
  }>;
}

type ReviewSort = "-createdDate" | "createdDate" | "-rating" | "rating";

export async function listCustomerReviews(
  appId: string,
  sort: ReviewSort = "-createdDate",
  forceRefresh = false,
): Promise<AscCustomerReview[]> {
  return withCache(`reviews:${appId}:${sort}`, REVIEWS_TTL, forceRefresh, async () => {
    const params = new URLSearchParams({
      "fields[customerReviews]": "rating,title,body,reviewerNickname,createdDate,territory,response",
      "fields[customerReviewResponses]": "responseBody,lastModifiedDate,state",
      include: "response",
      sort,
      limit: "200",
    });

    const response = await ascFetch<AscCustomerReviewsResponse>(
      `/v1/apps/${appId}/customerReviews?${params}`,
    );

    // Build a lookup map for included responses
    const responseMap = new Map<string, AscReviewResponse>();
    if (response.included) {
      for (const inc of response.included) {
        if (inc.type === "customerReviewResponses") {
          responseMap.set(inc.id, {
            id: inc.id,
            attributes: inc.attributes,
          });
        }
      }
    }

    // Merge responses inline
    return response.data.map((r) => {
      const responseRef = r.relationships?.response?.data;
      const reviewResponse = responseRef ? responseMap.get(responseRef.id) : undefined;

      return {
        id: r.id,
        attributes: r.attributes,
        ...(reviewResponse ? { response: reviewResponse } : {}),
      };
    });
  });
}

export async function createReviewResponse(
  reviewId: string,
  responseBody: string,
): Promise<{ id: string }> {
  const result = await ascFetch<{
    data: { id: string; type: "customerReviewResponses" };
  }>("/v1/customerReviewResponses", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "customerReviewResponses",
        attributes: { responseBody },
        relationships: {
          review: {
            data: { type: "customerReviews", id: reviewId },
          },
        },
      },
    }),
  });

  // Invalidate all reviews caches for this review's app
  cacheInvalidate(`reviews:`);

  return { id: result.data.id };
}

export async function deleteReviewResponse(responseId: string): Promise<void> {
  await ascFetch(`/v1/customerReviewResponses/${responseId}`, {
    method: "DELETE",
  });

  cacheInvalidate(`reviews:`);
}

export function invalidateReviewsCache(appId: string): void {
  // Invalidate all sort variants
  for (const sort of ["-createdDate", "createdDate", "-rating", "rating"]) {
    cacheInvalidate(`reviews:${appId}:${sort}`);
  }
}
