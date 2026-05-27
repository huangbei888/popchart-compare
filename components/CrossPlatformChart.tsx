"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CoverArt from "@/components/CoverArt";
import MetricBadge from "@/components/MetricBadge";
import { getRelativeDay, getTimelineBaseDate } from "@/lib/chartUtils";
import type { ChartEntry, TimelineMode, Work } from "@/lib/types";

type CrossPlatformChartProps = {
  entries: ChartEntry[];
  selectedWorks: Work[];
  activeWorkId: string | null;
  onActiveWorkChange: (workId: string) => void;
  timelineMode: TimelineMode;
};

type SeriesConfig = {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  platform: "billboard" | "spotify";
  region: string;
};

const SERIES: SeriesConfig[] = [
  {
    key: "billboard_us",
    label: "Billboard Hot 100",
    shortLabel: "Billboard US",
    color: "#1ed760",
    platform: "billboard",
    region: "us",
  },
  {
    key: "spotify_global",
    label: "Spotify Global Top 200",
    shortLabel: "Spotify Global",
    color: "#8aa7ff",
    platform: "spotify",
    region: "global",
  },
  {
    key: "spotify_us",
    label: "Spotify US Top 200",
    shortLabel: "Spotify US",
    color: "#f8d66d",
    platform: "spotify",
    region: "us",
  },
];

const DEFAULT_SERIES_KEYS = SERIES.map((series) => series.key);

function formatX(date: string, work: Work, timelineMode: TimelineMode) {
  if (timelineMode === "absolute") {
    return { x: date, sortValue: dayjs(date).valueOf() };
  }

  const baseDate = getTimelineBaseDate(work, "spotify") || getTimelineBaseDate(work, "billboard") || date;
  const day = getRelativeDay(date, baseDate);
  return { x: `Day ${day}`, sortValue: day };
}

function buildCrossPlatformData(entries: ChartEntry[], work: Work, timelineMode: TimelineMode) {
  const points = new Map<string, Record<string, string | number | null>>();

  SERIES.forEach((series) => {
    entries
      .filter(
        (entry) =>
          entry.work_id === work.work_id &&
          entry.platform === series.platform &&
          entry.region.toLowerCase() === series.region &&
          entry.rank !== null &&
          dayjs(entry.date).isValid(),
      )
      .forEach((entry) => {
        const { x, sortValue } = formatX(entry.date, work, timelineMode);
        const point = points.get(x) ?? { x, sortValue };
        point[series.key] = entry.rank;
        points.set(x, point);
      });
  });

  return Array.from(points.values()).sort((a, b) => Number(a.sortValue ?? 0) - Number(b.sortValue ?? 0));
}

function countRows(entries: ChartEntry[], workId: string, series: SeriesConfig) {
  return entries.filter(
    (entry) =>
      entry.work_id === workId &&
      entry.platform === series.platform &&
      entry.region.toLowerCase() === series.region &&
      entry.rank !== null,
  ).length;
}

function hasSeriesData(data: Record<string, string | number | null>[], series: SeriesConfig) {
  return data.some((point) => typeof point[series.key] === "number");
}

