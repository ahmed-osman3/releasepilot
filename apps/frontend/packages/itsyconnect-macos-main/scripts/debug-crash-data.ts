/**
 * Dump all crash report data for Itsyhome to see what date granularity
 * is available from the standard "App Crashes" (APP_USAGE, MONTHLY) report.
 *
 * Run: npx tsx scripts/debug-crash-data.ts
 */

import * as jose from "jose";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

// Load .env.local manually (no dotenv dependency)
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const KEY_PATH = requireEnv("ASC_KEY_PATH");
const KEY_ID = requireEnv("ASC_KEY_ID");
const ISSUER_ID = requireEnv("ASC_ISSUER_ID");
const APP_ID = requireEnv("ASC_APP_ID");
const BASE = "https://api.appstoreconnect.apple.com";

// ─── Helpers ──────────────────────────────────────────────

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

let requestCount = 0;

async function get(token: string, apiPath: string): Promise<any> {
  const url = apiPath.startsWith("http") ? apiPath : `${BASE}${apiPath}`;
  requestCount++;
  console.log(`  [${requestCount}] GET ${url.replace(BASE, "")}`);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`  ✗ HTTP ${res.status}: ${text.slice(0, 500)}`);
    return null;
  }
  return res.json();
}

async function downloadSegment(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  ✗ Download failed: ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  try {
    return zlib.gunzipSync(buf).toString("utf-8");
  } catch {
    return buf.toString("utf-8");
  }
}

function parseTsv(raw: string): Array<Record<string, string>> {
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = (values[i] ?? "").replace(/^"|"$/g, "");
    }
    return record;
  });
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  const token = await makeToken();
  console.log("Token generated\n");

  // Find report requests
  console.log("═══ Report requests ═══");
  const reportRequests = await get(
    token,
    `/v1/apps/${APP_ID}/analyticsReportRequests`,
  );
  if (!reportRequests?.data?.length) {
    console.log("  No report requests found");
    return;
  }

  for (const rr of reportRequests.data) {
    console.log(`  ${rr.id} (${rr.attributes.accessType})`);
  }

  // For each report request, find "App Crashes" in APP_USAGE
  const allRows: Array<Record<string, string>> = [];

  for (const rr of reportRequests.data) {
    const rrId = rr.id;
    const rrType = rr.attributes.accessType;

    console.log(`\n═══ APP_USAGE crash reports from ${rrType} ═══`);
    const reports = await get(
      token,
      `/v1/analyticsReportRequests/${rrId}/reports?filter[category]=APP_USAGE`,
    );
    if (!reports?.data?.length) {
      console.log("  No APP_USAGE reports");
      continue;
    }

    const crashReport = reports.data.find(
      (r: any) => r.attributes.name === "App Crashes",
    );
    if (!crashReport) {
      console.log("  No 'App Crashes' report found. Available:");
      for (const r of reports.data) {
        console.log(`    - ${r.attributes.name}`);
      }
      continue;
    }

    console.log(`  Found report: ${crashReport.attributes.name} (${crashReport.id})`);

    // Get ALL instances (monthly)
    let url: string | null =
      `/v1/analyticsReports/${crashReport.id}/instances?filter[granularity]=MONTHLY&limit=200`;
    const instances: any[] = [];

    while (url) {
      const resp = await get(token, url);
      if (!resp?.data?.length) break;
      instances.push(...resp.data);
      url = resp.links?.next ?? null;
    }

    console.log(`  ${instances.length} instances`);
    for (const inst of instances) {
      console.log(
        `    ${inst.attributes.processingDate} (${inst.attributes.granularity})`,
      );
    }

    // Download all instances and collect rows
    for (const inst of instances) {
      const segments = await get(
        token,
        `/v1/analyticsReportInstances/${inst.id}/segments`,
      );
      if (!segments?.data?.length) continue;

      for (const seg of segments.data) {
        const tsv = await downloadSegment(seg.attributes.url);
        if (!tsv) continue;

        const rows = parseTsv(tsv);
        // Inject processingDate as Date if rows lack it
        for (const row of rows) {
          if (!row["Date"] && !row["date"]) {
            row["Date"] = inst.attributes.processingDate;
          } else if (row["date"] && !row["Date"]) {
            row["Date"] = row["date"];
          }
        }
        // Filter to our app
        const appRows = rows.filter(
          (r) => !r["App Apple Identifier"] || r["App Apple Identifier"] === APP_ID,
        );
        allRows.push(...appRows);
      }
    }
  }

  if (allRows.length === 0) {
    console.log("\n  No crash rows found at all!");
    return;
  }

  // Show columns
  console.log(`\n═══ Crash data summary ═══`);
  console.log(`  Total rows: ${allRows.length}`);
  console.log(`  Columns: ${Object.keys(allRows[0]).join(", ")}`);

  // Show first 5 raw rows
  console.log(`\n═══ Sample rows ═══`);
  for (const row of allRows.slice(0, 5)) {
    console.log(`  ${JSON.stringify(row)}`);
  }

  // Check if rows have a Date field with actual dates
  const dates = new Set<string>();
  for (const row of allRows) {
    const d = row["Date"];
    if (d) dates.add(d);
  }
  const sortedDates = Array.from(dates).sort();
  console.log(`\n═══ Unique dates (${sortedDates.length}) ═══`);
  for (const d of sortedDates) {
    console.log(`  ${d}`);
  }

  // Aggregate crashes by date
  console.log(`\n═══ Crashes by date ═══`);
  const byDate = new Map<string, { crashes: number; uniqueDevices: number }>();
  for (const row of allRows) {
    const date = row["Date"] ?? "unknown";
    const crashes = Math.round(parseFloat(row["Crashes"] || "0")) || 0;
    const devices = Math.round(parseFloat(row["Unique Devices"] || "0")) || 0;
    const existing = byDate.get(date) || { crashes: 0, uniqueDevices: 0 };
    existing.crashes += crashes;
    existing.uniqueDevices += devices;
    byDate.set(date, existing);
  }

  const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [date, data] of sorted) {
    console.log(`  ${date}  crashes=${data.crashes}  devices=${data.uniqueDevices}`);
  }

  // Save raw data
  const outDir = path.join(__dirname, "output");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "crash-rows.json"),
    JSON.stringify(allRows, null, 2),
  );
  console.log(`\n  → saved output/crash-rows.json`);
}

main().catch(console.error);
