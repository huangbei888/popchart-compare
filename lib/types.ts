export type WorkType = "single";

export type ReleaseDateSource = "spotify" | "manual" | "billboard_debut";

export type Work = {
  work_id: string;
  type: WorkType;
  title: string;
  artist: string;
  release_date?: string;
  release_date_source?: ReleaseDateSource;
  spotify_id?: string;
  spotify_url?: string;
  cover_url?: string;
  album_name?: string;
  first_chart_date?: string;
  latest_chart_date?: string;
  peak_rank?: number | null;
  debut_rank?: number | null;
  total_chart_entries?: number | null;
  weeks_at_number_one?: number | null;
  weeks_in_top_10?: number | null;
  best_weeks_on_chart?: number | null;
};

export type Platform = "billboard" | "spotify";
export type TimelineMode = "absolute" | "relative";
export type ChartValueMode = "rank" | "streams";
export type ChartStatus = "Charting" | "Out" | "Re-entry";

export type ChartEntry = {
  work_id: string;
  platform: Platform;
  chart_name: string;
  region: string;
  date: string;
  rank: number | null;
  streams: number | null;
  weeks_on_chart: number | null;
  peak_position: number | null;
};

export type ChartMetric = {
  work_id: string;
  title: string;
  artist: string;
  cover_url?: string;
  spotify_url?: string;
  album_name?: string;
  peakRank: number | null;
  debutRank: number | null;
  debutDate: string | null;
  latestRank: number | null;
  latestDate: string | null;
  firstChartDate: string | null;
  totalEntries: number;
  weeksOnChart: number | null;
  weeksAtNumberOne: number;
  weeksInTop10: number;
  biggestRise: number | null;
  biggestDrop: number | null;
  status: ChartStatus;
  reEntryCount: number;
  maxStreams: number | null;
  sparkline: Array<{ date: string; rank: number }>;
};

export type ChartMarker = {
  work_id: string;
  type: "re" | "out";
  x: string;
  y: number;
  label: string;
};

export type CoverageGap = {
  start: string;
  end: string;
  days: number;
};

export type DatasetCoverage = {
  platform: Platform;
  region: string;
  firstDate: string | null;
  latestDate: string | null;
  totalChartDates: number;
  expectedChartDates: number;
  missingChartDates: number;
  gaps: CoverageGap[];
};

export type WorkCoverage = {
  work_id: string;
  title: string;
  artist: string;
  releaseDate?: string;
  firstEntryDate: string | null;
  latestEntryDate: string | null;
  totalEntries: number;
  coverageStartsAfterRelease: boolean;
  missingBeforeFirstEntry: number | null;
};