export default function CrossPlatformChart({
  entries,
  selectedWorks,
  activeWorkId,
  onActiveWorkChange,
  timelineMode,
}: CrossPlatformChartProps) {
  const [mounted, setMounted] = useState(false);
  const [enabledSeriesKeys, setEnabledSeriesKeys] = useState<string[]>(DEFAULT_SERIES_KEYS);
  const activeWork = selectedWorks.find((work) => work.work_id === activeWorkId) ?? selectedWorks[0] ?? null;
  const data = useMemo(
    () => (activeWork ? buildCrossPlatformData(entries, activeWork, timelineMode) : []),
    [activeWork, entries, timelineMode],
  );
  const seriesCounts = useMemo(
    () =>
      new Map(
        SERIES.map((series) => [
          series.key,
          activeWork ? countRows(entries, activeWork.work_id, series) : 0,
        ]),
      ),
    [activeWork, entries],
  );
  const availableSeries = activeWork ? SERIES.filter((series) => hasSeriesData(data, series)) : [];
  const visibleSeries = availableSeries.filter((series) => enabledSeriesKeys.includes(series.key));

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSeries = (series: SeriesConfig) => {
    if ((seriesCounts.get(series.key) ?? 0) === 0) return;

    setEnabledSeriesKeys((current) => {
      if (current.includes(series.key)) {
        const activeVisibleCount = availableSeries.filter((item) => current.includes(item.key)).length;
        if (activeVisibleCount <= 1) return current;
        return current.filter((key) => key !== series.key);
      }
      return [...current, series.key];
    });
  };

  if (selectedWorks.length === 0) {
    return (
      <section className="stage-panel rounded-[1.7rem] p-5 text-sm text-[#8fa399]">
        先选择一首歌，就可以查看 Billboard vs Spotify 的同歌跨平台对比。
      </section>
    );
  }

  return (
    <section className="stage-panel rounded-[1.7rem] p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#1ed760]">Cross-Platform</p>
          <h2 className="mt-2 text-2xl font-black text-white">同歌跨平台对比</h2>
          <p className="mt-1 text-sm leading-6 text-[#8fa399]">
            选择一首歌，再勾选要展示的榜单线：Billboard US、Spotify Global 或 Spotify US。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleSeries.map((series) => (
            <MetricBadge key={series.key} tone="green">
              {series.shortLabel}: {(seriesCounts.get(series.key) ?? 0).toLocaleString()}
            </MetricBadge>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-3">
          {selectedWorks.map((work) => (
            <button
              key={work.work_id}
              type="button"
              onClick={() => onActiveWorkChange(work.work_id)}
              className={`flex min-w-[220px] items-center gap-3 rounded-[1.2rem] border p-2 text-left transition ${
                activeWork?.work_id === work.work_id
                  ? "border-[#1ed760]/50 bg-[#1ed760]/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <CoverArt work={work} size="sm" linked={false} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{work.title}</span>
                <span className="block truncate text-xs text-[#8fa399]">{work.artist}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-white/10 bg-black/20 p-2">
          {SERIES.map((series) => {
            const enabled = enabledSeriesKeys.includes(series.key);
            const count = seriesCounts.get(series.key) ?? 0;
            const disabled = count === 0;

            return (
              <button
                key={series.key}
                type="button"
                onClick={() => toggleSeries(series)}
                disabled={disabled}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition ${
                  enabled && !disabled
                    ? "border-white/15 bg-white/[0.08] text-white"
                    : disabled
                      ? "cursor-not-allowed border-white/5 bg-white/[0.025] text-[#4d5c53]"
                      : "border-white/10 bg-transparent text-[#8fa399] hover:text-white"
                }`}
                title={disabled ? "这首歌当前没有该平台本地数据" : `切换 ${series.shortLabel}`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: disabled ? "#4d5c53" : series.color }}
                />
                {series.shortLabel}
                <span className="text-[#6f8178]">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[520px] min-h-[520px] w-full">
        {!mounted ? (
          <div className="h-full rounded-[1.2rem] border border-white/10 bg-white/[0.03]" />
        ) : !activeWork || data.length === 0 || availableSeries.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 text-center text-sm text-[#8fa399]">
            这首歌当前没有可用于跨平台对比的本地数据。换一首歌，或补齐 Spotify CSV 后再试。
          </div>
        ) : visibleSeries.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 text-center text-sm text-[#8fa399]">
            至少保留一条平台线，才能绘制跨平台走势。
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={320}>
            <LineChart data={data} margin={{ top: 18, right: 34, left: 18, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.075)" />
              <XAxis dataKey="x" tick={{ fill: "#8fa399", fontSize: 12 }} minTickGap={22} />
              <YAxis
                type="number"
                reversed
                allowDecimals={false}
                domain={[1, 200]}
                ticks={[1, 10, 50, 100, 200]}
                tickFormatter={(value) => `#${value}`}
                tick={{ fill: "#8fa399", fontSize: 12 }}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "#0b100d",
                  border: "1px solid rgba(30,215,96,0.22)",
                  borderRadius: 16,
                  color: "#f4fff7",
                  boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                }}
                labelStyle={{ color: "#d6e7dc", marginBottom: 8 }}
                formatter={(value, name) => {
                  const series = SERIES.find((item) => item.key === name);
                  return [`#${value}`, series?.label ?? name];
                }}
              />
              <Legend
                wrapperStyle={{ color: "#d6e7dc", paddingTop: 12 }}
                formatter={(value) => SERIES.find((item) => item.key === value)?.label ?? value}
              />
              {visibleSeries.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.key}
                  stroke={series.color}
                  strokeWidth={3.25}
                  dot={{ r: 3, strokeWidth: 1, fill: series.color }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
