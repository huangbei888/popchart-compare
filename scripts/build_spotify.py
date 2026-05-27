from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / "data" / "manual" / "works.csv"
RAW_PATH = ROOT / "data" / "raw" / "spotify" / "charts.csv"
OUT_PATH = ROOT / "data" / "processed" / "spotify_entries.csv"

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

REGION_ALIASES = {
    "global": "global",
    "us": "us",
    "united states": "us",
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


def load_works() -> list[dict[str, str]]:
    if not WORKS_PATH.exists():
        raise FileNotFoundError(f"Missing works file: {WORKS_PATH}")
    with WORKS_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def matches(work: dict[str, str], row: dict[str, str]) -> bool:
    work_title = normalize(work["title"])
    row_title = normalize(row.get("title", ""))
    if work_title != row_title:
        return False

    token = main_artist_token(work["artist"])
    row_artist = normalize(row.get("artist", ""))
    return bool(token and token in row_artist.split())


def build_entries() -> list[dict[str, str]]:
    if not RAW_PATH.exists():
        raise FileNotFoundError(
            "Missing Spotify raw data. Download Kaggle dataset dhruvildave/spotify-charts "
            "and place charts.csv at data/raw/spotify/charts.csv"
        )

    works = load_works()
    rows: list[dict[str, str]] = []

    with RAW_PATH.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for item in reader:
            chart = (item.get("chart") or "").lower()
            raw_region = (item.get("region") or "").strip().lower()
            region = REGION_ALIASES.get(raw_region)
            if chart != "top200" or region is None:
                continue

            for work in works:
                if not matches(work, item):
                    continue
                rows.append(
                    {
                        "work_id": work["work_id"],
                        "platform": "spotify",
                        "chart_name": "top_200",
                        "region": region,
                        "date": item.get("date", ""),
                        "rank": item.get("rank", ""),
                        "streams": item.get("streams", ""),
                        "weeks_on_chart": "",
                        "peak_position": "",
                    }
                )

    return rows


def write_entries(rows: list[dict[str, str]]) -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    try:
        entries = build_entries()
        write_entries(entries)
        print(f"Wrote {len(entries)} Spotify entries to {OUT_PATH}")
    except Exception as exc:
        print(f"Spotify build failed: {exc}", file=sys.stderr)
        sys.exit(1)
