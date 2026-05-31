from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / "public" / "data"
PUBLIC_WORK_ENTRIES_DIR = PUBLIC_DATA_DIR / "work_entries"
RECENT_URL = "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/recent.json"


def slugify(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"\b(featuring|feat\.?|ft\.?)\b", " featuring ", value)
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return re.sub(r"_+", "_", value).strip("_") or "unknown"


def key_for(song: str, artist: str) -> str:
    return f"{slugify(artist)}__{slugify(song)}"


def as_number(value):
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return int(parsed) if parsed.is_integer() else parsed


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=indent), encoding="utf-8")


def fetch_recent() -> dict:
    with urllib.request.urlopen(RECENT_URL, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def load_recent(path: Path | None) -> dict:
    if path:
        return read_json(path, {})
    return fetch_recent()


def work_entry_file(work_id: str, entry_index: dict) -> Path:
    existing = entry_index.get(work_id, {}).get("file")
    if existing:
        file_name = existing.rsplit("/", 1)[-1]
    else:
        file_name = f"{hashlib.sha1(work_id.encode('utf-8')).hexdigest()[:16]}.json"
    return PUBLIC_WORK_ENTRIES_DIR / file_name


def entry_sort_key(row: dict) -> tuple:
    return (
        row.get("platform", ""),
        row.get("region", ""),
        row.get("chart_name", ""),
        row.get("date", ""),
    )


def summarize_entry_index(rows: list[dict], file_name: str) -> dict:
    return {
        "file": f"/data/work_entries/{file_name}",
        "entries": len(rows),
        "platforms": sorted({row.get("platform", "") for row in rows if row.get("platform")}),
        "regions": sorted({row.get("region", "") for row in rows if row.get("region")}),
    }


def billboard_rows(rows: list[dict]) -> list[dict]:
    return [
        row
        for row in rows
        if row.get("platform") == "billboard"
        and row.get("region") == "us"
        and row.get("chart_name") == "hot_100"
        and row.get("date")
    ]


def update_catalog_item(existing: dict | None, title: str, artist: str, rows: list[dict]) -> dict:
    rows = sorted(rows, key=lambda row: row["date"])
    ranks = [row.get("rank") for row in rows if row.get("rank") is not None]
    weeks = [row.get("weeks_on_chart") for row in rows if row.get("weeks_on_chart") is not None]
    first = rows[0]
    latest = rows[-1]

    item = dict(existing or {})
    item.setdefault("type", "single")
    item["title"] = item.get("title") or title
    item["artist"] = item.get("artist") or artist
    item.setdefault("release_date", first["date"])
    item.setdefault("release_date_source", "billboard_debut")
    item["first_chart_date"] = first["date"]
    item["latest_chart_date"] = latest["date"]
    item["peak_rank"] = min(ranks) if ranks else None
    item["debut_rank"] = first.get("rank")
    item["total_chart_entries"] = len(rows)
    item["weeks_at_number_one"] = sum(1 for rank in ranks if rank == 1)
    item["weeks_in_top_10"] = sum(1 for rank in ranks if rank <= 10)
    item["best_weeks_on_chart"] = max(weeks) if weeks else None
    return item


def build_search_catalog(catalog: list[dict], entry_index: dict) -> list[dict]:
    fields = [
        "work_id",
        "type",
        "title",
        "artist",
        "release_date",
        "release_date_source",
        "spotify_id",
        "spotify_url",
        "cover_url",
        "album_name",
        "first_chart_date",
        "latest_chart_date",
        "peak_rank",
        "debut_rank",
        "total_chart_entries",
        "weeks_at_number_one",
        "weeks_in_top_10",
        "best_weeks_on_chart",
    ]
    rows = []
    for work in catalog:
        info = entry_index.get(work.get("work_id", ""))
        if not info:
            continue
        compact = {key: work[key] for key in fields if key in work and work[key] not in ("", None)}
        compact["entry_file"] = info["file"]
        compact["entry_count"] = info["entries"]
        compact["platforms"] = info["platforms"]
        compact["regions"] = info["regions"]
        rows.append(compact)
    return rows


def update_chart_index(recent_date: str, entry_count_delta: int) -> None:
    path = PUBLIC_DATA_DIR / "chart_entries_index.json"
    rows = read_json(path, [])
    target = None
    for row in rows:
        if row.get("platform") == "billboard" and row.get("region") == "us":
            target = row
            break
    if target is None:
        target = {
            "platform": "billboard",
            "region": "us",
            "file": "",
            "entries": 0,
            "first_date": recent_date,
            "latest_date": recent_date,
            "dates": [],
        }
        rows.append(target)

    dates = set(target.get("dates") or [])
    dates.add(recent_date)
    sorted_dates = sorted(dates)
    target["entries"] = int(target.get("entries") or 0) + entry_count_delta
    target["first_date"] = sorted_dates[0]
    target["latest_date"] = sorted_dates[-1]
    target["dates"] = sorted_dates
    write_json(path, rows, indent=2)


def update_manifest() -> None:
    manifest_path = PUBLIC_DATA_DIR / "manifest.json"
    manifest = read_json(manifest_path, {"datasets": []})
    chart_index = read_json(PUBLIC_DATA_DIR / "chart_entries_index.json", [])
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    index_by_dataset = {
        (item.get("platform"), item.get("region")): item
        for item in chart_index
        if item.get("platform") and item.get("region")
    }
    datasets = []
    existing_keys = {(item.get("platform"), item.get("region")) for item in manifest.get("datasets", [])}
    keys = sorted(existing_keys | set(index_by_dataset.keys()))
    for platform, region in keys:
        indexed = index_by_dataset.get((platform, region), {})
        existing = next(
            (
                item
                for item in manifest.get("datasets", [])
                if item.get("platform") == platform and item.get("region") == region
            ),
            {},
        )
        datasets.append(
            {
                "platform": platform,
                "region": region,
                "entries": indexed.get("entries", existing.get("entries", 0)),
                "first_date": indexed.get("first_date", existing.get("first_date")),
                "latest_date": indexed.get("latest_date", existing.get("latest_date")),
            }
        )

    spotify_latest = {
        item["region"]: item["latest_date"]
        for item in datasets
        if item.get("platform") == "spotify" and item.get("latest_date")
    }
    write_json(
        manifest_path,
        {
            "version": now,
            "generated_at": now,
            "datasets": datasets,
            "spotify_latest_dates": spotify_latest,
        },
        indent=2,
    )


def latest_billboard_date() -> str | None:
    manifest = read_json(PUBLIC_DATA_DIR / "manifest.json", {})
    for item in manifest.get("datasets", []):
        if item.get("platform") == "billboard" and item.get("region") == "us":
            return item.get("latest_date")
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Incrementally update public data from Billboard recent.json.")
    parser.add_argument("--recent", type=Path, help="Path to a downloaded recent.json. Defaults to fetching from GitHub.")
    args = parser.parse_args()

    recent = load_recent(args.recent)
    recent_date = recent.get("date")
    items = recent.get("data") or []
    if not recent_date or not items:
        raise ValueError("recent.json must contain a date and a non-empty data array.")

    current_latest = latest_billboard_date()
    if current_latest and recent_date < current_latest:
        print(f"Billboard recent date {recent_date} is older than current {current_latest}; skipping.")
        return

    catalog_path = PUBLIC_DATA_DIR / "billboard_catalog.json"
    search_path = PUBLIC_DATA_DIR / "billboard_search_catalog.json"
    index_path = PUBLIC_DATA_DIR / "work_entries_index.json"
    catalog = read_json(catalog_path, [])
    catalog_by_id = {item.get("work_id"): item for item in catalog if item.get("work_id")}
    entry_index = read_json(index_path, {})

    touched: dict[str, tuple[str, str, list[dict]]] = {}
    entry_count_delta = 0

    for item in items:
        title = item.get("song", "") or ""
        artist = item.get("artist", "") or ""
        work_id = key_for(title, artist)
        entry = {
            "work_id": work_id,
            "platform": "billboard",
            "chart_name": "hot_100",
            "region": "us",
            "date": recent_date,
            "rank": as_number(item.get("this_week")),
            "streams": None,
            "weeks_on_chart": as_number(item.get("weeks_on_chart")),
            "peak_position": as_number(item.get("peak_position")),
        }

        path = work_entry_file(work_id, entry_index)
        rows = read_json(path, [])
        before = len(rows)
        rows = [
            row
            for row in rows
            if not (
                row.get("platform") == "billboard"
                and row.get("region") == "us"
                and row.get("chart_name") == "hot_100"
                and row.get("date") == recent_date
            )
        ]
        removed = before - len(rows)
        rows.append(entry)
        rows.sort(key=entry_sort_key)
        write_json(path, rows)
        entry_count_delta += 1 - removed

        entry_index[work_id] = summarize_entry_index(rows, path.name)
        touched[work_id] = (title, artist, billboard_rows(rows))

    for work_id, (title, artist, rows) in touched.items():
        if not rows:
            continue
        updated = update_catalog_item(catalog_by_id.get(work_id), title, artist, rows)
        updated["work_id"] = work_id
        catalog_by_id[work_id] = updated

    catalog = sorted(
        catalog_by_id.values(),
        key=lambda item: (
            (item.get("artist") or "").lower(),
            (item.get("title") or "").lower(),
            item.get("work_id") or "",
        ),
    )
    write_json(catalog_path, catalog, indent=2)
    write_json(index_path, entry_index)
    update_chart_index(recent_date, entry_count_delta)
    write_json(search_path, build_search_catalog(catalog, entry_index))
    update_manifest()
    print(f"Updated Billboard public data with {len(items)} rows for {recent_date}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Billboard recent update failed: {exc}", file=sys.stderr)
        sys.exit(1)
