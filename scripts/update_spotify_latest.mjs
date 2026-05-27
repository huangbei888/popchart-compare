import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw", "spotify", "official");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    regions: "global,us",
    start: "",
    end: "",
    lagDays: 2,
    chunkDays: 7,
    sleepMs: 800,
    retries: 5,
    rateLimitSleepMs: 60000,
    chunkRetries: 2,
    chunkRetrySleepMs: 60000,
    loginFirst: false,
    headless: true,
    skipDownload: false,
    forceRebuild: false,
    verifyBuild: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--regions") options.regions = args[++i];
    else if (arg === "--start") options.start = args[++i];
    else if (arg === "--end") options.end = args[++i];
    else if (arg === "--lag-days") options.lagDays = Number(args[++i]);
    else if (arg === "--chunk-days") options.chunkDays = Number(args[++i]);
    else if (arg === "--sleep-ms") options.sleepMs = Number(args[++i]);
    else if (arg === "--retries") options.retries = Number(args[++i]);
    else if (arg === "--rate-limit-sleep-ms") options.rateLimitSleepMs = Number(args[++i]);
    else if (arg === "--chunk-retries") options.chunkRetries = Number(args[++i]);
    else if (arg === "--chunk-retry-sleep-ms") options.chunkRetrySleepMs = Number(args[++i]);
    else if (arg === "--login-first") options.loginFirst = true;
    else if (arg === "--headed") options.headless = false;
    else if (arg === "--skip-download") options.skipDownload = true;
    else if (arg === "--force-rebuild") options.forceRebuild = true;
    else if (arg === "--verify-build") options.verifyBuild = true;
    else if (arg === "--help") {
      console.log(`Usage:
node scripts/update_spotify_latest.mjs --regions global,us

Daily update flow:
  1. Find the latest local Spotify official CSV date per region.
  2. Download missing daily charts through yesterday by default.
  3. Rebuild Spotify catalog and public data snapshots.
  4. Optionally run npm build to verify deploy safety.

Options:
  --regions <list>             Comma-separated regions, default global,us
  --start <YYYY-MM-DD>         Override start date
  --end <YYYY-MM-DD>           Override end date
  --lag-days <n>               Use today-n as default end date, default 2
  --chunk-days <n>             Date chunk size passed to downloader, default 7
  --sleep-ms <n>               Delay between API requests, default 800
  --retries <n>                API request retries, default 5
  --rate-limit-sleep-ms <n>    Delay after 429 responses, default 60000
  --chunk-retries <n>          Chunk retries, default 2
  --chunk-retry-sleep-ms <n>   Delay between chunk retries, default 60000
  --login-first                Pause for browser login before first download
  --headed                     Show browser window
  --skip-download              Only rebuild processed/public data
  --force-rebuild              Rebuild even when no missing dates are found
  --verify-build               Run npm run build after data rebuild
`);
      process.exit(0);
    }
  }

  return options;
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
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

function defaultEndDate(lagDays) {
  const now = new Date();
  const utcToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return addDays(utcToday, -lagDays);
}

function latestRawDate(region) {
  if (!existsSync(RAW_DIR)) return null;
  const pattern = new RegExp(`^regional-${region}-daily-(\\d{4}-\\d{2}-\\d{2})\\.csv$`);
  const dates = readdirSync(RAW_DIR)
    .map((name) => name.match(pattern)?.[1] ?? "")
    .filter(Boolean)
    .sort();
  return dates.at(-1) ?? null;
}

function inferStartDate(regions) {
  const nextDates = regions.map((region) => {
    const latest = latestRawDate(region);
    if (!latest) {
      throw new Error(
        `No local Spotify CSVs found for region "${region}". Bootstrap once with --start YYYY-MM-DD, then daily updates can auto-resume.`,
      );
    }
    return addDays(parseDate(latest), 1);
  });

  return nextDates.reduce((earliest, date) => (date < earliest ? date : earliest), nextDates[0]);
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"]/u.test(text)) return text;
  return `"${text.replaceAll('"', '\\"')}"`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const child = isWindowsScript
      ? spawn("cmd.exe", ["/d", "/s", "/c", [quoteCmdArg(command), ...args.map(quoteCmdArg)].join(" ")], {
          cwd: ROOT,
          stdio: "inherit",
          shell: false,
        })
      : spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
          shell: false,
        });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs();
  const regions = options.regions
    .split(",")
    .map((region) => region.trim().toLowerCase())
    .filter(Boolean);

  if (regions.length === 0) throw new Error("--regions cannot be empty.");

  const start = options.start ? parseDate(options.start) : inferStartDate(regions);
  const end = options.end ? parseDate(options.end) : defaultEndDate(options.lagDays);
  const hasMissingDates = start <= end;

  if (!options.skipDownload && hasMissingDates) {
    const args = [
      "scripts/download_spotify_range.mjs",
      "--start",
      formatDate(start),
      "--end",
      formatDate(end),
      "--regions",
      regions.join(","),
      "--chunk-days",
      String(options.chunkDays),
      "--sleep-ms",
      String(options.sleepMs),
      "--retries",
      String(options.retries),
      "--rate-limit-sleep-ms",
      String(options.rateLimitSleepMs),
      "--chunk-retries",
      String(options.chunkRetries),
      "--chunk-retry-sleep-ms",
      String(options.chunkRetrySleepMs),
    ];
    if (!options.loginFirst) args.push("--no-login-first");
    if (options.headless) args.push("--headless");

    console.log(`[spotify:update] downloading ${regions.join(",")} ${formatDate(start)} -> ${formatDate(end)}`);
    await run(process.execPath, args);
  } else if (!hasMissingDates) {
    console.log(`[spotify:update] no missing Spotify dates. Local data is already past ${formatDate(end)}.`);
    if (!options.forceRebuild) return;
  } else {
    console.log("[spotify:update] skipping download; rebuilding from existing local CSV files.");
  }

  const python = process.env.PYTHON || "python";
  await run(python, ["scripts/build_spotify_catalog.py"]);
  await run(python, ["scripts/build_all.py"]);

  if (options.verifyBuild) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    await run(npm, ["run", "build"]);
  }

  console.log("[spotify:update] finished. Public data snapshot has been regenerated.");
}

main().catch((error) => {
  console.error(`Spotify latest update failed: ${error.message}`);
  process.exit(1);
});
