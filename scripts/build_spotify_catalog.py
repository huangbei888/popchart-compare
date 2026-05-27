from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw" / "spotify" / "official"
CATALOG_PATH = ROOT / "data" / "processed" / "spotify_catalog.json"
ENTRIES_PATH = ROOT / "data" / "processed" / "spotify_catalog_entries.csv"

ENTRY_FIELDS = [
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


def slugify(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"\b(featuring|feat\.?|ft\.?)\b", " featuring ", value)
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return re.sub(r"_+", "_", value).strip("_") or "unknown"


def work_id_for(title: str, artist: str, uri: str = "") -> str:
    return f"{slugify(artist)}__{slugify(title)}"


def clean_int(value: str) -> int | None:
    value = (value or "").strip().replace(",", "")
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def field(row: dict[str, str], names: list[str], default: str = "") -> str:
    lowered = {key.strip().lower(): value for key, value in row.items() if key is not None}
    for name in names:
        if name in lowered:
            return lowered[name] or default
    return default


def infer_region(path: Path) -> str | None:
    match = re.search(r"regional-(global|us)-daily-", path.name)
    return match.group(1) if match else None


def infer_date(path: Path) -> str | None:
    match = re.search(r"\d{4}-\d{2}-\d{2}", path.name)
    return match.group(0) if match else None


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            return []
        lowered = {name.strip().lower() for name in reader.fieldnames if name}
        if "rank" not in lowered or not ({"track_name", "track name", "title"} & lowered):
            return []
        return list(reader)


def build() -> tuple[list[dict], list[dict[str, str]]]:
    if not RAW_DIR.exists():
        raise FileNotFoundError(f"Missing Spotify official raw directory: {RAW_DIR}")

    files = sorted(path for path in RAW_DIR.glob("regional-*-daily-*.csv") if path.name != "download_links.csv")
    if not files:
        raise FileNotFoundError(f"No Spotify official CSV files found in {RAW_DIR}")

    grouped: dict[str, list[dict]] = defaultdict(list)
    identity: dict[str, dict] = {}
    entries: list[dict[str, str]] = []

    for path in files:
        region = infer_region(path)
        date = infer_date(path)
        if region not in {"global", "us"} or not date:
            continue

        for row in read_rows(path):
            title = field(row, ["track_name", "track name", "title"]).strip()
            artist = field(row, ["artist_names", "artist names", "artist"]).strip()
            uri = field(row, ["uri", "track_uri", "track uri"]).strip()
            if not title or not artist:
                continue

            rank = clean_int(field(row, ["rank"]))
            if rank is None:
                continue

            streams = clean_int(field(row, ["streams"]))
            weeks_on_chart = clean_int(field(row, ["weeks_on_chart", "weeks on chart"]))
            peak_position = clean_int(field(row, ["peak_rank", "peak rank", "peak_position"]))
            work_id = work_id_for(title, artist, uri)
            spotify_id = uri.rsplit(":", 1)[-1] if uri.startswith("spotify:track:") else ""
            image_url = field(row, ["display_image_url", "image_url", "cover_url"]).strip()

            identity.setdefault(
                work_id,
                {
                    "work_id": work_id,
                    "type": "single",
                    "title": title,
                    "artist": artist,
                    "spotify_id": spotify_id,
                    "spotify_url": f"https://open.spotify.com/track/{spotify_id}" if spotify_id else "",
                    "cover_url": image_url,
                },
            )
            if image_url and not identity[work_id].get("cover_url"):
                identity[work_id]["cover_url"] = image_url

            grouped[work_id].append(
                {
                    "date": date,
                    "region": region,
                    "rank": rank,
                    "streams": streams,
                    "weeks_on_chart": weeks_on_chart,
                    "peak_position": peak_position,
                }
            )
            entries.append(
                {
                    "work_id": work_id,
                    "platform": "spotify",
                    "chart_name": "top_200",
                    "region": region,
                    "date": date,
                    "rank": str(rank),
                    "streams": "" if streams is None else str(streams),
                    "weeks_on_chart": "" if weeks_on_chart is None else str(weeks_on_chart),
                    "peak_position": "" if peak_position is None else str(peak_position),
                }
            )

    catalog: list[dict] = []
    for work_id, rows in grouped.items():
        sorted_rows = sorted(rows, key=lambda item: item["date"])
        ranks = [row["rank"] for row in sorted_rows if row["rank"] is not None]
        weeks = [row["weeks_on_chart"] for row in sorted_rows if row["weeks_on_chart"] is not None]
        first = sorted_rows[0]
        latest = sorted_rows[-1]
        base = identity[work_id]
        catalog.append(
            {
                **base,
                "release_date": first["date"],
                "release_date_source": "spotify",
                "first_chart_date": first["date"],
                "latest_chart_date": latest["date"],
                "peak_rank": min(ranks) if ranks else None,
                "debut_rank": first["rank"],
                "total_chart_entries": len(sorted_rows),
                "weeks_at_number_one": sum(1 for rank in ranks if rank == 1),
                "weeks_in_top_10": sum(1 for rank in ranks if rank <= 10),
                "best_weeks_on_chart": max(weeks) if weeks else None,
            }
        )

    catalog.sort(key=lambda item: ((item.get("peak_rank") or 999), item["artist"].lower(), item["title"].lower()))
    return catalog, entries


def write_outputs(catalog: list[dict], entries: list[dict[str, str]]) -> None:
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    with ENTRIES_PATH.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=ENTRY_FIELDS)
        writer.writeheader()
        writer.writerows(entries)


if __name__ == "__main__":
    try:
        catalog_rows, entry_rows = build()
        write_outputs(catalog_rows, entry_rows)
        print(f"Wrote {len(catalog_rows)} Spotify catalog works to {CATALOG_PATH}")
        print(f"Wrote {len(entry_rows)} Spotify catalog entries to {ENTRIES_PATH}")
    except Exception as exc:
        print(f"Spotify catalog build failed: {exc}", file=sys.stderr)
        sys.exit(1)
