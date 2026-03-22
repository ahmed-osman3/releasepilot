/**
 * Debug performance metrics and daily crashes for Itsyhome.
 * Dumps raw API responses to see what Apple actually returns.
 *
 * Run: npx tsx scripts/debug-perf-crashes.ts
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
const BASE = "https://api.appstoreconnect.apple.com";

const OUT_DIR = path.join(__dirname, "output");

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

function save(filename: string, data: any) {
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  → saved ${filename}\n`);
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const token = await makeToken();
  console.log("Token generated\n");

  // ═══════════════════════════════════════════════
  // 1. Find Itsyhome app
  // ═══════════════════════════════════════════════
  console.log("═══ Finding Itsyhome app ═══");
  const apps = await get(token, "/v1/apps?fields[apps]=name,bundleId&limit=200");
  if (!apps?.data?.length) {
    console.error("No apps found");
    return;
  }

  const app = apps.data.find((a: any) =>
    a.attributes.name.toLowerCase().includes("itsyhome"),
  );
  if (!app) {
    console.error("Itsyhome app not found. Available apps:");
    for (const a of apps.data) {
      console.log(`  - ${a.attributes.name} (${a.id})`);
    }
    return;
  }

  const appId = app.id;
  console.log(`  Found: "${app.attributes.name}" (${appId})\n`);

  // ═══════════════════════════════════════════════
  // 2. perfPowerMetrics – raw dump
  // ═══════════════════════════════════════════════
  console.log("═══ perfPowerMetrics (no filters) ═══");
  const perfAll = await get(token, `/v1/apps/${appId}/perfPowerMetrics`);
  save("perf-metrics-all.json", perfAll);

  if (perfAll) {
    const productData = perfAll.productData ?? [];
    const regressions = perfAll.insights?.regressions ?? [];
    console.log(`  productData entries: ${productData.length}`);
    console.log(`  regressions: ${regressions.length}`);
    for (const pd of productData) {
      const cats = pd.metricCategories ?? [];
      console.log(`  platform: ${pd.platform}, categories: ${cats.length}`);
      for (const cat of cats) {
        const metrics = cat.metrics ?? [];
        console.log(`    ${cat.identifier}: ${metrics.length} metrics`);
        for (const m of metrics) {
          const ds = m.datasets ?? [];
          const points = ds.reduce((s: number, d: any) => s + (d.points?.length ?? 0), 0);
          console.log(`      ${m.identifier} (${m.unit?.displayName ?? "?"}) – ${ds.length} datasets, ${points} points`);
        }
      }
    }
  }

  // Try with platform filters
  for (const platform of ["iOS", "macOS"]) {
    console.log(`\n═══ perfPowerMetrics (platform=${platform}) ═══`);
    const perf = await get(
      token,
      `/v1/apps/${appId}/perfPowerMetrics?filter[platform]=${platform}`,
    );
    if (perf) {
      const productData = perf.productData ?? [];
      console.log(`  productData entries: ${productData.length}`);
      for (const pd of productData) {
        const cats = pd.metricCategories ?? [];
        console.log(`  platform: ${pd.platform}, categories: ${cats.length}`);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // 3. Analytics report requests
  // ═══════════════════════════════════════════════
  console.log("\n═══ Analytics report requests ═══");
  const reportRequests = await get(
    token,
    `/v1/apps/${appId}/analyticsReportRequests`,
  );
  if (!reportRequests?.data?.length) {
    console.log("  No report requests found");
    return;
  }

  for (const rr of reportRequests.data) {
    console.log(`  ${rr.id} (${rr.attributes.accessType})`);
  }

  // ═══════════════════════════════════════════════
  // 4. PERFORMANCE category reports
  // ═══════════════════════════════════════════════
  for (const rr of reportRequests.data) {
    const rrId = rr.id;
    const rrType = rr.attributes.accessType;

    console.log(`\n═══ PERFORMANCE reports from ${rrType} (${rrId}) ═══`);
    const reports = await get(
      token,
      `/v1/analyticsReportRequests/${rrId}/reports?filter[category]=PERFORMANCE`,
    );
    if (!reports?.data?.length) {
      console.log("  No PERFORMANCE reports");
      continue;
    }

    for (const report of reports.data) {
      const name = report.attributes.name;
      const cat = report.attributes.category;
      console.log(`\n  Report: "${name}" (${cat})`);

      // Try daily instances
      let instances = await get(
        token,
        `/v1/analyticsReports/${report.id}/instances?filter[granularity]=DAILY&limit=5`,
      );
      if (!instances?.data?.length) {
        // Try without granularity filter
        instances = await get(
          token,
          `/v1/analyticsReports/${report.id}/instances?limit=5`,
        );
      }
      if (!instances?.data?.length) {
        console.log("    No instances");
        continue;
      }

      console.log(`    ${instances.data.length} instances:`);
      for (const inst of instances.data) {
        console.log(
          `      ${inst.attributes.processingDate} (${inst.attributes.granularity})`,
        );
      }

      // Download first instance to see columns and sample data
      const inst = instances.data[0];
      console.log(
        `\n    Downloading instance: ${inst.attributes.processingDate}`,
      );

      const segments = await get(
        token,
        `/v1/analyticsReportInstances/${inst.id}/segments`,
      );
      if (!segments?.data?.length) {
        console.log("    No segments");
        continue;
      }

      console.log(`    ${segments.data.length} segment(s)`);
      const segUrl = segments.data[0].attributes.url;
      const tsv = await downloadSegment(segUrl);
      if (!tsv) continue;

      const lines = tsv.split("\n").filter((l: string) => l.trim());
      console.log(`    Columns: ${lines[0]}`);
      console.log(`    Rows: ${lines.length - 1}`);
      // Show first few data rows
      for (const line of lines.slice(1, 6)) {
        console.log(`      ${line}`);
      }

      // Save full TSV
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const tsvPath = path.join(OUT_DIR, `${safeName}-${rrType.toLowerCase()}.tsv`);
      fs.writeFileSync(tsvPath, tsv);
      console.log(`    → saved ${safeName}-${rrType.toLowerCase()}.tsv`);
    }
  }

  // ═══════════════════════════════════════════════
  // 5. Also check APP_USAGE crash reports
  // ═══════════════════════════════════════════════
  for (const rr of reportRequests.data) {
    const rrId = rr.id;
    const rrType = rr.attributes.accessType;

    console.log(`\n═══ APP_USAGE reports from ${rrType} (${rrId}) ═══`);
    const reports = await get(
      token,
      `/v1/analyticsReportRequests/${rrId}/reports?filter[category]=APP_USAGE`,
    );
    if (!reports?.data?.length) {
      console.log("  No APP_USAGE reports");
      continue;
    }

    // Only look at crash-related reports
    const crashReports = reports.data.filter((r: any) =>
      r.attributes.name.toLowerCase().includes("crash"),
    );

    for (const report of crashReports) {
      const name = report.attributes.name;
      console.log(`\n  Report: "${name}"`);

      // Try monthly (standard crash report is monthly)
      let instances = await get(
        token,
        `/v1/analyticsReports/${report.id}/instances?filter[granularity]=MONTHLY&limit=3`,
      );
      if (!instances?.data?.length) {
        instances = await get(
          token,
          `/v1/analyticsReports/${report.id}/instances?limit=3`,
        );
      }
      if (!instances?.data?.length) {
        console.log("    No instances");
        continue;
      }

      console.log(`    ${instances.data.length} instances:`);
      for (const inst of instances.data) {
        console.log(
          `      ${inst.attributes.processingDate} (${inst.attributes.granularity})`,
        );
      }

      // Download first instance
      const inst = instances.data[0];
      const segments = await get(
        token,
        `/v1/analyticsReportInstances/${inst.id}/segments`,
      );
      if (!segments?.data?.length) {
        console.log("    No segments");
        continue;
      }

      const segUrl = segments.data[0].attributes.url;
      const tsv = await downloadSegment(segUrl);
      if (!tsv) continue;

      const lines = tsv.split("\n").filter((l: string) => l.trim());
      console.log(`    Columns: ${lines[0]}`);
      console.log(`    Rows: ${lines.length - 1}`);
      for (const line of lines.slice(1, 6)) {
        console.log(`      ${line}`);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  console.log(`\n═══ DONE ═══`);
  console.log(`Total API requests: ${requestCount}`);
}

main().catch(console.error);
