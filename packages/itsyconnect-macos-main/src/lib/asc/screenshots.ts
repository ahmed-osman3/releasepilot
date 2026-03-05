import { ascFetch } from "./client";
import { withCache } from "./helpers";
import type { AscScreenshot, AscScreenshotSet } from "./display-types";

export type { AscScreenshot, AscScreenshotSet };

const SCREENSHOTS_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AscScreenshotSetsListResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: AscScreenshotSet["attributes"];
  }>;
}

interface AscScreenshotsListResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: AscScreenshot["attributes"];
  }>;
}

export async function listScreenshotSets(
  localizationId: string,
  forceRefresh = false,
): Promise<AscScreenshotSet[]> {
  return withCache(`screenshotSets:${localizationId}`, SCREENSHOTS_TTL, forceRefresh, async () => {
    // Step 1: get screenshot sets for this localization
    const setsResponse = await ascFetch<AscScreenshotSetsListResponse>(
      `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets` +
        `?fields[appScreenshotSets]=screenshotDisplayType`,
    );

    // Step 2: fetch screenshots for each set in parallel
    // (Apple omits relationships from the include response, so we fetch per-set)
    return Promise.all(
      setsResponse.data.map(async (s) => {
        const ssResponse = await ascFetch<AscScreenshotsListResponse>(
          `/v1/appScreenshotSets/${s.id}/appScreenshots` +
            `?fields[appScreenshots]=fileSize,fileName,sourceFileChecksum,assetDeliveryState,assetToken`,
        );
        return {
          id: s.id,
          attributes: s.attributes,
          screenshots: ssResponse.data.map((ss) => ({
            id: ss.id,
            attributes: ss.attributes,
          })),
        };
      }),
    );
  });
}
