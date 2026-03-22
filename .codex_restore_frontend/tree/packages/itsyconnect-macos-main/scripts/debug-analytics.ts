/**
 * Debug analytics data mismatch – check if ONGOING and SNAPSHOT overlap.
 *
 * Run: npx tsx --env-file=.env.local scripts/debug-analytics.ts
 */

import * as jose from "jose";
import * as fs from "fs";
import * as zlib from "zlib";

// ── Config ──────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const KEY_PATH = requireEnv("ASC_KEY_PATH");
const KEY_ID = requireEnv("ASC_KEY_ID");
const ISSUER_ID = requireEnv("ASC_ISSUER_ID");
const APP_ID = requireEnv("ASC_APP_ID");
const ONGOING_REQUEST_ID = requireEnv("ASC_ANALYTICS_ONGOING_REQUEST_ID");
const SNAPSHOT_REQUEST_ID = requireEnv("ASC_ANALYTICS_SNAPSHOT_REQUEST_ID");
const BASE = "https://api.appstoreconnect.apple.com";

const DATE_FROM = "2026-02-20";
const DATE_TO = "2026-02-26";

// ── ASC auth + helpers ──────────────────────────────────────────────

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

let token = "";

async function ascApi(path: string) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`  HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  return res.json();
}

async function downloadSegment(url: string): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  try { return zlib.gunzipSync(buf).toString("utf-8"); } catch { return buf.toString("utf-8"); }
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

// ── Data fetching ───────────────────────────────────────────────────

async function findReportId(requestId: string, category: string, reportName: string): Promise<string | null> {
  const resp = await ascApi(`/v1/analyticsReportRequests/${requestId}/reports?filter[category]=${category}`);
  if (!resp?.data) return null;
  return resp.data.find((r: any) => r.attributes.name === reportName)?.id ?? null;
}

interface InstanceInfo {
  id: string;
  processingDate: string;
}

async function getRecentInstances(requestId: string, category: string, reportName: string, granularity: string, limit: number): Promise<InstanceInfo[]> {
  const reportId = await findReportId(requestId, category, reportName);
  if (!reportId) return [];

  const instances: InstanceInfo[] = [];
  let url: string | undefined = `/v1/analyticsReports/${reportId}/instances?filter[granularity]=${granularity}&limit=${Math.min(limit, 200)}`;

  while (url && instances.length < limit) {
    const resp = await ascApi(url);
    if (!resp?.data) break;
    for (const inst of resp.data) {
      instances.push({ id: inst.id, processingDate: inst.attributes.processingDate });
    }
    url = resp.links?.next;
  }
  return instances;
}

async function downloadInstanceData(instanceId: string): Promise<Array<Record<string, string>>> {
  const segments = await ascApi(`/v1/analyticsReportInstances/${instanceId}/segments`);
  if (!segments?.data?.length) return [];
  const rows: Array<Record<string, string>> = [];
  for (const seg of segments.data) {
    const tsv = await downloadSegment(seg.attributes.url);
    if (tsv) rows.push(...parseTsv(tsv));
  }
  return rows;
}

function filterByApp(rows: Array<Record<string, string>>): Array<Record<string, string>> {
  if (rows.length === 0 || !rows[0]["App Apple Identifier"]) return rows;
  return rows.filter((r) => r["App Apple Identifier"] === APP_ID);
}

// ── Compute date->count map from rows ───────────────────────────────

function countByDate(rows: Array<Record<string, string>>, countField: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const date = r["Date"];
    if (!date) continue;
    m.set(date, (m.get(date) || 0) + (parseInt(r[countField] || "1", 10) || 1));
  }
  return m;
}

function sumInRange(m: Map<string, number>, from: string, to: string): number {
  let total = 0;
  for (const [date, count] of m) {
    if (date >= from && date <= to) total += count;
  }
  return total;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  token = await makeToken();

  console.log(`App: ${APP_ID} | Range: ${DATE_FROM} to ${DATE_TO}`);
  console.log(`ASC dashboard: Downloads=1.18K, Proceeds=$1.36K`);
  console.log(`Our app:       Downloads=2,034,  Proceeds=$2,543\n`);

  // ── 1. Check overlap for "App Downloads Standard" ─────────────

  console.log("=".repeat(70));
  console.log("TEST: Do ONGOING and SNAPSHOT have overlapping DATA dates?");
  console.log("=".repeat(70));

  // Get the SNAPSHOT instance closest to our range
  const snapshotInsts = await getRecentInstances(SNAPSHOT_REQUEST_ID, "COMMERCE", "App Downloads Standard", "DAILY", 10);
  const snapshotInRange = snapshotInsts.filter((i) => i.processingDate >= "2026-02-15" && i.processingDate <= DATE_TO);

  console.log(`\nSNAPSHOT instances near range: ${snapshotInRange.length}`);
  for (const inst of snapshotInRange) {
    console.log(`  processingDate=${inst.processingDate} id=${inst.id}`);
  }

  // Get ONGOING instances
  const ongoingInsts = await getRecentInstances(ONGOING_REQUEST_ID, "COMMERCE", "App Downloads Standard", "DAILY", 15);
  const ongoingInRange = ongoingInsts.filter((i) => i.processingDate >= "2026-02-15" && i.processingDate <= DATE_TO);

  console.log(`\nONGOING instances near range: ${ongoingInRange.length}`);
  for (const inst of ongoingInRange) {
    console.log(`  processingDate=${inst.processingDate} id=${inst.id}`);
  }

  // Download SNAPSHOT data and check date range
  if (snapshotInRange.length > 0) {
    const snapInst = snapshotInRange[0];
    console.log(`\n── Downloading SNAPSHOT ${snapInst.processingDate} ──`);
    const snapRows = filterByApp(await downloadInstanceData(snapInst.id));
    const snapDates = countByDate(snapRows, "Counts");
    const sortedDates = [...snapDates.keys()].sort();

    console.log(`  Total rows: ${snapRows.length}`);
    console.log(`  Data date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);
    console.log(`  Unique dates: ${sortedDates.length}`);
    console.log(`\n  Counts by date (last 10 days):`);
    for (const date of sortedDates.slice(-10)) {
      const firstTime = snapRows.filter((r) => r["Date"] === date && r["Download Type"] === "First-time download")
        .reduce((s, r) => s + (parseInt(r["Counts"] || "1", 10) || 1), 0);
      console.log(`    ${date}: total=${snapDates.get(date)!}  first-time=${firstTime}`);
    }

    // Now download a few ONGOING instances and check for overlap
    console.log(`\n── Downloading ONGOING instances to check overlap ──`);
    for (const ongInst of ongoingInRange.slice(0, 8)) {
      const ongRows = filterByApp(await downloadInstanceData(ongInst.id));
      const ongDates = countByDate(ongRows, "Counts");
      const ongSortedDates = [...ongDates.keys()].sort();

      const overlap = ongSortedDates.filter((d) => snapDates.has(d));
      const overlapFlag = overlap.length > 0 ? "⚠️  OVERLAP!" : "✓ no overlap";

      console.log(`\n  ONGOING processingDate=${ongInst.processingDate}`);
      console.log(`    Rows: ${ongRows.length} | Data dates: ${ongSortedDates[0]} to ${ongSortedDates[ongSortedDates.length - 1]} | ${overlapFlag}`);

      if (overlap.length > 0) {
        for (const date of overlap) {
          const snapCount = snapDates.get(date)!;
          const ongCount = ongDates.get(date)!;
          console.log(`    DUPLICATE date=${date}: SNAPSHOT=${snapCount} ONGOING=${ongCount} (double-counted=${snapCount + ongCount})`);
        }
      }
    }
  }

  // ── 2. What are correct numbers using ONLY ONGOING? ───────────

  console.log(`\n${"=".repeat(70)}`);
  console.log("TEST: Correct totals using ONGOING only for Feb 20-26");
  console.log("=".repeat(70));

  let ongoingOnlyFirstTime = 0;
  let ongoingOnlyRedownload = 0;
  let ongoingOnlyTotal = 0;

  for (const inst of ongoingInRange) {
    const rows = filterByApp(await downloadInstanceData(inst.id));
    for (const r of rows) {
      const date = r["Date"];
      if (!date || date < DATE_FROM || date > DATE_TO) continue;
      const count = parseInt(r["Counts"] || "1", 10) || 1;
      ongoingOnlyTotal += count;
      if (r["Download Type"] === "First-time download") ongoingOnlyFirstTime += count;
      if (r["Download Type"] === "Redownload") ongoingOnlyRedownload += count;
    }
  }

  console.log(`\n  ONGOING-only (Feb 20-26):`);
  console.log(`    First-time:  ${ongoingOnlyFirstTime}`);
  console.log(`    Redownloads: ${ongoingOnlyRedownload}`);
  console.log(`    Total (all): ${ongoingOnlyTotal}`);
  console.log(`    Downloads (first+re): ${ongoingOnlyFirstTime + ongoingOnlyRedownload}`);
  console.log(`    ASC says: ~1,180`);

  // ── 3. Revenue check ─────────────────────────────────────────

  console.log(`\n${"=".repeat(70)}`);
  console.log("TEST: Revenue overlap check");
  console.log("=".repeat(70));

  const snapRevInsts = await getRecentInstances(SNAPSHOT_REQUEST_ID, "COMMERCE", "App Store Purchases Standard", "DAILY", 5);
  const snapRevInRange = snapRevInsts.filter((i) => i.processingDate >= "2026-02-15" && i.processingDate <= DATE_TO);
  const ongRevInsts = await getRecentInstances(ONGOING_REQUEST_ID, "COMMERCE", "App Store Purchases Standard", "DAILY", 15);
  const ongRevInRange = ongRevInsts.filter((i) => i.processingDate >= "2026-02-15" && i.processingDate <= DATE_TO);

  if (snapRevInRange.length > 0) {
    const snapRows = filterByApp(await downloadInstanceData(snapRevInRange[0].id));
    const snapRevDates = new Map<string, number>();
    for (const r of snapRows) {
      const d = r["Date"];
      if (!d) continue;
      snapRevDates.set(d, (snapRevDates.get(d) || 0) + (parseFloat(r["Proceeds in USD"] || "0") || 0));
    }
    const sortedDates = [...snapRevDates.keys()].sort();
    console.log(`\n  SNAPSHOT ${snapRevInRange[0].processingDate}: data dates ${sortedDates[0]}..${sortedDates[sortedDates.length - 1]}`);

    for (const inst of ongRevInRange.slice(0, 6)) {
      const ongRows = filterByApp(await downloadInstanceData(inst.id));
      const ongRevDates = new Map<string, number>();
      for (const r of ongRows) {
        const d = r["Date"];
        if (!d) continue;
        ongRevDates.set(d, (ongRevDates.get(d) || 0) + (parseFloat(r["Proceeds in USD"] || "0") || 0));
      }
      const ongSorted = [...ongRevDates.keys()].sort();
      const overlap = ongSorted.filter((d) => snapRevDates.has(d));

      console.log(`  ONGOING ${inst.processingDate}: data dates ${ongSorted[0]}..${ongSorted[ongSorted.length - 1]} | ${overlap.length > 0 ? "⚠️  OVERLAP" : "✓ no overlap"}`);
      for (const d of overlap) {
        console.log(`    ${d}: SNAP=$${snapRevDates.get(d)!.toFixed(2)} ONG=$${ongRevDates.get(d)!.toFixed(2)}`);
      }
    }

    // ONGOING-only revenue for range
    let ongOnlyProceeds = 0;
    for (const inst of ongRevInRange) {
      const rows = filterByApp(await downloadInstanceData(inst.id));
      for (const r of rows) {
        const d = r["Date"];
        if (!d || d < DATE_FROM || d > DATE_TO) continue;
        ongOnlyProceeds += parseFloat(r["Proceeds in USD"] || "0") || 0;
      }
    }
    console.log(`\n  ONGOING-only proceeds (Feb 20-26): $${ongOnlyProceeds.toFixed(2)}`);
    console.log(`  ASC says: ~$1,360`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("DONE");
}

main().catch(console.error);
