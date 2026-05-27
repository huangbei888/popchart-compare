from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / "data" / "manual" / "works.csv"
OUT_PATH = ROOT / "data" / "processed" / "spotify_kworb_entries.csv"
CACHE_DIR = ROOT / "data" / "raw" / "spotify" / "kworb_cache"
BASE_URL = "https://kworb.net/spotify"

FIELDS = [
    "work_id",
    "platform",
    "chart_name",
    "region",
    "date",
    "rank",
    "streams",
    "weeks_on_chart",
    "peak_position",
]

REGION_URLS = {
    "global": f"{BASE_URL}/country/global_daily_totals.html",
    "us": f"{BASE_URL}/country/us_daily_totals.html",
}

REGION_COLUMNS = {
    "global": "Global",
    "us": "US",
}


def normalize(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"\b(featuring|feat\.?|ft\.?)\b.*", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def main_artist_token(artist: str) -> str:
    normalized = normalize(artist)
    return normalized.split()[0] if normalized else ""


def clean_int(value: str) -> str:
    value = (value or "").replace(",", "").strip()
    if not value:
        return ""
    try:
        return str(int(float(value)))
    except ValueError:
        return ""


def fetch_url(url: str, cache_name: str, use_cache: bool) -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / cache_name
    if use_cache and cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    request = urllib.request.Request(url, headers={"User-Agent": "PopChartCompare/1.1"})
    with urllib.request.urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8", "replace")
    cache_path.write_text(text, encoding="utf-8")
    return text


def load_works(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Missing works file: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def strip_tags(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def parse_totals(html_text: str) -> list[dict[str, str]]:
    pattern = re.compile(
        r'<td class="text mp"><div><a href="[^"]+">(?P<artist>.*?)</a>\s*-\s*<a href="(?P<href>\.\./track/[^"]+)">(?P<title>.*?)</a></div></td>',
        re.DOTALL,
    )
    rows: list[dict[str, str]] = []
    for match in pattern.finditer(html_text):
        rows.append(
            {
                "artist": strip_tags(match.group("artist")),
                "title": strip_tags(match.group("title")),
                "href": urllib.parse.urljoin(f"{BASE_URL}/country/", match.group("href")),
            }
        )
    return rows


def matches(work: dict[str, str], row: dict[str, str]) -> bool:
    if normalize(work.get("title", "")) != normalize(row.get("title", "")):
        return False
    token = main_artist_token(work.get("artist", ""))
    return bool(token and token in normalize(row.get("artist", "")).split())


def build_track_lookup(regions: list[str], use_cache: bool) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for region in regions:
        text = fetch_url(REGION_URLS[region], f"{region}_daily_totals.html", use_cache)
        for row in parse_totals(text):
            key = f"{normalize(row['artist'])}::{normalize(row['title'])}"
            lookup.setdefault(key, row["href"])
    return lookup


def find_track_url(work: dict[str, str], totals_rows: list[dict[str, str]]) -> str | None:
    for row in totals_rows:
        if matches(work, row):
            return row["href"]
    return None


def parse_cells(row_html: str, tag: str) -> list[str]:
    return [strip_tags(cell) for cell in re.findall(rf"<{tag}[^>]*>(.*?)</{tag}>", row_html, re.DOTALL)]


def parse_daily_entries(track_html: str, work_id: str, regions: list[str]) -> list[dict[str, str]]:
    daily_match = re.search(r'<div class="daily">\s*<table>(?P<table>.*?)</table>', track_html, re.DOTALL)
    if not daily_match:
        return []

    table = daily_match.group("table")
    row_htmls = re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.DOTALL)
    if not row_htmls:
        return []

    headers = parse_cells(row_htmls[0], "th")
    column_index = {region: headers.index(REGION_COLUMNS[region]) for region in regions if REGION_COLUMNS[region] in headers}
    entries: list[dict[str, str]] = []

    for row_html in row_htmls[1:]:
        cells_raw = re.findall(r"<td[^>]*>(.*?)</td>", row_html, re.DOTALL)
        cells_text = [strip_tags(cell) for cell in cells_raw]
        if not cells_text or not re.match(r"\d{4}/\d{2}/\d{2}", cells_text[0]):
            continue

        date = cells_text[0].replace("/", "-")
        for region, index in column_index.items():
            if index >= len(cells_raw):
                continue
            raw_cell = cells_raw[index]
            rank_match = re.search(r'<span class="p">([^<]+)</span>', raw_cell)
            stream_match = re.search(r'<span class="s">([^<]+)</span>', raw_cell)
            if not rank_match:
                continue

            entries.append(
                {
                    "work_id": work_id,
                    "platform": "spotify",
                    "chart_name": "top_200",
                    "region": region,
                    "date": date,
                    "rank": clean_int(rank_match.group(1)),
                    "streams": clean_int(stream_match.group(1) if stream_match else ""),
                    "weeks_on_chart": "",
                    "peak_position": "",
                }
            )

    return entries


def write_entries(rows: list[dict[str, str]]) -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Spotify chart entries from Kworb track history pages.")
    parser.add_argument("--works", type=Path, default=WORKS_PATH)
    parser.add_argument("--regions", default="global,us", help="Comma-separated regions: global,us")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--sleep", type=float, default=0.5)
    parser.add_argument("--use-cache", action="store_true")
    args = parser.parse_args()

    regions = [region.strip().lower() for region in args.regions.split(",") if region.strip()]
    invalid = [region for region in regions if region not in REGION_URLS]
    if invalid:
        raise ValueError(f"Unsupported regions: {', '.join(invalid)}")

    works = load_works(args.works)
    totals_by_region = {
        region: parse_totals(fetch_url(REGION_URLS[region], f"{region}_daily_totals.html", args.use_cache))
        for region in regions
    }

    rows: list[dict[str, str]] = []
    fetched = 0
    for work in works:
        if fetched >= args.limit:
            break

        track_url = None
        for region in regions:
            track_url = find_track_url(work, totals_by_region[region])
            if track_url:
                break

        if not track_url:
            print(f"No Kworb match: {work.get('title')} - {work.get('artist')}")
            continue

        track_id = Path(urllib.parse.urlparse(track_url).path).stem
        track_html = fetch_url(track_url, f"track_{track_id}.html", args.use_cache)
        track_entries = parse_daily_entries(track_html, work["work_id"], regions)
        rows.extend(track_entries)
        fetched += 1
        print(f"Fetched {len(track_entries)} entries: {work.get('title')} - {work.get('artist')}")
        time.sleep(args.sleep)

    write_entries(rows)
    print(f"Wrote {len(rows)} Kworb Spotify entries to {OUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Kworb Spotify build failed: {exc}", file=sys.stderr)
        sys.exit(1)
