# PopChart Compare TODO

## Data Enrichment

- [ ] Continue batch cover fetching for Billboard catalog.
  - Recommended command:
    ```bash
    python scripts/fetch_covers_itunes.py --source catalog --limit 500 --sleep 0.1 --save-every 10
    python scripts/build_all.py
    ```
  - Review `data/manual/covers.csv` after each batch for mismatches.
  - Avoid fetching the full 30k+ catalog in one run.
- [ ] Investigate deeper Kworb Spotify history coverage.
  - Current script imports recent daily rows from Kworb track pages.
  - Need to confirm whether older daily history is available elsewhere on Kworb or only summarized in totals.
  - Consider adding a Kworb catalog/search cache if Spotify becomes a mainline feature.
- [ ] Build Spotify official CSV bulk download workflow.
  - Link manifest generator is available:
    ```bash
    python scripts/make_spotify_official_links.py --regions global,us --chart daily --start 2024-04-01 --end 2024-07-01
    ```
  - Next step: browser-assisted downloader that opens each URL while logged in and clicks Download CSV.
  - Browser-assisted downloader is available:
    ```bash
    npm run spotify:download -- --limit 10
    ```
  - Test with a small limit first because Spotify Charts may change button labels or login flow.

## Business Improvements

- [ ] Add sortable comparison table columns.
- [ ] Add selected-track quick filters: Charting, Out, Re-entry, Peak #1, Top 10.
- [ ] Add chart event rail for Out/Re periods.
- [ ] Add data coverage panel showing latest Billboard date and selected chart range.
- [ ] Add manual correction UI or workflow for cover mismatches.

## Future Modules

- [ ] Artist Compare.
- [ ] Billboard #1 Explorer.
- [ ] Spotify Streaming Distribution.
- [ ] Album trajectory comparison.
