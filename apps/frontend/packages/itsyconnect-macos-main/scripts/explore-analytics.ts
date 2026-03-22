/**
 * Explore ASC Analytics data for Itsyhome – download actual report CSVs.
 * Run: npx tsx scripts/explore-analytics.ts
 */

import * as jose from "jose";
import * as fs from "fs";
import * as zlib from "zlib";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const KEY_PATH = requireEnv("ASC_KEY_PATH");
const KEY_ID = requireEnv("ASC_KEY_ID");
const ISSUER_ID = requireEnv("ASC_ISSUER_ID");
const BASE = "https://api.appstoreconnect.apple.com";
const APP_ID = requireEnv("ASC_APP_ID");

// Use ONGOING request which has been running
const ONGOING_REQUEST_ID = requireEnv("ASC_ANALYTICS_ONGOING_REQUEST_ID");
const SNAPSHOT_REQUEST_ID = requireEnv("ASC_ANALYTICS_SNAPSHOT_REQUEST_ID");

async function makeToken(): Promise<string> {
  const keyPem = fs.readFileSync(KEY_PATH, "utf-8");
  const key = await jose.importPKCS8(keyPem, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID, typ: "JWT" })
    .setIssuer(ISSUER_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 20 * 60)
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

async function ascApi(path: string, token: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

/** Download from S3 pre-signed URL – no auth header needed */
async function downloadSegment(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Download failed: ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  try {
    return zlib.gunzipSync(buf).toString("utf-8");
  } catch {
    return buf.toString("utf-8");
  }
}

async function exploreReportsForCategory(
  requestId: string,
  category: string,
  token: string
) {
  console.log(`\n=== ${category} (request: ${requestId === ONGOING_REQUEST_ID ? "ONGOING" : "SNAPSHOT"}) ===`);
  const reports = await ascApi(
    `/v1/analyticsReportRequests/${requestId}/reports?filter[category]=${category}`,
    token
  );
  if (!reports?.data) return;

  for (const report of reports.data) {
    const name = report.attributes.name;

    // Get instances – try daily first, then any
    let instances = await ascApi(
      `/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=3`,
      token
    );
    if (!instances?.data?.length) {
      instances = await ascApi(
        `/v1/analyticsReports/${report.id}/instances?limit=3`,
        token
      );
    }
    if (!instances?.data?.length) {
      console.log(`  ${name}: no instances`);
      continue;
    }

    const inst = instances.data[0];
    console.log(
      `\n  ${name} | ${inst.attributes.granularity} | ${inst.attributes.processingDate}`
    );

    // Get segments
    const segments = await ascApi(
      `/v1/analyticsReportInstances/${inst.id}/segments`,
      token
    );
    if (!segments?.data?.length) {
      console.log("    No segments");
      continue;
    }

    // Download first segment
    const segUrl = segments.data[0].attributes.url;
    const csv = await downloadSegment(segUrl);
    if (!csv) continue;

    const lines = csv.split("\n");
    const header = lines[0];
    console.log(`    Columns: ${header}`);
    console.log(`    Rows: ${lines.length - 1}`);
    // Print a few data rows
    for (const line of lines.slice(1, Math.min(6, lines.length))) {
      if (line.trim()) console.log(`    ${line}`);
    }
  }
}

async function main() {
  const token = await makeToken();

  const categories = [
    "APP_STORE_ENGAGEMENT",
    "COMMERCE",
    "APP_USAGE",
    "FRAMEWORK_USAGE",
    "PERFORMANCE",
  ];

  // Try SNAPSHOT first (has historical data)
  for (const cat of categories) {
    await exploreReportsForCategory(SNAPSHOT_REQUEST_ID, cat, token);
  }

  // Then try ONGOING
  for (const cat of ["APP_STORE_ENGAGEMENT", "APP_USAGE", "COMMERCE"]) {
    await exploreReportsForCategory(ONGOING_REQUEST_ID, cat, token);
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
