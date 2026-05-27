from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "raw" / "spotify" / "official"
OUT_PATH = OUT_DIR / "download_links.csv"

REGIONS = {"global", "us"}
CHARTS = {"daily", "weekly"}


def parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid date {value}. Use YYYY-MM-DD.") from exc


def daterange(start: date, end: date, step_days: int):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=step_days)


def make_url(region: str, chart: str, chart_date: date) -> str:
    return f"https://charts.spotify.com/charts/view/regional-{region}-{chart}/{chart_date.isoformat()}"


def make_file_name(region: str, chart: str, chart_date: date) -> str:
    return f"regional-{region}-{chart}-{chart_date.isoformat()}.csv"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Spotify Charts official CSV download page links.")
    parser.add_argument("--regions", default="global,us", help="Comma-separated regions, e.g. global,us")
    parser.add_argument("--chart", choices=sorted(CHARTS), default="daily")
    parser.add_argument("--start", type=parse_date, required=True)
    parser.add_argument("--end", type=parse_date, required=True)
    parser.add_argument("--out", type=Path, default=OUT_PATH)
    args = parser.parse_args()

    if args.end < args.start:
        raise ValueError("--end must be after --start")

    regions = [region.strip().lower() for region in args.regions.split(",") if region.strip()]
    invalid_regions = [region for region in regions if region not in REGIONS]
    if invalid_regions:
        raise ValueError(f"Unsupported regions: {', '.join(invalid_regions)}. Supported: {', '.join(sorted(REGIONS))}")

    step_days = 7 if args.chart == "weekly" else 1
    rows = []
    for region in regions:
        for chart_date in daterange(args.start, args.end, step_days):
            rows.append(
                {
                    "date": chart_date.isoformat(),
                    "region": region,
                    "chart": args.chart,
                    "url": make_url(region, args.chart, chart_date),
                    "save_as": make_file_name(region, args.chart, chart_date),
                }
            )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=["date", "region", "chart", "url", "save_as"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} Spotify official chart links to {args.out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Spotify official link generation failed: {exc}", file=sys.stderr)
        sys.exit(1)
