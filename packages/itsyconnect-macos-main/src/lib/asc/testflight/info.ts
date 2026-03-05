import { ascFetch } from "../client";
import { cacheInvalidatePrefix } from "@/lib/cache";
import { withCache, normalizeArray } from "../helpers";
import {
  INFO_TTL,
  type TFBetaAppLocalization,
  type TFBetaReviewDetail,
  type TFBetaLicenseAgreement,
  type TFBetaAppInfo,
  type AscJsonApiResponse,
} from "./types";

// ── Beta app info ────────────────────────────────────────────────

export async function getBetaAppInfo(
  appId: string,
  forceRefresh = false,
): Promise<TFBetaAppInfo> {
  return withCache(`tf-info:${appId}`, INFO_TTL, forceRefresh, async () => {
  const [locRes, reviewRes, licenseRes] = await Promise.all([
    ascFetch<AscJsonApiResponse>(
      `/v1/betaAppLocalizations?filter[app]=${appId}&fields[betaAppLocalizations]=description,feedbackEmail,locale,marketingUrl,privacyPolicyUrl`,
    ),
    ascFetch<AscJsonApiResponse>(
      `/v1/betaAppReviewDetails?filter[app]=${appId}&fields[betaAppReviewDetails]=contactEmail,contactFirstName,contactLastName,contactPhone,demoAccountName,demoAccountPassword,demoAccountRequired,notes`,
    ),
    ascFetch<AscJsonApiResponse>(
      `/v1/betaLicenseAgreements?filter[app]=${appId}&fields[betaLicenseAgreements]=agreementText`,
    ),
  ]);

  // Localizations
  const locArr = normalizeArray(locRes.data);
  const localizations: TFBetaAppLocalization[] = locArr.map((l) => ({
    id: l.id,
    locale: l.attributes.locale as string,
    description: (l.attributes.description as string) ?? null,
    feedbackEmail: (l.attributes.feedbackEmail as string) ?? null,
    marketingUrl: (l.attributes.marketingUrl as string) ?? null,
    privacyPolicyUrl: (l.attributes.privacyPolicyUrl as string) ?? null,
  }));

  // Review detail
  const reviewArr = normalizeArray(reviewRes.data);
  const reviewData = reviewArr[0];
  const reviewDetail: TFBetaReviewDetail | null = reviewData
    ? {
        id: reviewData.id,
        contactFirstName: (reviewData.attributes.contactFirstName as string) ?? null,
        contactLastName: (reviewData.attributes.contactLastName as string) ?? null,
        contactPhone: (reviewData.attributes.contactPhone as string) ?? null,
        contactEmail: (reviewData.attributes.contactEmail as string) ?? null,
        demoAccountRequired: (reviewData.attributes.demoAccountRequired as boolean) ?? false,
        demoAccountName: (reviewData.attributes.demoAccountName as string) ?? null,
        demoAccountPassword: (reviewData.attributes.demoAccountPassword as string) ?? null,
        notes: (reviewData.attributes.notes as string) ?? null,
      }
    : null;

  // License agreement
  const licenseArr = normalizeArray(licenseRes.data);
  const licenseData = licenseArr[0];
  const licenseAgreement: TFBetaLicenseAgreement | null = licenseData
    ? {
        id: licenseData.id,
        agreementText: (licenseData.attributes.agreementText as string) ?? null,
      }
    : null;

  return { localizations, reviewDetail, licenseAgreement };
  });
}

// ── Beta app info mutations ──────────────────────────────────────

export async function createBetaAppLocalization(
  appId: string,
  locale: string,
  fields: Record<string, unknown>,
): Promise<string> {
  // Strip empty strings – ASC rejects them on create
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== "") cleaned[k] = v;
  }
  const res = await ascFetch<{ data: { id: string } }>("/v1/betaAppLocalizations", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "betaAppLocalizations",
        attributes: { locale, ...cleaned },
        relationships: {
          app: {
            data: { type: "apps", id: appId },
          },
        },
      },
    }),
  });
  cacheInvalidatePrefix("tf-info:");
  return res.data.id;
}

export async function deleteBetaAppLocalization(
  locId: string,
): Promise<void> {
  await ascFetch(`/v1/betaAppLocalizations/${locId}`, {
    method: "DELETE",
  });
  cacheInvalidatePrefix("tf-info:");
}

export async function updateBetaAppLocalization(
  locId: string,
  fields: Partial<{
    description: string;
    feedbackEmail: string;
    marketingUrl: string;
    privacyPolicyUrl: string;
  }>,
): Promise<void> {
  await ascFetch(`/v1/betaAppLocalizations/${locId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "betaAppLocalizations",
        id: locId,
        attributes: fields,
      },
    }),
  });
  cacheInvalidatePrefix("tf-info:");
}

export async function updateBetaAppReviewDetail(
  detailId: string,
  fields: Partial<{
    contactFirstName: string;
    contactLastName: string;
    contactPhone: string;
    contactEmail: string;
    demoAccountRequired: boolean;
    demoAccountName: string;
    demoAccountPassword: string;
    notes: string;
  }>,
): Promise<void> {
  await ascFetch(`/v1/betaAppReviewDetails/${detailId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "betaAppReviewDetails",
        id: detailId,
        attributes: fields,
      },
    }),
  });
  cacheInvalidatePrefix("tf-info:");
}

export async function updateBetaLicenseAgreement(
  agreementId: string,
  agreementText: string,
): Promise<void> {
  await ascFetch(`/v1/betaLicenseAgreements/${agreementId}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "betaLicenseAgreements",
        id: agreementId,
        attributes: { agreementText },
      },
    }),
  });
  cacheInvalidatePrefix("tf-info:");
}
