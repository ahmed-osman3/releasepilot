import { ascFetch } from "../client";
import { cacheInvalidatePrefix } from "@/lib/cache";
import { withCache, normalizeArray } from "../helpers";
import {
  FEEDBACK_TTL,
  type TFFeedbackItem,
  type TFScreenshotImage,
  type AscJsonApiResponse,
  type AscJsonApiResource,
} from "./types";

// ── Feedback ────────────────────────────────────────────────────

export async function listFeedback(
  appId: string,
  forceRefresh = false,
): Promise<TFFeedbackItem[]> {
  return withCache(`tf-feedback:${appId}`, FEEDBACK_TTL, forceRefresh, async () => {
    const sharedParams = new URLSearchParams({
      "include": "build,tester",
      "sort": "-createdDate",
      "limit": "200",
      "fields[betaTesters]": "firstName,lastName,email",
      "fields[builds]": "version",
    });

    const [screenshotRes, crashRes] = await Promise.all([
      ascFetch<AscJsonApiResponse>(
        `/v1/apps/${appId}/betaFeedbackScreenshotSubmissions?${sharedParams}`,
      ),
      ascFetch<AscJsonApiResponse>(
        `/v1/apps/${appId}/betaFeedbackCrashSubmissions?${sharedParams}`,
      ),
    ]);

    const screenshotItems = parseSubmissions(screenshotRes, "screenshot");
    const crashItems = parseSubmissions(crashRes, "crash");

    return [...screenshotItems, ...crashItems].sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
    );
  });
}

function parseSubmissions(
  response: AscJsonApiResponse,
  type: "screenshot" | "crash",
): TFFeedbackItem[] {
  const dataArr = normalizeArray(response.data);

  const includedMap = new Map<string, AscJsonApiResource>();
  if (response.included) {
    for (const inc of response.included) {
      includedMap.set(`${inc.type}:${inc.id}`, inc);
    }
  }

  return dataArr.map((item) => {
    const attrs = item.attributes;

    // Resolve tester
    const testerRef = item.relationships?.tester?.data;
    const testerData = testerRef && !Array.isArray(testerRef)
      ? includedMap.get(`${testerRef.type}:${testerRef.id}`)
      : undefined;
    const firstName = testerData?.attributes?.firstName as string | undefined;
    const lastName = testerData?.attributes?.lastName as string | undefined;
    const testerName = firstName
      ? `${firstName}${lastName ? ` ${lastName}` : ""}`.trim() || null
      : null;

    // Resolve build
    const buildRef = item.relationships?.build?.data;
    const buildData = buildRef && !Array.isArray(buildRef)
      ? includedMap.get(`${buildRef.type}:${buildRef.id}`)
      : undefined;
    const buildNumber = (buildData?.attributes?.version as string) ?? null;

    // Screenshots (only for screenshot type)
    const screenshots: TFScreenshotImage[] = [];
    if (type === "screenshot" && Array.isArray(attrs.screenshots)) {
      for (const s of attrs.screenshots as Array<Record<string, unknown>>) {
        screenshots.push({
          url: s.url as string,
          width: s.width as number,
          height: s.height as number,
          expirationDate: s.expirationDate as string,
        });
      }
    }

    // Crash log presence (check relationship)
    const hasCrashLog = type === "crash" && !!item.relationships?.crashLog?.data;

    return {
      id: item.id,
      type,
      comment: (attrs.comment as string) ?? null,
      email: (attrs.email as string) ?? null,
      testerName,
      createdDate: attrs.createdDate as string,
      buildNumber,
      buildBundleId: (attrs.buildBundleId as string) ?? null,
      appPlatform: (attrs.appPlatform as string) ?? null,
      devicePlatform: (attrs.devicePlatform as string) ?? null,
      deviceFamily: (attrs.deviceFamily as string) ?? null,
      deviceModel: (attrs.deviceModel as string) ?? null,
      osVersion: (attrs.osVersion as string) ?? null,
      locale: (attrs.locale as string) ?? null,
      architecture: (attrs.architecture as string) ?? null,
      connectionType: (attrs.connectionType as string) ?? null,
      batteryPercentage: (attrs.batteryPercentage as number) ?? null,
      timeZone: (attrs.timeZone as string) ?? null,
      appUptimeMs: (attrs.appUptimeInMilliseconds as number) ?? null,
      diskBytesAvailable: (attrs.diskBytesAvailable as number) ?? null,
      diskBytesTotal: (attrs.diskBytesTotal as number) ?? null,
      screenWidth: (attrs.screenWidthInPoints as number) ?? null,
      screenHeight: (attrs.screenHeightInPoints as number) ?? null,
      pairedAppleWatch: (attrs.pairedAppleWatch as string) ?? null,
      screenshots,
      hasCrashLog,
    };
  });
}

// ── Crash log ───────────────────────────────────────────────────

interface CrashLogResponse {
  data: {
    attributes: {
      logText: string;
    };
  };
}

export async function getFeedbackCrashLog(
  submissionId: string,
): Promise<{ logText: string } | null> {
  try {
    const res = await ascFetch<CrashLogResponse>(
      `/v1/betaFeedbackCrashSubmissions/${submissionId}/crashLog`,
    );
    return { logText: res.data.attributes.logText };
  } catch {
    return null;
  }
}

// ── Delete ──────────────────────────────────────────────────────

export async function deleteFeedbackItem(
  id: string,
  type: "screenshot" | "crash",
): Promise<void> {
  const resourceType = type === "screenshot"
    ? "betaFeedbackScreenshotSubmissions"
    : "betaFeedbackCrashSubmissions";

  await ascFetch(`/v1/${resourceType}/${id}`, { method: "DELETE" });
  cacheInvalidatePrefix("tf-feedback:");
}
