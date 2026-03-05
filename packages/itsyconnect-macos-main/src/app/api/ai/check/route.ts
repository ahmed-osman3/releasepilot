import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const row = db
    .select({ id: aiSettings.id })
    .from(aiSettings)
    .orderBy(sql`${aiSettings.updatedAt} DESC`)
    .get();

  return NextResponse.json({ configured: !!row });
}
