from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANUAL_WORKS_PATH = ROOT / "data" / "manual" / "works.csv"
CATALOG_PATH = ROOT / "data" / "processed" / "billboard_catalog.json"
COVERS_PATH = ROOT / "data" / "manual" / "covers.csv"

FIELDS = ["work_id", "cover_url", "album_name", "spotify_id", "spotify_url", "release_date", "release_date_source"]


def normalize(value: str) -> str:
    value = (value or "").lower()
    value = re.sub(r"\([^)]*\)", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def read_works(source: str) -> list[dict]:
    if source == "catalog":
        if not CATALOG_PATH.exists():
            raise FileNotFoundError("Missing data/processed/billboard_catalog.json. Run scripts/build_billboard_catalog.py first.")
        return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    if not MANUAL_WORKS_PATH.exists():
        raise FileNotFoundError("Missing data/manual/works.csv")
    return read_csv(MANUAL_WORKS_PATH)


def number(value) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def sort_works(works: list[dict], mode: str) -> list[dict]:
    if mode == "popular":
        return sorted(
            works,
            key=lambda work: (
                number(work.get("peak_rank")) or 999,
                -(number(work.get("total_chart_entries"))),
                (work.get("artist") or "").lower(),
                (work.get("title") or "").lower(),
            ),
        )
    if mode == "recent":
        return sorted(works, key=lambda work: work.get("latest_chart_date") or work.get("release_date") or "", reverse=True)
    return works


def existing_overrides() -> dict[str, dict[str, str]]:
    return {row["work_id"]: row for row in read_csv(COVERS_PATH) if row.get("work_id")}


def high_res_artwork(url: str) -> str:
    return re.sub(r"/\d+x\d+bb\.(jpg|png)$", r"/600x600bb.\1", url or "")


def score_result(work: dict, result: dict) -> int:
    title = normalize(work.get("title", ""))
    artist_token = normalize(work.get("artist", "")).split(" ")[0]
    result_title = normalize(result.get("trackName", ""))
    result_artist = normalize(result.get("artistName", ""))
    score = 0
    if title and title == result_title:
        score += 5
    elif title and title in result_title:
        score += 2
    if artist_token and artist_token in result_artist.split():
        score += 4
    return score


def fetch_cover(work: dict, timeout: float = 8) -> dict[str, str] | None:
    term = f"{work.get('title', '')} {work.get('artist', '')}"
    query = urllib.parse.urlencode({"term": term, "entity": "song", "limit": "5", "media": "music"})
    url = f"https://itunes.apple.com/search?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "PopChartCompare/1.1"})

    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    results = payload.get("results", [])
    if not results:
        return None

    best = max(results, key=lambda result: score_result(work, result))
    if score_result(work, best) < 4:
        return None

    return {
        "work_id": work["work_id"],
        "cover_url": high_res_artwork(best.get("artworkUrl100", "")),
        "album_name": best.get("collectionName", ""),
        "spotify_id": "",
        "spotify_url": "",
        "release_date": (best.get("releaseDate", "") or "")[:10],
        "release_date_source": "manual",
    }


def write_overrides(rows: dict[str, dict[str, str]]) -> None:
    COVERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with COVERS_PATH.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FIELDS)
        writer.writeheader()
        for row in rows.values():
            writer.writerow({field: row.get(field, "") for field in FIELDS})


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch cover art URLs from iTunes Search API.")
    parser.add_argument("--source", choices=["manual", "catalog"], default="manual")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--skip-attempted", action="store_true", help="Skip rows that already exist in covers.csv, even without cover_url.")
    parser.add_argument("--sort", choices=["source", "popular", "recent"], default="popular")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--save-every", type=int, default=10)
    parser.add_argument("--request-timeout", type=float, default=8)
    args = parser.parse_args()

    works = sort_works(read_works(args.source), args.sort)
    overrides = existing_overrides()
    fetched = 0

    for work in works:
        if fetched >= args.limit:
            break
        work_id = work.get("work_id")
        if not work_id:
            continue
        if not args.overwrite and overrides.get(work_id, {}).get("cover_url"):
            continue
        if not args.overwrite and args.skip_attempted and work_id in overrides:
            continue

        try:
            row = fetch_cover(work, timeout=args.request_timeout)
        except Exception as exc:
            print(f"Warning: failed to fetch {work.get('title')} - {work.get('artist')}: {exc}", file=sys.stderr)
            if args.skip_attempted:
                overrides[work_id] = {
                    **overrides.get(work_id, {}),
                    "work_id": work_id,
                }
                fetched += 1
                if fetched % args.save_every == 0:
                    write_overrides(overrides)
                    print(f"Checkpoint: wrote {len(overrides)} cover rows")
            continue

        if row:
            overrides[work_id] = {**overrides.get(work_id, {}), **row}
            fetched += 1
            print(f"Fetched cover: {work.get('title')} - {work.get('artist')}")
            if fetched % args.save_every == 0:
                write_overrides(overrides)
                print(f"Checkpoint: wrote {len(overrides)} cover rows")
        elif args.skip_attempted:
            overrides[work_id] = {
                **overrides.get(work_id, {}),
                "work_id": work_id,
            }
            fetched += 1
            print(f"No confident cover: {work.get('title')} - {work.get('artist')}")
            if fetched % args.save_every == 0:
                write_overrides(overrides)
                print(f"Checkpoint: wrote {len(overrides)} cover rows")

        time.sleep(args.sleep)

    write_overrides(overrides)
    print(f"Wrote {len(overrides)} cover rows to {COVERS_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Cover fetch failed: {exc}", file=sys.stderr)
        sys.exit(1)
