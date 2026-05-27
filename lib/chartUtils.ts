import dayjs from "dayjs";
import type {
  ChartEntry,
  ChartMarker,
  ChartMetric,
  ChartValueMode,
  ChartStatus,
  CoverageGap,
  DatasetCoverage,
  Platform,
  TimelineMode,
  Work,
  WorkCoverage,
} from "./types";

type ChartFilters = {
  workIds: string[];
  platform: Platform;
  region: string;
};

type LinePoint = {
  x: string;
  sortValue: number;
  [workId: string]: string | number | null;
};

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeWork(work: Work): Work {
  return {
    ...work,
    type: work.type ?? "single",
    release_date_source: work.release_date_source ?? (work.release_date ? "manual" : undefined),
    peak_rank: numberOrNull(work.peak_rank),
    debut_rank: numberOrNull(work.debut_rank),
    total_chart_entries: numberOrNull(work.total_chart_entries),
    weeks_at_number_one: numberOrNull(work.weeks_at_number_one),
    weeks_in_top_10: numberOrNull(work.weeks_in_top_10),
    best_weeks_on_chart: numberOrNull(work.best_weeks_on_chart),
  };
}

export function mergeWorks(primary: Work[], fallback: Work[]): Work[] {
  const merged = new Map<string, Work>();
  fallback.map(normalizeWork).forEach((work) => merged.set(work.work_id, work));
  primary.map(normalizeWork).forEach((work) => merged.set(work.work_id, { ...merged.get(work.work_id), ...work }));
  return Array.from(merged.values());
}

export function normalizeChartData(entries: ChartEntry[], filters: ChartFilters): ChartEntry[] {
  const selected = new Set(filters.workIds);

  return entries
    .filter((entry) => {
      return (
        selected.has(entry.work_id) &&
        entry.platform === filters.platform &&
        entry.region.toLowerCase() === filters.region.toLowerCase()
      );
    })
    .map((entry) => ({
      ...entry,
      rank: numberOrNull(entry.rank),
      streams: numberOrNull(entry.streams),
      weeks_on_chart: numberOrNull(entry.weeks_on_chart),
      peak_position: numberOrNull(entry.peak_position),
    }))
    .filter((entry) => entry.rank !== null && dayjs(entry.date).isValid())
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
}

export function getTimelineBaseDate(work: Work, platform: Platform): string | undefined {
  if (platform === "billboard") {
    return work.first_chart_date || work.release_date;
  }
  return work.release_date || work.first_chart_date;
}

export function getRelativeDay(date: string, baseDate?: string): number {
  if (!baseDate) return 1;
  return dayjs(date).startOf("day").diff(dayjs(baseDate).startOf("day"), "day") + 1;
}

export function getRelativeWeek(date: string, baseDate?: string): number {
  if (!baseDate) return 1;
  const day = getRelativeDay(date, baseDate);
  return Math.max(1, Math.ceil(day / 7));
}

export function buildLineChartData(
  entries: ChartEntry[],
  works: Work[],
  timelineMode: TimelineMode,
  platform: Platform,
  valueMode: ChartValueMode = "rank",
): LinePoint[] {
  const worksById = new Map(works.map((work) => [work.work_id, normalizeWork(work)]));
  const points = new Map<string, LinePoint>();
  const firstEntryDateByWork = new Map<string, string>();

  entries
    .filter((entry) => entry.rank !== null && dayjs(entry.date).isValid())
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
    .forEach((entry) => {
      if (!firstEntryDateByWork.has(entry.work_id)) firstEntryDateByWork.set(entry.work_id, entry.date);
    });

  entries.forEach((entry) => {
    const value = valueMode === "streams" ? entry.streams : entry.rank;
    if (value === null || value === undefined) return;

    const work = worksById.get(entry.work_id);
    if (!work) return;

    const baseDate =
      timelineMode === "relative" && platform === "spotify"
        ? firstEntryDateByWork.get(entry.work_id) || getTimelineBaseDate(work, platform)
        : getTimelineBaseDate(work, platform);
    const relativeValue =
      platform === "billboard" ? getRelativeWeek(entry.date, baseDate) : getRelativeDay(entry.date, baseDate);
    const relativeLabel = platform === "billboard" ? `Week ${relativeValue}` : `Day ${relativeValue}`;
    const x = timelineMode === "absolute" ? entry.date : relativeLabel;
    const sortValue = timelineMode === "absolute" ? dayjs(entry.date).valueOf() : relativeValue;
    const current = points.get(x) ?? { x, sortValue };
    current[entry.work_id] = value;
    points.set(x, current);
  });

  return Array.from(points.values()).sort((a, b) => a.sortValue - b.sortValue);
}

