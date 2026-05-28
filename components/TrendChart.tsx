"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MetricBadge from "@/components/MetricBadge";
import type { ChartMarker, ChartValueMode, Platform, TimelineMode, Work } from "@/lib/types";

type TrendChartProps = {
  data: Record<string, string | number | null>[];
  works: Work[];
  selectedWorkIds: string[];
  platform: Platform;
  timelineMode: TimelineMode;
  valueMode: ChartValueMode;
  markers: ChartMarker[];
};

const COLORS = ["#8aaeb6", "#7c996b", "#dfc44f", "#d28c9c", "#5fb6a6"];
const AREA_COLORS = ["#cfe1e2", "#d8e5ce", "#fff0a6", "#f3cbd2", "#bfe5dc"];
const LINE_SHADOWS = ["#8aaeb6", "#7c996b", "#dfc44f", "#d28c9c", "#5fb6a6"];
const SPEED_OPTIONS = [0.5, 1, 2, 4];

type SegmentSeries = {
  key: string;
  work: Work;
  workIndex: number;
  showLegend: boolean;
};

type ChartPoint = Record<string, string | number | null>;

function workIdFromSeriesKey(key: unknown) {
  const value = String(key ?? "");
  const marker = "__segment_";
  const index = value.lastIndexOf(marker);
  return index === -1 ? value : value.slice(0, index);
}

function buildSegmentedChartData(
  sourceData: ChartPoint[],
  visibleWorks: Work[],
  markers: ChartMarker[],
) {
  const chartData = sourceData.map((point) => ({ ...point }));
  const markerByWorkAndX = new Map<string, ChartMarker[]>();
  const series: SegmentSeries[] = [];
  const seenSeries = new Set<string>();

  markers.forEach((marker) => {
    const key = `${marker.work_id}@@${marker.x}`;
    const list = markerByWorkAndX.get(key) ?? [];
    list.push(marker);
    markerByWorkAndX.set(key, list);
  });

  visibleWorks.forEach((work, workIndex) => {
    let segmentIndex = 0;

    chartData.forEach((point) => {
      const value = point[work.work_id];
      const segmentKey = `${work.work_id}__segment_${segmentIndex}`;

      if (typeof value === "number") {
        point[segmentKey] = value;
        if (!seenSeries.has(segmentKey)) {
          seenSeries.add(segmentKey);
          series.push({
            key: segmentKey,
            work,
            workIndex,
            showLegend: segmentIndex === 0,
          });
        }
      }

      const markerList = markerByWorkAndX.get(`${work.work_id}@@${point.x}`) ?? [];
      if (markerList.some((marker) => marker.type === "out")) {
        segmentIndex += 1;
      }
    });
  });

  return {
    chartData,
    series: series.sort((a, b) => {
      const workDelta = a.workIndex - b.workIndex;
      if (workDelta !== 0) return workDelta;
      return a.key.localeCompare(b.key);
    }),
  };
}

