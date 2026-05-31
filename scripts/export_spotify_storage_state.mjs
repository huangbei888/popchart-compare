import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_PROFILE_DIR = path.join(ROOT, ".spotify-charts-profile");
const DEFAULT_OUTPUT = path.join(ROOT, "spotify-storage-state.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    profileDir: DEFAULT_PROFILE_DIR,
    output: DEFAULT_OUTPUT,
    headed: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--profile-dir") options.profileDir = path.resolve(args[++i]);
    else if (arg === "--output") options.output = path.resolve(args[++i]);
    else if (arg === "--headed") options.headed = true;
    else if (arg === "--help") {
      console.log(`Usage:
node scripts/export_spotify_storage_state.mjs

Exports a small Spotify-only Playwright storageState JSON from the logged-in
.spotify-charts-profile browser profile. Put the base64 content in GitHub
Secret SPOTIFY_CHARTS_STORAGE_STATE_B64.
`);
      process.exit(0);
    }
  }

  return options;
}

function spotifyOnlyStorageState(state) {
  return {
    cookies: state.cookies.filter((cookie) => /(^|\.)spotify\.com$/i.test(cookie.domain.replace(/^\./, ""))),
    origins: state.origins.filter((origin) => /^https:\/\/([a-z0-9-]+\.)*spotify\.com$/i.test(origin.origin)),
  };
}

async function main() {
  const options = parseArgs();
  mkdirSync(path.dirname(options.output), { recursive: true });

  const channels = ["msedge", "chrome"];
  let context = null;
  let lastError;

  for (const channel of channels) {
    try {
      context = await chromium.launchPersistentContext(options.profileDir, {
        channel,
        headless: !options.headed,
        viewport: { width: 1280, height: 900 },
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!context) {
    throw new Error(`Could not open local Spotify Charts profile. Last error: ${lastError}`);
  }

  try {
    const page = context.pages().find((candidate) => !candidate.isClosed()) ?? (await context.newPage());
    await page.goto("https://charts.spotify.com/home", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const state = spotifyOnlyStorageState(await context.storageState());
    if (state.cookies.length === 0) {
      throw new Error("No Spotify cookies were exported. Open the downloader once with --login-first, then retry.");
    }

    writeFileSync(options.output, `${JSON.stringify(state)}\n`, "utf-8");
    console.log(`Exported ${state.cookies.length} Spotify cookies and ${state.origins.length} origins to ${options.output}`);
    console.log("Do not commit this file. Add its base64 content to GitHub Secret SPOTIFY_CHARTS_STORAGE_STATE_B64.");
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(`Spotify storage state export failed: ${error.message}`);
  process.exit(1);
});
