import { ascFetch } from "./client";
import { cacheInvalidate } from "@/lib/cache";

export async function updateReviewDetail(
  reviewDetailId: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  await ascFetch(`/v1/appStoreReviewDetails/${reviewDetailId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "appStoreReviewDetails",
        id: reviewDetailId,
        attributes,
      },
    }),
  });
}

export async function createReviewDetail(
  versionId: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  await ascFetch("/v1/appStoreReviewDetails", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "appStoreReviewDetails",
        attributes,
        relationships: {
          appStoreVersion: {
            data: { type: "appStoreVersions", id: versionId },
          },
        },
      },
    }),
  });
}

export function invalidateVersionsCache(appId: string): void {
  cacheInvalidate(`versions:${appId}`);
}
