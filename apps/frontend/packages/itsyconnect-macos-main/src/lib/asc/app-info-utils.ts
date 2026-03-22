import type { AscAppInfo } from "./app-info";

const LIVE_STATES = new Set(["READY_FOR_DISTRIBUTION", "ACCEPTED"]);

/**
 * Pick the best appInfo from the list.
 * Prefers the non-live (editable/pending) appInfo since it has the most
 * up-to-date localizations. Falls back to the first entry.
 */
export function pickAppInfo(appInfos: AscAppInfo[]): AscAppInfo | undefined {
  if (appInfos.length <= 1) return appInfos[0];
  return (
    appInfos.find((info) => !LIVE_STATES.has(info.attributes.state)) ??
    appInfos[0]
  );
}
