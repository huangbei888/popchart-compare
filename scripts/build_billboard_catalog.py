from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_PATH = ROOT / "data" / "raw" / "billboard" / "all.json"
CATALOG_PATH = ROOT / "data" / "processed" / "billboard_catalog.json"
ENTRIES_PATH = ROOT / "data" / "processed" / "billboard_catalog_entries.csv"

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


def key_for(song: str, artist: str) -> str:
    return f"{slugify(artist)}__{slugify(song)}"


def load_billboard() -> list[dict]:
    if not RAW_PATH.exists():
        raise FileNotFoundError(
            "Missing Billboard raw data. Download all.json to data/raw/billboard/all.json from "
            "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/all.json"
        )
    with RAW_PATH.open("r", encoding="utf-8") as file:
        return json.load(file)


def number(value):
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def build() -> tuple[list[dict], list[dict[str, str]]]:
    charts = load_billboard()
    grouped: dict[str, list[dict]] = defaultdict(list)
    identity: dict[str, tuple[str, str]] = {}
    entries: list[dict[str, str]] = []

    for chart in charts:
        date = chart.get("date", "")
        for item in chart.get("data", []):
            title = item.get("song", "") or ""
            artist = item.get("artist", "") or ""
            work_id = key_for(title, artist)
            rank = number(item.get("this_week"))
            weeks_on_chart = number(item.get("weeks_on_chart"))
            peak_position = number(item.get("peak_position"))

            identity.setdefault(work_id, (title, artist))
            grouped[work_id].append(
                {
                    "date": date,
                    "rank": rank,
                    "weeks_on_chart": weeks_on_chart,
                    "peak_position": peak_position,
                }
            )
            entries.append(
                {
                    "work_id": work_id,
                    "platform": "billboard",
                    "chart_name": "hot_100",
                    "region": "us",
                    "date": date,
                    "rank": "" if rank is None else str(rank),
                    "streams": "",
                    "weeks_on_chart": "" if weeks_on_chart is None else str(weeks_on_chart),
                    "peak_position": "" if peak_position is None else str(peak_position),
                }
            )

    catalog: list[dict] = []
    for work_id, rows in grouped.items():
        sorted_rows = sorted(rows, key=lambda row: row["date"])
        ranks = [row["rank"] for row in sorted_rows if row["rank"] is not None]
        weeks = [row["weeks_on_chart"] for row in sorted_rows if row["weeks_on_chart"] is not None]
        title, artist = identity[work_id]
        first = sorted_rows[0]
        latest = sorted_rows[-1]
        catalog.append(
            {
                "work_id": work_id,
                "type": "single",
                "title": title,
                "artist": artist,
                "release_date": first["date"],
                "release_date_source": "billboard_debut",
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

    catalog.sort(key=lambda item: (item["artist"].lower(), item["title"].lower(), item["work_id"]))
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
        print(f"Wrote {len(catalog_rows)} Billboard catalog works to {CATALOG_PATH}")
        print(f"Wrote {len(entry_rows)} Billboard catalog entries to {ENTRIES_PATH}")
    except Exception as exc:
        print(f"Billboard catalog build failed: {exc}", file=sys.stderr)
        sys.exit(1)
