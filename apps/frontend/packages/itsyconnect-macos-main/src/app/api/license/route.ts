import { NextResponse } from "next/server";
import { z } from "zod";
import { getLicense, setLicense, clearLicense, maskKey } from "@/lib/license";
import { IS_MAS } from "@/lib/license-shared";
import { parseBody } from "@/lib/api-helpers";

export async function GET() {
  const license = getLicense();

  if (!license) {
    return NextResponse.json({ isPro: false });
  }

  if (license.key === "storekit") {
    return NextResponse.json({ isPro: true, source: "storekit" });
  }

  return NextResponse.json({
    isPro: true,
    email: license.email,
    maskedKey: maskKey(license.key),
  });
}

const activateSchema = z.object({
  licenseKey: z.string().min(1, "License key is required").trim(),
});

/**
 * LemonSqueezy activation response shape (from docs):
 * { activated: boolean, error: string | null, license_key: object | null,
 *   instance: { id: string, ... } | null, meta: { customer_email: string, ... } | null }
 * Error HTTP codes: 400, 404, 422. The `error` field contains the message.
 */
interface LsActivationResponse {
  activated: boolean;
  error: string | null;
  license_key: { id: number } | null;
  instance: { id: string } | null;
  meta: { customer_email: string; product_name: string } | null;
}

export async function POST(request: Request) {
  if (IS_MAS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await parseBody(request, activateSchema);
  if (parsed instanceof Response) return parsed;

  const { licenseKey } = parsed;

  let res: Response;
  try {
    res = await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: "Itsyconnect",
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach LemonSqueezy – check your internet connection" },
      { status: 502 },
    );
  }

  let data: LsActivationResponse;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Unexpected response from LemonSqueezy" },
      { status: 502 },
    );
  }

  if (!data.activated) {
    // LemonSqueezy returns snake_case like "license_key not found" – normalise
    const raw = data.error ?? "Activation failed";
    const error = raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    return NextResponse.json(
      { error },
      { status: res.status >= 400 ? res.status : 422 },
    );
  }

  setLicense({
    licenseKey,
    instanceId: data.instance?.id ?? "",
    email: data.meta?.customer_email ?? "",
  });

  return NextResponse.json({
    ok: true,
    email: data.meta?.customer_email ?? "",
  });
}

export async function DELETE() {
  if (IS_MAS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const license = getLicense();

  if (!license) {
    return NextResponse.json({ error: "No active license" }, { status: 404 });
  }

  try {
    await fetch("https://api.lemonsqueezy.com/v1/licenses/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license_key: license.key,
        instance_id: license.instanceId,
      }),
    });
  } catch {
    // Deactivation is best-effort – clear locally even if remote call fails
  }

  clearLicense();

  return NextResponse.json({ ok: true });
}
