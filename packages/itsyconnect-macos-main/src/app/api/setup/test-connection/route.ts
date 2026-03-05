import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAscJwt } from "@/lib/asc/jwt";
import { errorJson } from "@/lib/api-helpers";

const ASC_BASE = "https://api.appstoreconnect.apple.com";

const testSchema = z.object({
  issuerId: z.string().min(1, "Issuer ID is required").trim(),
  keyId: z.string().min(1, "Key ID is required").trim(),
  privateKey: z.string().min(1, "Private key is required"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { issuerId, keyId, privateKey } = parsed.data;

  try {
    const token = generateAscJwt(issuerId, keyId, privateKey);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Test authentication – list apps
    const appsRes = await fetch(`${ASC_BASE}/v1/apps?limit=1`, { headers });

    if (!appsRes.ok) {
      const text = await appsRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `App Store Connect returned ${appsRes.status}`,
          details: text,
        },
        { status: 422 },
      );
    }

    // 2. Test permissions – verify Admin role
    //    Most read endpoints return 200 for all roles, but
    //    GET analyticsReportRequests requires Admin and returns 403 otherwise.
    const appsData = await appsRes.json();
    const firstApp = appsData.data?.[0];

    if (firstApp) {
      const analyticsRes = await fetch(
        `${ASC_BASE}/v1/apps/${firstApp.id}/analyticsReportRequests`,
        { headers },
      );

      if (analyticsRes.status === 403) {
        return NextResponse.json(
          {
            error:
              "Key does not have sufficient permissions. Admin access is required.",
          },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, 422);
  }
}