function getXValue(
  entryDate: string,
  work: Work,
  timelineMode: TimelineMode,
  platform: Platform,
  firstLocalEntryDate?: string,
): string {
  if (timelineMode === "absolute") return entryDate;
  const baseDate =
    timelineMode === "relative" && platform === "spotify"
      ? firstLocalEntryDate || getTimelineBaseDate(work, platform)
      : getTimelineBaseDate(work, platform);
  const relativeValue = platform === "billboard" ? getRelativeWeek(entryDate, baseDate) : getRelativeDay(entryDate, baseDate);
  return platform === "billboard" ? `Week ${relativeValue}` : `Day ${relativeValue}`;
}

export function buildChartMarkers(
  entries: ChartEntry[],
  works: Work[],
  timelineMode: TimelineMode,
  platform: Platform,
  latestChartDate?: string | null,
  chartDates: string[] = [],
): ChartMarker[] {
  const workMap = new Map(works.map((work) => [work.work_id, normalizeWork(work)]));
  const grouped = new Map<string, ChartEntry[]>();
  const yMax = platform === "spotify" ? 200 : 100;
  const sortedChartDates = chartDates
    .filter((date) => dayjs(date).isValid())
    .sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());
  const chartDateIndex = new Map(sortedChartDates.map((date, index) => [date, index]));

  entries.forEach((entry) => {
    if (!grouped.has(entry.work_id)) grouped.set(entry.work_id, []);
    grouped.get(entry.work_id)?.push(entry);
  });

  const markers: ChartMarker[] = [];
  grouped.forEach((rows, workId) => {
    const work = workMap.get(workId);
    if (!work) return;

    const sorted = rows
      .filter((row) => row.rank !== null)
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    const firstLocalEntryDate = sorted[0]?.date;

    sorted.forEach((row, index) => {
      if (index === 0) return;
      const previous = sorted[index - 1];
      const previousChartIndex = chartDateIndex.get(previous.date);
      const currentChartIndex = chartDateIndex.get(row.date);
      const hasGap =
        previousChartIndex !== undefined && currentChartIndex !== undefined && currentChartIndex > previousChartIndex + 1;

      if (hasGap) {
        markers.push({
          work_id: workId,
          type: "re",
          x: getXValue(row.date, work, timelineMode, platform, firstLocalEntryDate),
          y: row.rank ?? yMax,
          label: "Re",
        });
      }
    });

    sorted.forEach((row, index) => {
      const rowChartIndex = chartDateIndex.get(row.date);
      const nextEntry = sorted[index + 1];
      const nextEntryChartIndex = nextEntry ? chartDateIndex.get(nextEntry.date) : undefined;
      const nextChartDate =
        rowChartIndex !== undefined && rowChartIndex + 1 < sortedChartDates.length ? sortedChartDates[rowChartIndex + 1] : null;
      const hasOutGap =
        nextChartDate &&
        ((nextEntryChartIndex !== undefined && nextEntryChartIndex > rowChartIndex! + 1) ||
          (!nextEntry && row.date !== latestChartDate));

      if (hasOutGap) {
        markers.push({
          work_id: workId,
          type: "out",
          x: getXValue(nextChartDate, work, timelineMode, platform, firstLocalEntryDate),
          y: yMax,
          label: "Out",
        });
      }
    });

    const latest = sorted[sorted.length - 1];
    if (sortedChartDates.length === 0 && latest && latest.date !== latestChartDate) {
      markers.push({
        work_id: workId,
        type: "out",
        x: getXValue(latest.date, work, timelineMode, platform, firstLocalEntryDate),
        y: yMax,
        label: "Out",
      });
    }
  });

  return markers;
}

