import { NextResponse } from "next/server";
import { z } from "zod";
import { setLicense, clearLicense } from "@/lib/license";
import { IS_MAS } from "@/lib/license-shared";
import { parseBody } from "@/lib/api-helpers";

const storekitSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
});

export async function POST(request: Request) {
  if (!IS_MAS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await parseBody(request, storekitSchema);
  if (parsed instanceof Response) return parsed;

  setLicense({
    licenseKey: "storekit",
    instanceId: parsed.transactionId,
    email: "",
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!IS_MAS) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  clearLicense();

  return NextResponse.json({ ok: true });
}
