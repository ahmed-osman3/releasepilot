import { ascFetch } from "../client";
import { withCache, normalizeArray } from "../helpers";
import { BUILDS_TTL } from "./types";
import type { PreReleaseVersion } from "../version-types";

const CACHE_PREFIX = "tf-pre-release-versions";

export async function listPreReleaseVersions(
  appId: string,
  forceRefresh = false,
): Promise<PreReleaseVersion[]> {
  return withCache(`${CACHE_PREFIX}:${appId}`, BUILDS_TTL, forceRefresh, async () => {
    const params = new URLSearchParams({
      "filter[app]": appId,
      "fields[preReleaseVersions]": "version,platform",
      sort: "-version",
      limit: "200",
    });

    const response = await ascFetch<{
      data: Array<{ id: string; type: string; attributes: Record<string, unknown> }> | { id: string; type: string; attributes: Record<string, unknown> };
    }>(`/v1/preReleaseVersions?${params}`);

    return normalizeArray(response.data).map((d) => ({
      id: d.id,
      version: d.attributes.version as string,
      platform: d.attributes.platform as string,
    }));
  });
}
