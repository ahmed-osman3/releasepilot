import { ascFetch } from "./client";
import { cacheSet } from "@/lib/cache";
import { withCache } from "./helpers";

const APPS_TTL = 60 * 60 * 1000; // 1 hour

export interface AscApp {
  id: string;
  attributes: {
    name: string;
    bundleId: string;
    sku: string;
    primaryLocale: string;
    contentRightsDeclaration: string | null;
    subscriptionStatusUrl: string | null;
    subscriptionStatusUrlForSandbox: string | null;
    iconUrl: string | null;
  };
}

interface AscAppsResponse {
  data: Array<{
    id: string;
    attributes: {
      name: string;
      bundleId: string;
      sku: string;
      primaryLocale: string;
      contentRightsDeclaration: string | null;
      subscriptionStatusUrl: string | null;
      subscriptionStatusUrlForSandbox: string | null;
    };
  }>;
}

interface AscBuildsResponse {
  data: Array<{
    id: string;
    attributes: {
      iconAssetToken?: {
        templateUrl: string;
      } | null;
    };
  }>;
}

/** Replace `{w}`, `{h}`, `{f}` placeholders in a build icon template URL. */
export function buildIconUrl(templateUrl: string, size = 128): string {
  return templateUrl
    .replace("{w}", String(size))
    .replace("{h}", String(size))
    .replace("{f}", "png");
}

/** Fetch app icons from the latest build of each app via ASC API. */
async function fetchBuildIconUrls(
  appIds: string[],
): Promise<Map<string, string>> {
  const icons = new Map<string, string>();
  if (appIds.length === 0) return icons;

  const results = await Promise.allSettled(
    appIds.map(async (appId) => {
      const response = await ascFetch<AscBuildsResponse>(
        `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=1&fields[builds]=iconAssetToken`,
      );
      const build = response.data[0];
      const templateUrl = build?.attributes?.iconAssetToken?.templateUrl;
      if (templateUrl) {
        icons.set(appId, buildIconUrl(templateUrl));
      }
    }),
  );

  // Log failures for debugging but don't throw
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("Failed to fetch build icon:", result.reason);
    }
  }

  return icons;
}

export async function listApps(forceRefresh = false): Promise<AscApp[]> {
  return withCache("apps", APPS_TTL, forceRefresh, async () => {
    const response = await ascFetch<AscAppsResponse>(
      "/v1/apps?fields[apps]=name,bundleId,sku,primaryLocale,contentRightsDeclaration,subscriptionStatusUrl,subscriptionStatusUrlForSandbox&sort=name&limit=200",
    );

    const iconUrls = await fetchBuildIconUrls(response.data.map((a) => a.id));

    return response.data.map((a) => ({
      id: a.id,
      attributes: {
        ...a.attributes,
        iconUrl: iconUrls.get(a.id) ?? null,
      },
    }));
  });
}

export async function updateAppAttributes(
  appId: string,
  attributes: {
    contentRightsDeclaration?: string;
    subscriptionStatusUrl?: string | null;
    subscriptionStatusUrlForSandbox?: string | null;
  },
): Promise<void> {
  await ascFetch(`/v1/apps/${appId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "apps",
        id: appId,
        attributes,
      },
    }),
  });

  // Invalidate apps cache so next fetch picks up changes
  cacheSet("apps", null, 0);
}