function numericValue(value: string | number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function markerSortValue(x: string, timelineMode: TimelineMode) {
  if (timelineMode === "absolute") return new Date(`${x}T00:00:00Z`).getTime();
  const match = x.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function interpolatePlaybackData(
  sourceData: ChartPoint[],
  visibleWorks: Work[],
  progressIndex: number,
) {
  if (sourceData.length === 0) return sourceData;

  const activeIndex = Math.min(Math.max(progressIndex, 0), Math.max(0, sourceData.length - 1));
  const wholeIndex = Math.floor(activeIndex);
  const fraction = activeIndex - wholeIndex;
  const result: ChartPoint[] = [];

  sourceData.forEach((point, index) => {
    if (index <= wholeIndex) {
      result.push(point);
      return;
    }

    const hiddenPoint = { ...point };
    visibleWorks.forEach((work) => {
      hiddenPoint[work.work_id] = null;
    });
    result.push(hiddenPoint);
  });

  const current = sourceData[wholeIndex];
  const next = sourceData[wholeIndex + 1];
  const currentX = numericValue(current?.sortValue);
  const nextX = numericValue(next?.sortValue);

  if (!current || !next || currentX === null || nextX === null || fraction <= 0) {
    return result;
  }

  const partialPoint: ChartPoint = {
    x: `${current.x}`,
    sortValue: currentX + (nextX - currentX) * fraction,
  };
  let hasValue = false;

  visibleWorks.forEach((work) => {
    const start = numericValue(current[work.work_id]);
    const end = numericValue(next[work.work_id]);
    if (start === null || end === null) {
      partialPoint[work.work_id] = null;
      return;
    }

    partialPoint[work.work_id] = start + (end - start) * fraction;
    hasValue = true;
  });

  if (hasValue) {
    result.splice(wholeIndex + 1, 0, partialPoint);
  }

  return result.sort((a, b) => Number(a.sortValue ?? 0) - Number(b.sortValue ?? 0));
}

export default function TrendChart({
  data,
  works,
  selectedWorkIds,
  platform,
  timelineMode,
  valueMode,
  markers,
}: TrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const selectedWorks = works.filter((work) => selectedWorkIds.includes(work.work_id));
  const visibleWorks = selectedWorks.filter((work) => data.some((point) => typeof point[work.work_id] === "number"));
  const yMax = platform === "spotify" ? 200 : 100;
  const isRankMode = valueMode === "rank";
  const maxPlaybackIndex = Math.max(0, data.length - 1);
  const reCount = markers.filter((marker) => marker.type === "re").length;
  const outCount = markers.filter((marker) => marker.type === "out").length;
  const colorByWorkId = useMemo(
    () => new Map(visibleWorks.map((work, index) => [work.work_id, COLORS[index % COLORS.length]])),
    [visibleWorks],
  );
  const markerIndexByX = useMemo(() => new Map(data.map((point, index) => [String(point.x), index])), [data]);
  const playbackData = useMemo(
    () => {
      if (!isPlaybackActive) return data;
      return interpolatePlaybackData(data, visibleWorks, playbackIndex);
    },
    [data, isPlaybackActive, playbackIndex, visibleWorks],
  );
  const playbackMarkers = useMemo(
    () =>
      isPlaybackActive
        ? markers.filter((marker) => {
            const index = markerIndexByX.get(marker.x);
            return index !== undefined && index <= Math.floor(playbackIndex);
          })
        : markers,
    [isPlaybackActive, markerIndexByX, markers, playbackIndex],
  );
  const { chartData: renderedData, series: segmentSeries } = useMemo(
    () => buildSegmentedChartData(playbackData, visibleWorks, playbackMarkers),
    [playbackData, playbackMarkers, visibleWorks],
  );
  const playbackProgress = isPlaybackActive ? `${Math.min(Math.floor(playbackIndex) + 1, data.length)}/${data.length}` : "完整";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsPlaybackActive(false);
    setIsPlaying(false);
    setPlaybackIndex(0);
  }, [data]);

  useEffect(() => {
    if (!isPlaying || !isPlaybackActive || data.length <= 1) return;
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => Math.min(current + 0.08 * playbackSpeed, maxPlaybackIndex));
    }, 32);

    return () => window.clearInterval(timer);
  }, [data.length, isPlaybackActive, isPlaying, maxPlaybackIndex, playbackSpeed]);

  useEffect(() => {
    if (isPlaying && playbackIndex >= maxPlaybackIndex) {
      setIsPlaying(false);
    }
  }, [isPlaying, maxPlaybackIndex, playbackIndex]);

  const play = () => {
    if (data.length === 0) return;
    if (!isPlaybackActive || playbackIndex >= maxPlaybackIndex) {
      setPlaybackIndex(0);
    }
    setIsPlaybackActive(true);
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const resetPlayback = () => {
    setIsPlaybackActive(true);
    setIsPlaying(false);
    setPlaybackIndex(0);
  };

  const showFullChart = () => {
    setIsPlaybackActive(false);
    setIsPlaying(false);
    setPlaybackIndex(0);
  };

  const formatXTick = (value: string | number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return `${value}`;
    if (timelineMode === "absolute") {
      return new Date(numeric).toISOString().slice(0, 10);
    }
    return platform === "billboard" ? `Week ${Math.round(numeric)}` : `Day ${Math.round(numeric)}`;
  };

  const renderChart = (isExpanded: boolean) => (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Trajectory</p>
          <h2 className="mt-1 text-2xl font-black text-white">Ranking Movement</h2>
          <p className="mt-1 text-sm leading-6 text-[#8fa399]">
            {valueMode === "streams"
              ? "播放量视图使用本地 Spotify CSV 的 streams 字段；Out/Re 标记只在排名视图展示。"
              : timelineMode === "relative" && platform === "billboard"
              ? "Billboard 相对时间基于首次上榜周。"
              : timelineMode === "relative" && platform === "spotify"
                ? "Spotify 相对时间按本地数据中每首歌的首次入榜日对齐。"
              : "#1 在最上方；缺失日期会断线，不会被补成 0。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricBadge tone="green">{platform === "billboard" ? "Hot 100" : "Top 200"}</MetricBadge>
          <MetricBadge tone={valueMode === "streams" ? "blue" : "green"}>
            {valueMode === "streams" ? "Streams" : "Rank"}
          </MetricBadge>
          {isRankMode ? (
            <>
              <MetricBadge tone="blue">Re {reCount}</MetricBadge>
              <MetricBadge tone="red">Out {outCount}</MetricBadge>
            </>
          ) : null}
          {selectedWorks.length !== visibleWorks.length ? (
            <MetricBadge tone="gold">{selectedWorks.length - visibleWorks.length} no local data</MetricBadge>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#d6e7dc] transition hover:border-[#1ed760]/40 hover:bg-[#1ed760]/10 hover:text-white"
          >
            {isExpanded ? "关闭全屏" : "放大查看"}
          </button>
        </div>
      </div>

      {isRankMode ? (
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-[#8fa399]">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-white bg-[#8aa7ff]" />
          Re 表示断档后重新回榜。
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-black bg-[#fb7185]" />
          Out 表示该榜周首次缺席。
        </span>
      </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={isPlaying ? pause : play}
            disabled={data.length === 0 || visibleWorks.length === 0}
            className="rounded-full border border-[#1ed760]/35 bg-[#1ed760]/12 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#9fffc0] transition hover:bg-[#1ed760]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying ? "暂停" : "播放"}
          </button>
          <button
            type="button"
            onClick={resetPlayback}
            disabled={data.length === 0 || visibleWorks.length === 0}
            className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#d6e7dc] transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            重置
          </button>
          <button
            type="button"
            onClick={showFullChart}
            disabled={!isPlaybackActive}
            className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#d6e7dc] transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            完整
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8fa399]">
            速度
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              className="rounded-full border border-white/10 bg-[#050806] px-2.5 py-1 text-xs font-black text-[#f4fff7] outline-none transition focus:border-[#1ed760]/60"
              style={{ colorScheme: "dark" }}
            >
              {SPEED_OPTIONS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#6f8178]">{playbackProgress}</span>
        </div>
      </div>

      <div
        className={`${isExpanded ? "h-[calc(100vh-190px)] min-h-[560px]" : "h-[820px] min-h-[820px]"} relative w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#050806] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),transparent_21%),repeating-linear-gradient(0deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_24px)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1ed760]/65 to-transparent" />
        {!mounted ? (
          <div className="h-full rounded-[1.2rem] border border-white/10 bg-white/[0.03]" />
        ) : data.length === 0 || visibleWorks.length === 0 ? (
          <div className="relative z-20 flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 text-center text-sm text-[#8fa399]">
            还没有可展示的榜单数据。请先搜索并加入歌曲，或切换平台/地区。
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={320}>
            <ComposedChart data={renderedData} margin={{ top: 40, right: 42, left: 20, bottom: 30 }}>
              <defs>
                {visibleWorks.map((work, index) => {
                  const shadow = LINE_SHADOWS[index % LINE_SHADOWS.length];
                  return (
                    <filter key={`${work.work_id}-glow`} id={`line-glow-${index}`} x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor={shadow} floodOpacity="0.2" />
                    </filter>
                  );
                })}
                {visibleWorks.map((work, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <linearGradient key={`${work.work_id}-gradient`} id={`line-gradient-${index}`} x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity="0.78" />
                      <stop offset="48%" stopColor={color} stopOpacity="1" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.86" />
                    </linearGradient>
                  );
                })}
                {visibleWorks.map((work, index) => {
                  const color = AREA_COLORS[index % AREA_COLORS.length];
                  return (
                    <linearGradient key={`${work.work_id}-area`} id={`area-gradient-${index}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.52" />
                      <stop offset="58%" stopColor={color} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="2 12" vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="sortValue"
                type="number"
                domain={["dataMin", "dataMax"]}
                axisLine={{ stroke: "rgba(214,231,220,0.35)" }}
                tickLine={false}
                tick={{ fill: "#7f9188", fontSize: 12, fontWeight: 700 }}
                tickFormatter={formatXTick}
                height={56}
                label={{
                  value: "time",
                  position: "insideBottom",
                  offset: -2,
                  fill: "#8fa399",
                  fontFamily: "Georgia, serif",
                  fontSize: 18,
                  fontWeight: 700,
                }}
                minTickGap={24}
              />
              <YAxis
                type="number"
                reversed={isRankMode}
                allowDecimals={false}
                domain={isRankMode ? [1, yMax] : [0, "auto"]}
                ticks={isRankMode ? (platform === "spotify" ? [1, 10, 50, 100, 200] : [1, 10, 50, 100]) : undefined}
                tickFormatter={(value) =>
                  isRankMode ? `#${value}` : new Intl.NumberFormat("en", { notation: "compact" }).format(Number(value))
                }
                axisLine={{ stroke: "rgba(214,231,220,0.35)" }}
                tickLine={false}
                tick={{ fill: "#8fa399", fontSize: 12, fontWeight: 800 }}
                label={{
                  value: valueMode === "streams" ? "stream value" : "rank value",
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  fill: "#8fa399",
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                  fontWeight: 700,
                }}
                width={isRankMode ? 72 : 86}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,8,6,0.94)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 14,
                  color: "#f4fff7",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.08)",
                  backdropFilter: "blur(18px)",
                }}
                labelStyle={{ color: "#d6e7dc", marginBottom: 8 }}
                formatter={(value, name) => {
                  const workId = workIdFromSeriesKey(name);
                  const work = works.find((item) => item.work_id === workId);
                  const formatted =
                    valueMode === "rank"
                      ? `#${value}`
                      : new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(value));
                  return [formatted, work?.title ?? workId];
                }}
                labelFormatter={(label) => formatXTick(label)}
              />
              <Legend
                iconType="rect"
                wrapperStyle={{ color: "#d6e7dc", paddingTop: 16, fontFamily: "Georgia, serif", fontWeight: 600 }}
                formatter={(value) => {
                  const workId = workIdFromSeriesKey(value);
                  const work = works.find((item) => item.work_id === workId);
                  return work?.title ?? workId;
                }}
              />
              {segmentSeries.map((series) => (
                <Area
                  key={`${series.key}-area`}
                  type="monotone"
                  dataKey={series.key}
                  fill={`url(#area-gradient-${series.workIndex})`}
                  stroke="none"
                  baseValue={isRankMode ? yMax : 0}
                  legendType="none"
                  dot={false}
                  activeDot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {segmentSeries.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.key}
                  legendType={series.showLegend ? "plainline" : "none"}
                  stroke={`url(#line-gradient-${series.workIndex})`}
                  strokeWidth={3.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#line-glow-${series.workIndex})`}
                  dot={false}
                  activeDot={{
                    r: 5.8,
                    stroke: "#050806",
                    strokeWidth: 2.5,
                    fill: COLORS[series.workIndex % COLORS.length],
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {isRankMode ? playbackMarkers.map((marker, index) => (
                <ReferenceDot
                  key={`${marker.work_id}-${marker.type}-${marker.x}-${index}`}
                  x={Number(markerSortValue(marker.x, timelineMode))}
                  y={marker.y}
                  r={marker.type === "re" ? 6.5 : 7.5}
                  fill={colorByWorkId.get(marker.work_id) ?? "#a1a1aa"}
                  stroke={marker.type === "re" ? "#f4fff7" : "#050806"}
                  strokeWidth={marker.type === "re" ? 2.5 : 3.25}
                  label={{
                    value: marker.label,
                    position: "top",
                    fill: colorByWorkId.get(marker.work_id) ?? "#d4d8d4",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                />
              )) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );

  return (
    <>
      <section className="stage-panel rounded-[1.7rem] p-5">
        {expanded ? null : renderChart(false)}
      </section>

      {expanded ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#090909]/95 p-4 backdrop-blur-xl sm:p-6">
          <section className="stage-panel mx-auto min-h-[calc(100vh-48px)] max-w-[1800px] rounded-[1.7rem] p-5">
            {renderChart(true)}
          </section>
        </div>
      ) : null}
    </>
  );
}
