import { NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/sync/worker";

export async function GET() {
  return NextResponse.json({ schedules: getSyncStatus() });
}
