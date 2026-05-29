from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / "data" / "manual" / "works.csv"
COVERS_PATH = ROOT / "data" / "manual" / "covers.csv"
PROCESSED_DIR = ROOT / "data" / "processed"
BILLBOARD_PATH = PROCESSED_DIR / "billboard_entries.csv"
BILLBOARD_CATALOG_ENTRIES_PATH = PROCESSED_DIR / "billboard_catalog_entries.csv"
SPOTIFY_PATH = PROCESSED_DIR / "spotify_entries.csv"
SPOTIFY_OFFICIAL_PATH = PROCESSED_DIR / "spotify_official_entries.csv"
SPOTIFY_CATALOG_PATH = PROCESSED_DIR / "spotify_catalog.json"
SPOTIFY_CATALOG_ENTRIES_PATH = PROCESSED_DIR / "spotify_catalog_entries.csv"
SPOTIFY_KWORB_PATH = PROCESSED_DIR / "spotify_kworb_entries.csv"
WORKS_JSON_PATH = PROCESSED_DIR / "works.json"
ENTRIES_JSON_PATH = PROCESSED_DIR / "chart_entries.json"
MANIFEST_JSON_PATH = PROCESSED_DIR / "manifest.json"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
PUBLIC_ENTRIES_DIR = PUBLIC_DATA_DIR / "chart_entries"
PUBLIC_WORK_ENTRIES_DIR = PUBLIC_DATA_DIR / "work_entries"
COVER_FIELDS = {"cover_url", "album_name", "spotify_id", "spotify_url", "release_date", "release_date_source"}


def as_number(value: str):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    return int(number) if number.is_integer() else number


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        print(f"Warning: {path} does not exist, using empty rows.", file=sys.stderr)
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def normalize_entry(row: dict[str, str]) -> dict:
    return {
        "work_id": row.get("work_id", ""),
        "platform": row.get("platform", ""),
        "chart_name": row.get("chart_name", ""),
        "region": row.get("region", ""),
        "date": row.get("date", ""),
        "rank": as_number(row.get("rank", "")),
        "streams": as_number(row.get("streams", "")),
        "weeks_on_chart": as_number(row.get("weeks_on_chart", "")),
        "peak_position": as_number(row.get("peak_position", "")),
    }


def load_cover_overrides() -> dict[str, dict[str, str]]:
    rows = read_csv(COVERS_PATH)
    overrides: dict[str, dict[str, str]] = {}
    for row in rows:
        work_id = row.get("work_id", "").strip()
        if not work_id:
            continue
        overrides[work_id] = {key: value for key, value in row.items() if key in COVER_FIELDS and value}
    return overrides


def apply_overrides(works: list[dict], overrides: dict[str, dict[str, str]]) -> list[dict]:
    return [{**work, **overrides.get(work.get("work_id", ""), {})} for work in works]


