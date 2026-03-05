import { ascFetch } from "./client";
import { withCache } from "./helpers";
import type { AscBuild, AscPhasedRelease, AscReviewDetail, AscVersion } from "./version-types";

const VERSIONS_TTL = 15 * 60 * 1000; // 15 min


interface AscVersionsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: AscVersion["attributes"];
    relationships?: {
      build?: { data: { id: string; type: string } | null };
      appStoreReviewDetail?: { data: { id: string; type: string } | null };
      appStoreVersionPhasedRelease?: { data: { id: string; type: string } | null };
    };
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
}

function resolveIncluded(
  response: AscVersionsResponse,
): AscVersion[] {
  const builds = new Map<string, AscBuild>();
  const reviewDetails = new Map<string, AscReviewDetail>();
  const phasedReleases = new Map<string, AscPhasedRelease>();

  for (const item of response.included ?? []) {
    if (item.type === "builds") {
      builds.set(item.id, {
        id: item.id,
        attributes: item.attributes as unknown as AscBuild["attributes"],
      });
    } else if (item.type === "appStoreReviewDetails") {
      reviewDetails.set(item.id, {
        id: item.id,
        attributes: item.attributes as unknown as AscReviewDetail["attributes"],
      });
    } else if (item.type === "appStoreVersionPhasedReleases") {
      phasedReleases.set(item.id, {
        id: item.id,
        attributes: item.attributes as unknown as AscPhasedRelease["attributes"],
      });
    }
  }

  return response.data.map((v) => ({
    id: v.id,
    attributes: v.attributes,
    build: builds.get(v.relationships?.build?.data?.id ?? "") ?? null,
    reviewDetail:
      reviewDetails.get(v.relationships?.appStoreReviewDetail?.data?.id ?? "") ??
      null,
    phasedRelease:
      phasedReleases.get(v.relationships?.appStoreVersionPhasedRelease?.data?.id ?? "") ??
      null,
  }));
}

export async function listVersions(
  appId: string,
  forceRefresh = false,
): Promise<AscVersion[]> {
  return withCache(`versions:${appId}`, VERSIONS_TTL, forceRefresh, async () => {
    const response = await ascFetch<AscVersionsResponse>(
      `/v1/apps/${appId}/appStoreVersions` +
        `?fields[appStoreVersions]=versionString,appVersionState,appStoreState,platform,copyright,releaseType,earliestReleaseDate,downloadable,createdDate,build,appStoreReviewDetail,appStoreVersionPhasedRelease` +
        `&include=build,appStoreReviewDetail,appStoreVersionPhasedRelease` +
        `&fields[builds]=version,uploadedDate,processingState,minOsVersion,iconAssetToken` +
        `&fields[appStoreReviewDetails]=contactEmail,contactFirstName,contactLastName,contactPhone,demoAccountName,demoAccountPassword,demoAccountRequired,notes` +
        `&fields[appStoreVersionPhasedReleases]=phasedReleaseState,currentDayNumber,startDate`,
    );

    return resolveIncluded(response);
  });
}