export function getLatestChartDate(entries: ChartEntry[], platform: Platform, region: string): string | null {
  const dates = entries
    .filter((entry) => entry.platform === platform && entry.region.toLowerCase() === region.toLowerCase())
    .map((entry) => entry.date)
    .filter((date) => dayjs(date).isValid())
    .sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());
  return dates[dates.length - 1] ?? null;
}

function expectedDateCount(firstDate: string, latestDate: string, platform: Platform): number {
  const unit = platform === "billboard" ? "week" : "day";
  return dayjs(latestDate).diff(dayjs(firstDate), unit) + 1;
}

export function calculateDatasetCoverage(
  entries: ChartEntry[],
  platform: Platform,
  region: string,
): DatasetCoverage {
  const dates = Array.from(
    new Set(
      entries
        .filter((entry) => entry.platform === platform && entry.region.toLowerCase() === region.toLowerCase())
        .map((entry) => entry.date)
        .filter((date) => dayjs(date).isValid()),
    ),
  ).sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf());

  const firstDate = dates[0] ?? null;
  const latestDate = dates[dates.length - 1] ?? null;
  const gaps: CoverageGap[] = [];
  const unit = platform === "billboard" ? "week" : "day";

  dates.forEach((date, index) => {
    if (index === 0) return;
    const previous = dates[index - 1];
    const diff = dayjs(date).diff(dayjs(previous), unit);
    if (diff > 1) {
      const start = dayjs(previous).add(1, unit).format("YYYY-MM-DD");
      const end = dayjs(date).subtract(1, unit).format("YYYY-MM-DD");
      gaps.push({ start, end, days: diff - 1 });
    }
  });

  const expectedChartDates = firstDate && latestDate ? expectedDateCount(firstDate, latestDate, platform) : 0;
  return {
    platform,
    region,
    firstDate,
    latestDate,
    totalChartDates: dates.length,
    expectedChartDates,
    missingChartDates: Math.max(0, expectedChartDates - dates.length),
    gaps,
  };
}

export function calculateWorkCoverage(
  entries: ChartEntry[],
  works: Work[],
  selectedWorkIds: string[],
  platform: Platform,
  region: string,
): WorkCoverage[] {
  const worksById = new Map(works.map((work) => [work.work_id, normalizeWork(work)]));
  const selected = new Set(selectedWorkIds);
  const grouped = new Map<string, ChartEntry[]>();

  entries.forEach((entry) => {
    if (
      selected.has(entry.work_id) &&
      entry.platform === platform &&
      entry.region.toLowerCase() === region.toLowerCase() &&
      dayjs(entry.date).isValid()
    ) {
      if (!grouped.has(entry.work_id)) grouped.set(entry.work_id, []);
      grouped.get(entry.work_id)?.push(entry);
    }
  });

  return selectedWorkIds.map((workId) => {
    const work = worksById.get(workId);
    const rows = (grouped.get(workId) ?? []).sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    const firstEntryDate = rows[0]?.date ?? null;
    const latestEntryDate = rows[rows.length - 1]?.date ?? null;
    const releaseDate = work?.release_date || work?.first_chart_date;
    const missingBeforeFirstEntry =
      releaseDate && firstEntryDate && dayjs(firstEntryDate).isAfter(dayjs(releaseDate))
        ? dayjs(firstEntryDate).diff(dayjs(releaseDate), platform === "billboard" ? "week" : "day")
        : null;

    return {
      work_id: workId,
      title: work?.title ?? workId,
      artist: work?.artist ?? "",
      releaseDate,
      firstEntryDate,
      latestEntryDate,
      totalEntries: rows.length,
      coverageStartsAfterRelease: Boolean(missingBeforeFirstEntry && missingBeforeFirstEntry > 0),
      missingBeforeFirstEntry,
    };
  });
}