def write_public_entry_shards(entries: list[dict]) -> None:
    PUBLIC_ENTRIES_DIR.mkdir(parents=True, exist_ok=True)
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for entry in entries:
        grouped[(entry["platform"], entry["region"])].append(entry)

    index = []
    for path in PUBLIC_ENTRIES_DIR.glob("*.json"):
        path.unlink()

    for (platform, region), rows in sorted(grouped.items()):
        file_name = f"{platform}_{region}.json"
        (PUBLIC_ENTRIES_DIR / file_name).write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        dates = sorted({row["date"] for row in rows if row.get("date")})
        index.append(
            {
                "platform": platform,
                "region": region,
                "file": f"/data/chart_entries/{file_name}",
                "entries": len(rows),
                "first_date": dates[0] if dates else None,
                "latest_date": dates[-1] if dates else None,
            }
        )

    (PUBLIC_DATA_DIR / "chart_entries_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    old_public_entries = PUBLIC_DATA_DIR / "chart_entries.json"
    if old_public_entries.exists():
        old_public_entries.unlink()


def remove_public_entry_shards() -> None:
    if PUBLIC_ENTRIES_DIR.exists():
        for path in PUBLIC_ENTRIES_DIR.glob("*.json"):
            path.unlink()
    old_public_entries = PUBLIC_DATA_DIR / "chart_entries.json"
    if old_public_entries.exists():
        old_public_entries.unlink()


def write_public_chart_index(entries: list[dict]) -> None:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for entry in entries:
        grouped[(entry["platform"], entry["region"])].append(entry)

    index = []
    for (platform, region), rows in sorted(grouped.items()):
        dates = sorted({row["date"] for row in rows if row.get("date")})
        index.append(
            {
                "platform": platform,
                "region": region,
                "file": "",
                "entries": len(rows),
                "first_date": dates[0] if dates else None,
                "latest_date": dates[-1] if dates else None,
                "dates": dates,
            }
        )

    (PUBLIC_DATA_DIR / "chart_entries_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_public_work_entry_shards(entries: list[dict]) -> dict[str, dict]:
    PUBLIC_WORK_ENTRIES_DIR.mkdir(parents=True, exist_ok=True)
    for path in PUBLIC_WORK_ENTRIES_DIR.glob("*.json"):
        path.unlink()

    grouped: dict[str, list[dict]] = defaultdict(list)
    for entry in entries:
        grouped[entry["work_id"]].append(entry)

    index = {}
    for work_id, rows in sorted(grouped.items()):
        rows = sorted(rows, key=lambda row: (row["platform"], row["region"], row["date"]))
        digest = hashlib.sha1(work_id.encode("utf-8")).hexdigest()[:16]
        file_name = f"{digest}.json"
        (PUBLIC_WORK_ENTRIES_DIR / file_name).write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        platforms = sorted({row["platform"] for row in rows})
        regions = sorted({row["region"] for row in rows})
        index[work_id] = {
            "file": f"/data/work_entries/{file_name}",
            "entries": len(rows),
            "platforms": platforms,
            "regions": regions,
        }

    (PUBLIC_DATA_DIR / "work_entries_index.json").write_text(
        json.dumps(index, ensure_ascii=False),
        encoding="utf-8",
    )

    return index


def build_search_catalog(catalog: list[dict], entry_index: dict[str, dict]) -> list[dict]:
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


def build_manifest(entries: list[dict]) -> dict:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for entry in entries:
        if entry.get("platform") and entry.get("region") and entry.get("date"):
            grouped[(entry["platform"], entry["region"])].append(entry)

    datasets = []
    for (platform, region), rows in sorted(grouped.items()):
        dates = sorted({row["date"] for row in rows if row.get("date")})
        datasets.append(
            {
                "platform": platform,
                "region": region,
                "entries": len(rows),
                "first_date": dates[0] if dates else None,
                "latest_date": dates[-1] if dates else None,
            }
        )

    spotify_latest = {
        item["region"]: item["latest_date"]
        for item in datasets
        if item["platform"] == "spotify" and item["latest_date"]
    }

    return {
        "version": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "datasets": datasets,
        "spotify_latest_dates": spotify_latest,
    }


def main() -> None:
    if not WORKS_PATH.exists():
        raise FileNotFoundError(f"Missing works file: {WORKS_PATH}")

    cover_overrides = load_cover_overrides()
    works = apply_overrides(read_csv(WORKS_PATH), cover_overrides)
    spotify_catalog_entries = read_csv(SPOTIFY_CATALOG_ENTRIES_PATH)
    legacy_spotify_entries = [] if spotify_catalog_entries else (
        read_csv(SPOTIFY_PATH)
        + read_csv(SPOTIFY_OFFICIAL_PATH)
        + read_csv(SPOTIFY_KWORB_PATH)
    )
    raw_entries = (
        read_csv(BILLBOARD_CATALOG_ENTRIES_PATH)
        + read_csv(BILLBOARD_PATH)
        + spotify_catalog_entries
        + legacy_spotify_entries
    )

    deduped: dict[tuple[str, str, str, str, str], dict] = {}
    for row in raw_entries:
        if not row.get("work_id"):
            continue
        entry = normalize_entry(row)
        key = (
            entry["work_id"],
            entry["platform"],
            entry["chart_name"],
            entry["region"],
            entry["date"],
        )
        deduped[key] = entry

    entries = sorted(deduped.values(), key=lambda row: (row["platform"], row["region"], row["work_id"], row["date"]))

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    WORKS_JSON_PATH.write_text(json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8")
    ENTRIES_JSON_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    (PUBLIC_DATA_DIR / "works.json").write_text(json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8")
    remove_public_entry_shards()
    write_public_chart_index(entries)
    entry_index = write_public_work_entry_shards(entries)
    manifest = build_manifest(entries)
    MANIFEST_JSON_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (PUBLIC_DATA_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    catalog_path = PROCESSED_DIR / "billboard_catalog.json"
    if catalog_path.exists():
        catalog = apply_overrides(json.loads(catalog_path.read_text(encoding="utf-8")), cover_overrides)
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
        (PUBLIC_DATA_DIR / "billboard_catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
        (PUBLIC_DATA_DIR / "billboard_search_catalog.json").write_text(
            json.dumps(build_search_catalog(catalog, entry_index), ensure_ascii=False),
            encoding="utf-8",
        )

    if SPOTIFY_CATALOG_PATH.exists():
        spotify_catalog = apply_overrides(json.loads(SPOTIFY_CATALOG_PATH.read_text(encoding="utf-8")), cover_overrides)
        SPOTIFY_CATALOG_PATH.write_text(json.dumps(spotify_catalog, ensure_ascii=False, indent=2), encoding="utf-8")
        (PUBLIC_DATA_DIR / "spotify_catalog.json").write_text(
            json.dumps(spotify_catalog, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        (PUBLIC_DATA_DIR / "spotify_search_catalog.json").write_text(
            json.dumps(build_search_catalog(spotify_catalog, entry_index), ensure_ascii=False),
            encoding="utf-8",
        )

    print(f"Wrote {len(works)} works to {WORKS_JSON_PATH}")
    print(f"Wrote {len(entries)} chart entries to {ENTRIES_JSON_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Build all failed: {exc}", file=sys.stderr)
        sys.exit(1)
