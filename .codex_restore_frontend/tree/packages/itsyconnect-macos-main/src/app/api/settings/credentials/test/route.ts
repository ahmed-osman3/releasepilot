import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { ascCredentials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { generateAscJwt } from "@/lib/asc/jwt";
import { errorJson } from "@/lib/api-helpers";

const ASC_BASE = "https://api.appstoreconnect.apple.com";

const testSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing credential ID" }, { status: 400 });
  }

  const cred = db
    .select()
    .from(ascCredentials)
    .where(eq(ascCredentials.id, parsed.data.id))
    .get();

  if (!cred) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  try {
    const privateKey = decrypt({
      ciphertext: cred.encryptedPrivateKey,
      iv: cred.iv,
      authTag: cred.authTag,
      encryptedDek: cred.encryptedDek,
    });

    const token = generateAscJwt(cred.issuerId, cred.keyId, privateKey);
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. Test authentication – list apps
    const appsRes = await fetch(`${ASC_BASE}/v1/apps?limit=1`, { headers });

    if (!appsRes.ok) {
      return NextResponse.json(
        { error: `App Store Connect returned ${appsRes.status}` },
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
