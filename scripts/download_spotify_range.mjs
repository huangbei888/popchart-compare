import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUT_DIR = path.join(ROOT, "data", "raw", "spotify", "official");
const DEFAULT_LINKS = path.join(DEFAULT_OUT_DIR, "download_links.csv");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    start: "",
    end: "",
    regions: "us",
    chart: "daily",
    chunkDays: 30,
    sleepMs: 500,
    retries: 5,
    rateLimitSleepMs: 60000,
    chunkRetries: 3,
    chunkRetrySleepMs: 60000,
    loginFirst: true,
    skipExisting: true,
    headless: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--start") options.start = args[++i];
    else if (arg === "--end") options.end = args[++i];
    else if (arg === "--regions") options.regions = args[++i];
    else if (arg === "--chart") options.chart = args[++i];
    else if (arg === "--chunk-days") options.chunkDays = Number(args[++i]);
    else if (arg === "--sleep-ms") options.sleepMs = Number(args[++i]);
    else if (arg === "--retries") options.retries = Number(args[++i]);
    else if (arg === "--rate-limit-sleep-ms") options.rateLimitSleepMs = Number(args[++i]);
    else if (arg === "--chunk-retries") options.chunkRetries = Number(args[++i]);
    else if (arg === "--chunk-retry-sleep-ms") options.chunkRetrySleepMs = Number(args[++i]);
    else if (arg === "--no-login-first") options.loginFirst = false;
    else if (arg === "--no-skip-existing") options.skipExisting = false;
    else if (arg === "--headless") options.headless = true;
    else if (arg === "--help") {
      console.log(`Usage:
node scripts/download_spotify_range.mjs --start 2025-07-15 --end 2026-05-19 --regions us --chunk-days 30

Options:
  --start <YYYY-MM-DD>   Start date, required
  --end <YYYY-MM-DD>     End date, required
  --regions <list>       Comma-separated regions, default us
  --chart <daily|weekly> Chart type, default daily
  --chunk-days <n>       Days per batch, default 30
  --sleep-ms <n>         Delay between API requests inside each batch, default 500
  --retries <n>          Retry failed API requests, default 5
  --rate-limit-sleep-ms <n>  Delay after Spotify API 429 responses, default 60000
  --chunk-retries <n>    Retry a failed date chunk this many times, default 3
  --chunk-retry-sleep-ms <n> Delay before retrying a failed chunk, default 60000
  --no-login-first       Do not pause for login before the first batch
  --no-skip-existing     Re-download existing CSV files
  --headless             Run browser headless after login is already saved
`);
      process.exit(0);
    }
  }

  if (!options.start || !options.end) {
    throw new Error("Missing --start or --end. Use YYYY-MM-DD.");
  }
  if (!Number.isFinite(options.chunkDays) || options.chunkDays < 1) {
    throw new Error("--chunk-days must be a positive number.");
  }

  return options;
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}. Use YYYY-MM-DD.`);
  return date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function minDate(a, b) {
  return a <= b ? a : b;
}

function makeRows(start, end, regions, chart) {
  const rows = [];
  const stepDays = chart === "weekly" ? 7 : 1;
  for (const region of regions) {
    for (let current = new Date(start); current <= end; current = addDays(current, stepDays)) {
      const date = formatDate(current);
      const alias = `regional-${region}-${chart}`;
      rows.push({
        date,
        region,
        chart,
        url: `https://charts.spotify.com/charts/view/${alias}/${date}`,
        save_as: `${alias}-${date}.csv`,
      });
    }
  }
  return rows;
}

function writeLinks(rows) {
  mkdirSync(DEFAULT_OUT_DIR, { recursive: true });
  const header = "date,region,chart,url,save_as";
  const lines = rows.map((row) => [row.date, row.region, row.chart, row.url, row.save_as].join(","));
  writeFileSync(DEFAULT_LINKS, `${header}\n${lines.join("\n")}\n`, "utf-8");
}

function runNodeScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs();
  const start = parseDate(options.start);
  const end = parseDate(options.end);
  if (end < start) throw new Error("--end must be after --start.");

  const regions = options.regions
    .split(",")
    .map((region) => region.trim().toLowerCase())
    .filter(Boolean);
  if (regions.length === 0) throw new Error("--regions cannot be empty.");

  const downloader = path.join(ROOT, "scripts", "download_spotify_official.mjs");
  if (!existsSync(downloader)) throw new Error(`Missing downloader: ${downloader}`);

  let chunkStart = start;
  let chunkIndex = 0;
  while (chunkStart <= end) {
    chunkIndex += 1;
    const chunkEnd = minDate(addDays(chunkStart, options.chunkDays - 1), end);
    const rows = makeRows(chunkStart, chunkEnd, regions, options.chart);
    writeLinks(rows);

    console.log(`\n[chunk ${chunkIndex}] ${formatDate(chunkStart)} -> ${formatDate(chunkEnd)} (${rows.length} charts)`);

    const downloadArgs = [
      "--api-fast",
      "--sleep-ms",
      String(options.sleepMs),
      "--retries",
      String(options.retries),
      "--rate-limit-sleep-ms",
      String(options.rateLimitSleepMs),
    ];
    if (options.loginFirst && chunkIndex === 1) downloadArgs.push("--login-first");
    if (!options.skipExisting) downloadArgs.push("--no-skip-existing");
    if (options.headless) downloadArgs.push("--headless");

    let chunkSucceeded = false;
    for (let attempt = 0; attempt <= options.chunkRetries; attempt += 1) {
      try {
        await runNodeScript(downloader, downloadArgs);
        chunkSucceeded = true;
        break;
      } catch (error) {
        if (attempt >= options.chunkRetries) throw error;
        console.log(
          `[chunk retry ${attempt + 1}/${options.chunkRetries}] ${error.message}; waiting ${Math.round(
            options.chunkRetrySleepMs / 1000,
          )}s before retrying ${formatDate(chunkStart)} -> ${formatDate(chunkEnd)}`,
        );
        await sleep(options.chunkRetrySleepMs);
      }
    }

    if (!chunkSucceeded) {
      throw new Error(`Chunk failed: ${formatDate(chunkStart)} -> ${formatDate(chunkEnd)}`);
    }

    chunkStart = addDays(chunkEnd, 1);
  }

  console.log("\nRange download finished.");
}

main().catch((error) => {
  console.error(`Spotify range download failed: ${error.message}`);
  process.exit(1);
});