export function calculateMetrics(entries: ChartEntry[], works: Work[], latestChartDate?: string | null): ChartMetric[] {
  const workMap = new Map(works.map((work) => [work.work_id, normalizeWork(work)]));
  const grouped = new Map<string, ChartEntry[]>();

  entries.forEach((entry) => {
    if (!grouped.has(entry.work_id)) grouped.set(entry.work_id, []);
    grouped.get(entry.work_id)?.push(entry);
  });

  return Array.from(grouped.entries())
    .map(([workId, rows]) => {
      const sorted = rows
        .filter((row) => row.rank !== null)
        .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
      const work = workMap.get(workId);
      const ranks = sorted.map((row) => row.rank).filter((rank): rank is number => rank !== null);
      const streams = sorted.map((row) => row.streams).filter((stream): stream is number => stream !== null);
      const weeksValues = sorted
        .map((row) => row.weeks_on_chart)
        .filter((weeks): weeks is number => weeks !== null);
      const rankChanges = sorted.slice(1).map((row, index) => {
        const previous = sorted[index].rank;
        return previous !== null && row.rank !== null ? row.rank - previous : null;
      });
      const rises = rankChanges.filter((change): change is number => change !== null && change < 0);
      const drops = rankChanges.filter((change): change is number => change !== null && change > 0);
      const latestDate = sorted[sorted.length - 1]?.date ?? null;
      const reEntryCount = sorted.reduce((count, row, index) => {
        const previousWeeks = sorted[index - 1]?.weeks_on_chart;
        const currentWeeks = row.weeks_on_chart;
        if (index === 0 || previousWeeks === null || previousWeeks === undefined || currentWeeks === null) return count;
        return currentWeeks <= previousWeeks ? count + 1 : count;
      }, 0);
      const status: ChartStatus =
        latestDate && latestChartDate && latestDate === latestChartDate
          ? reEntryCount > 0
            ? "Re-entry"
            : "Charting"
          : "Out";

      return {
        work_id: workId,
        title: work?.title ?? workId,
        artist: work?.artist ?? "",
        cover_url: work?.cover_url,
        spotify_url: work?.spotify_url,
        album_name: work?.album_name,
        peakRank: ranks.length ? Math.min(...ranks) : work?.peak_rank ?? null,
        debutRank: sorted[0]?.rank ?? work?.debut_rank ?? null,
        debutDate: sorted[0]?.date ?? work?.first_chart_date ?? null,
        latestRank: sorted[sorted.length - 1]?.rank ?? null,
        latestDate,
        firstChartDate: sorted[0]?.date ?? work?.first_chart_date ?? null,
        totalEntries: sorted.length || work?.total_chart_entries || 0,
        weeksOnChart: weeksValues.length ? Math.max(...weeksValues) : sorted.length || work?.best_weeks_on_chart || null,
        weeksAtNumberOne: ranks.filter((rank) => rank === 1).length || work?.weeks_at_number_one || 0,
        weeksInTop10: ranks.filter((rank) => rank <= 10).length || work?.weeks_in_top_10 || 0,
        biggestRise: rises.length ? Math.abs(Math.min(...rises)) : null,
        biggestDrop: drops.length ? Math.max(...drops) : null,
        status,
        reEntryCount,
        maxStreams: streams.length ? Math.max(...streams) : null,
        sparkline: sorted
          .filter((row): row is ChartEntry & { rank: number } => row.rank !== null)
          .map((row) => ({ date: row.date, rank: row.rank })),
      };
    })
    .sort((a, b) => (a.peakRank ?? 999) - (b.peakRank ?? 999));
}
