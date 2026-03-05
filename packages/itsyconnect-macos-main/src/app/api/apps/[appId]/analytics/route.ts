import { NextResponse } from "next/server";
import { hasCredentials } from "@/lib/asc/client";
import { cacheGet, cacheGetMeta } from "@/lib/cache";
import { buildAnalyticsData, type AnalyticsData } from "@/lib/asc/analytics";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId } = await params;

  if (!hasCredentials()) {
    return NextResponse.json({ data: null, meta: null });
  }

  const data = cacheGet<AnalyticsData>(`analytics:${appId}`, true);
  if (data) {
    const meta = cacheGetMeta(`analytics:${appId}`);
    return NextResponse.json({ data, meta });
  }

  // No cached data – trigger background build (deduplicated in buildAnalyticsData)
  buildAnalyticsData(appId).catch((err) => {
    console.error(`[analytics] Background build failed for ${appId}:`, err);
  });

  return NextResponse.json({ data: null, pending: true });
}
