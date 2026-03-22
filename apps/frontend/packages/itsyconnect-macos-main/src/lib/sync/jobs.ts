import { listApps } from "@/lib/asc/apps";
import { buildAnalyticsData } from "@/lib/asc/analytics";
import { listBuilds, listGroups } from "@/lib/asc/testflight";
import { hasCredentials } from "@/lib/asc/client";
import { isPro, FREE_LIMITS } from "@/lib/license";

/** Return apps respecting the free tier limit. */
async function visibleApps() {
  const all = await listApps();
  return isPro() ? all : all.slice(0, FREE_LIMITS.apps);
}

export async function syncApps(): Promise<void> {
  if (!hasCredentials()) return;
  await listApps(true);
}

export async function syncAnalytics(): Promise<void> {
  if (!hasCredentials()) return;
  const apps = await visibleApps();
  for (const app of apps) {
    await buildAnalyticsData(app.id);
  }
}

export async function syncTestFlight(): Promise<void> {
  if (!hasCredentials()) return;
  const apps = await visibleApps();
  for (const app of apps) {
    await listBuilds(app.id, true);
    await listGroups(app.id, true);
  }
}
