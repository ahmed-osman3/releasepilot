import { NextResponse } from "next/server";
import { hasCredentials } from "@/lib/asc/client";
import {
  submitForReview,
  invalidateVersionsCache,
} from "@/lib/asc/version-mutations";
import { errorJson } from "@/lib/api-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ appId: string; versionId: string }> },
) {
  const { appId, versionId } = await params;

  if (!hasCredentials()) {
    return NextResponse.json({ error: "No credentials" }, { status: 401 });
  }

  const body = (await request.json()) as { platform: string };
  if (!body.platform) {
    return NextResponse.json({ error: "Missing platform" }, { status: 400 });
  }

  try {
    await submitForReview(appId, versionId, body.platform);
    invalidateVersionsCache(appId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, 500);
  }
}
