import { ascFetch } from "./client";
import { withCache } from "./helpers";

const LOCALIZATIONS_TTL = 15 * 60 * 1000; // 15 min

export interface AscLocalization {
  id: string;
  attributes: {
    locale: string;
    description: string | null;
    keywords: string | null;
    marketingUrl: string | null;
    promotionalText: string | null;
    supportUrl: string | null;
    whatsNew: string | null;
  };
}

interface AscLocalizationsResponse {
  data: Array<{
    id: string;
    type: string;
    attributes: AscLocalization["attributes"];
  }>;
}

export async function listLocalizations(
  versionId: string,
  forceRefresh = false,
): Promise<AscLocalization[]> {
  return withCache(`localizations:${versionId}`, LOCALIZATIONS_TTL, forceRefresh, async () => {
    const response = await ascFetch<AscLocalizationsResponse>(
      `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations` +
        `?fields[appStoreVersionLocalizations]=locale,description,keywords,marketingUrl,promotionalText,supportUrl,whatsNew`,
    );

    return response.data.map((l) => ({
      id: l.id,
      attributes: l.attributes,
    }));
  });
}
