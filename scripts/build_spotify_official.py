from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKS_PATH = ROOT / "data" / "manual" / "works.csv"
RAW_DIR = ROOT / "data" / "raw" / "spotify" / "official"
OUT_PATH = ROOT / "data" / "processed" / "spotify_official_entries.csv"

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
    "usa": "us",
    "united states": "us",
}

TITLE_FIELDS = ("track_name", "track name", "title")
ARTIST_FIELDS = ("artist_names", "artist names", "artist")


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


def field(row: dict[str, str], names: tuple[str, ...] | list[str], default: str = "") -> str:
    normalized = {key.strip().lower(): value for key, value in row.items() if key is not None}
    for name in names:
        if name in normalized:
            return normalized[name] or default
    return default


def clean_int(value: str) -> str:
    value = (value or "").strip().replace(",", "")
    if not value:
        return ""
    try:
        return str(int(float(value)))
    except ValueError:
        return ""


def normalize_region(value: str) -> str | None:
    key = normalize(value)
    return REGION_ALIASES.get(key)


def infer_region(path: Path) -> str | None:
    text = normalize(path.stem.replace("-", " ").replace("_", " "))
    if "global" in text.split():
        return "global"
    if "united states" in text or " us " in f" {text} ":
        return "us"
    return None


def infer_date(path: Path) -> str | None:
    # Daily files usually contain one date; weekly files often contain start and end dates.
    # Use the last date so weekly rows land on the chart week ending date.
    matches = re.findall(r"\d{4}-\d{2}-\d{2}", path.name)
    return matches[-1] if matches else None


def matches(work: dict[str, str], row: dict[str, str]) -> bool:
    work_title = normalize(work["title"])
    row_title = normalize(field(row, TITLE_FIELDS))
    if work_title != row_title:
        return False

    token = main_artist_token(work["artist"])
    row_artist = normalize(field(row, ARTIST_FIELDS))
    return bool(token and token in row_artist.split())


def read_official_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.reader(file))

    if rows and {cell.strip().lower() for cell in rows[0]} >= {"date", "region", "chart", "url", "save_as"}:
        return []

    header_index = None
    for index, row in enumerate(rows):
        lowered = {cell.strip().lower() for cell in row}
        if "rank" in lowered and ({"track_name", "track name", "title"} & lowered):
            header_index = index
            break

    if header_index is None:
        print(f"Warning: could not find a Spotify header row in {path}", file=sys.stderr)
        return []

    header = rows[header_index]
    data_rows = rows[header_index + 1 :]
    return [dict(zip(header, row)) for row in data_rows if any(cell.strip() for cell in row)]


def build_entries() -> list[dict[str, str]]:
    if not RAW_DIR.exists():
        raise FileNotFoundError(
            "Missing official Spotify raw directory. Create data/raw/spotify/official "
            "and place CSV files downloaded from https://charts.spotify.com/ there."
        )

    files = sorted(path for path in RAW_DIR.rglob("*.csv") if path.name != "download_links.csv")
    if not files:
        raise FileNotFoundError(
            "No official Spotify CSV files found in data/raw/spotify/official. "
            "Download CSV files from https://charts.spotify.com/ and place them there."
        )

    works = load_works()
    output: list[dict[str, str]] = []

    for path in files:
        file_region = infer_region(path)
        file_date = infer_date(path)
        rows = read_official_csv(path)

        for item in rows:
            region = normalize_region(field(item, ["region"])) or file_region
            date = field(item, ["date", "chart_date", "chart date"]) or file_date
            if region not in {"global", "us"} or not date:
                continue

            for work in works:
                if not matches(work, item):
                    continue
                output.append(
                    {
                        "work_id": work["work_id"],
                        "platform": "spotify",
                        "chart_name": "top_200",
                        "region": region,
                        "date": date,
                        "rank": clean_int(field(item, ["rank"])),
                        "streams": clean_int(field(item, ["streams"])),
                        "weeks_on_chart": clean_int(field(item, ["weeks_on_chart", "weeks on chart"])),
                        "peak_position": clean_int(field(item, ["peak_rank", "peak rank", "peak_position"])),
                    }
                )

    return output


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
        print(f"Wrote {len(entries)} official Spotify entries to {OUT_PATH}")
    except Exception as exc:
        print(f"Official Spotify build failed: {exc}", file=sys.stderr)
        sys.exit(1)
