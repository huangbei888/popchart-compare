"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const COLORS = ["#8aaeb6", "#7c996b", "#dfc44f", "#d28c9c", "#5fb6a6", "#b9a6e3", "#e0a15c", "#8cc7df", "#c8d66b", "#f08a73"];
const AREA_COLORS = ["#cfe1e2", "#d8e5ce", "#fff0a6", "#f3cbd2", "#bfe5dc", "#dacdf2", "#f0c99f", "#c5e4ef", "#e2eca8", "#f7c0b3"];
const LINE_SHADOWS = ["#8aaeb6", "#7c996b", "#dfc44f", "#d28c9c", "#5fb6a6", "#b9a6e3", "#e0a15c", "#8cc7df", "#c8d66b", "#f08a73"];
const SPEED_OPTIONS = [0.5, 1, 2, 4, 8, 16];

type SegmentSeries = {
  key: string;
  work: Work;
  workIndex: number;
  showLegend: boolean;
};

type ChartPoint = Record<string, string | number | null>;

type TooltipPayloadItem = {
  name?: string | number;
  value?: string | number | null;
  color?: string;
  dataKey?: string | number;
};

type DedupedTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipPayloadItem[];
  works: Work[];
  valueMode: ChartValueMode;
  labelFormatter: (value: string | number) => string;
};

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

function formatTooltipValue(value: string | number | null | undefined, valueMode: ChartValueMode) {
  if (value === null || value === undefined) return "";
  return valueMode === "rank"
    ? `#${value}`
    : new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(value));
}

function DedupedTooltip({ active, label, payload, works, valueMode, labelFormatter }: DedupedTooltipProps) {
  if (!active || !payload?.length) return null;

  const rows = new Map<string, TooltipPayloadItem>();
  payload.forEach((item) => {
    if (item.value === null || item.value === undefined) return;
    const workId = workIdFromSeriesKey(item.name ?? item.dataKey);
    if (!rows.has(workId)) rows.set(workId, item);
  });

  if (rows.size === 0) return null;

  return (
    <div className="rounded-[14px] border border-white/15 bg-[#050806]/95 px-4 py-3 text-[#f4fff7] shadow-[0_24px_80px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-2 text-lg font-black leading-6 text-[#d6e7dc]">{labelFormatter(label ?? "")}</div>
      <div className="grid gap-1 text-base font-black leading-6">
        {Array.from(rows.entries()).map(([workId, item]) => {
          const work = works.find((candidate) => candidate.work_id === workId);
          return (
            <div key={workId} className="flex items-baseline gap-2 whitespace-nowrap">
              <span>{work?.title ?? workId}</span>
              <span className="text-[#8fa399]">:</span>
              <span>{formatTooltipValue(item.value, valueMode)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const [isExporting, setIsExporting] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
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

  const exportPng = async () => {
    const container = chartContainerRef.current;
    if (!container || data.length === 0 || visibleWorks.length === 0 || isExporting) return;

    setIsExporting(true);
    try {
      const { width, height } = container.getBoundingClientRect();
      const exportWidth = Math.max(1, Math.round(width));
      const exportHeight = Math.max(1, Math.round(height));
      const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(exportWidth * scale);
      canvas.height = Math.round(exportHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available.");

      const cssWidth = canvas.width / scale;
      const cssHeight = canvas.height / scale;
      const yAxisWidth = isRankMode ? 72 : 86;
      const plot = {
        left: 20 + yAxisWidth,
        right: cssWidth - 42,
        top: 40,
        bottom: cssHeight - 92,
      };
      const plotWidth = Math.max(1, plot.right - plot.left);
      const plotHeight = Math.max(1, plot.bottom - plot.top);
      const sortValues = renderedData
        .map((point) => numericValue(point.sortValue))
        .filter((value): value is number => value !== null);
      const xMin = Math.min(...sortValues);
      const xMax = Math.max(...sortValues);
      const xSpan = Math.max(1, xMax - xMin);
      const streamMax = Math.max(
        1,
        ...segmentSeries.flatMap((series) =>
          renderedData.map((point) => numericValue(point[series.key]) ?? 0),
        ),
      );
      const streamMagnitude = 10 ** Math.floor(Math.log10(streamMax));
      const streamDomainMax = Math.ceil(streamMax / streamMagnitude) * streamMagnitude;
      const yDomainMax = isRankMode ? yMax : streamDomainMax;
      const yDomainMin = isRankMode ? 1 : 0;
      const ySpan = Math.max(1, yDomainMax - yDomainMin);
      const xToCanvas = (value: number) => plot.left + ((value - xMin) / xSpan) * plotWidth;
      const yToCanvas = (value: number) =>
        isRankMode
          ? plot.top + ((value - yDomainMin) / ySpan) * plotHeight
          : plot.bottom - ((value - yDomainMin) / ySpan) * plotHeight;

      context.scale(scale, scale);
      context.fillStyle = "#050806";
      context.fillRect(0, 0, cssWidth, cssHeight);

      const bgGradient = context.createLinearGradient(0, 0, 0, cssHeight);
      bgGradient.addColorStop(0, "rgba(255,255,255,0.055)");
      bgGradient.addColorStop(0.21, "rgba(255,255,255,0)");
      context.fillStyle = bgGradient;
      context.fillRect(0, 0, cssWidth, cssHeight);

      context.save();
      context.strokeStyle = "rgba(255,255,255,0.025)";
      context.lineWidth = 1;
      for (let y = 0; y <= cssHeight; y += 24) {
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(cssWidth, y + 0.5);
        context.stroke();
      }
      context.restore();

      const yTicks = isRankMode
        ? platform === "spotify"
          ? [1, 10, 50, 100, 200]
          : [1, 10, 50, 100]
        : Array.from({ length: 5 }, (_, index) => (streamDomainMax / 4) * index);
      context.save();
      context.strokeStyle = "rgba(255,255,255,0.08)";
      context.setLineDash([2, 12]);
      yTicks.forEach((tick) => {
        const y = yToCanvas(tick);
        context.beginPath();
        context.moveTo(plot.left, y);
        context.lineTo(plot.right, y);
        context.stroke();
      });
      context.restore();

      context.save();
      context.strokeStyle = "rgba(214,231,220,0.35)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(plot.left, plot.top);
      context.lineTo(plot.left, plot.bottom);
      context.lineTo(plot.right, plot.bottom);
      context.stroke();
      context.restore();

      context.save();
      context.fillStyle = "#8fa399";
      context.font = "800 12px Arial, sans-serif";
      context.textBaseline = "middle";
      context.textAlign = "right";
      yTicks.forEach((tick) => {
        const label = isRankMode
          ? `#${tick}`
          : new Intl.NumberFormat("en", { notation: "compact" }).format(Number(tick));
        context.fillText(label, plot.left - 10, yToCanvas(tick));
      });

      const xTickSource = renderedData.filter((point) => numericValue(point.sortValue) !== null);
      const xTickCount = Math.min(7, xTickSource.length);
      const xTicks = Array.from({ length: xTickCount }, (_, index) => {
        const sourceIndex = xTickCount === 1 ? 0 : Math.round((index * (xTickSource.length - 1)) / (xTickCount - 1));
        return xTickSource[sourceIndex];
      });
      context.textAlign = "center";
      context.textBaseline = "top";
      xTicks.forEach((point) => {
        const value = numericValue(point.sortValue);
        if (value === null) return;
        context.fillText(formatXTick(value), xToCanvas(value), plot.bottom + 12);
      });

      context.font = "700 18px Georgia, serif";
      context.fillText("time", (plot.left + plot.right) / 2, cssHeight - 36);
      context.save();
      context.translate(34, (plot.top + plot.bottom) / 2);
      context.rotate(-Math.PI / 2);
      context.font = "700 14px Georgia, serif";
      context.fillText(valueMode === "streams" ? "stream value" : "rank value", 0, 0);
      context.restore();
      context.restore();

      segmentSeries.forEach((series) => {
        const points = renderedData
          .map((point) => {
            const x = numericValue(point.sortValue);
            const y = numericValue(point[series.key]);
            return x !== null && y !== null ? { x: xToCanvas(x), y: yToCanvas(y) } : null;
          })
          .filter((point): point is { x: number; y: number } => point !== null);
        if (points.length < 2) return;

        const color = COLORS[series.workIndex % COLORS.length];
        const areaColor = AREA_COLORS[series.workIndex % AREA_COLORS.length];
        const baseline = yToCanvas(isRankMode ? yMax : 0);

        context.save();
        context.beginPath();
        context.moveTo(points[0].x, baseline);
        points.forEach((point) => context.lineTo(point.x, point.y));
        context.lineTo(points[points.length - 1].x, baseline);
        context.closePath();
        const areaGradient = context.createLinearGradient(0, plot.top, 0, plot.bottom);
        areaGradient.addColorStop(0, `${areaColor}85`);
        areaGradient.addColorStop(0.58, `${areaColor}38`);
        areaGradient.addColorStop(1, `${areaColor}05`);
        context.fillStyle = areaGradient;
        context.fill();
        context.restore();

        context.save();
        context.shadowColor = `${LINE_SHADOWS[series.workIndex % LINE_SHADOWS.length]}66`;
        context.shadowBlur = 7;
        context.shadowOffsetY = 2;
        context.strokeStyle = color;
        context.lineWidth = 3.1;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        points.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();
        context.restore();
      });

      if (isRankMode) {
        playbackMarkers.forEach((marker) => {
          const x = xToCanvas(markerSortValue(marker.x, timelineMode));
          const y = yToCanvas(marker.y);
          const color = colorByWorkId.get(marker.work_id) ?? "#a1a1aa";
          context.save();
          context.fillStyle = color;
          context.strokeStyle = marker.type === "re" ? "#f4fff7" : "#050806";
          context.lineWidth = marker.type === "re" ? 2.5 : 3.25;
          context.beginPath();
          context.arc(x, y, marker.type === "re" ? 6.5 : 7.5, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.fillStyle = color;
          context.font = "800 11px Arial, sans-serif";
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillText(marker.label, x, y - 10);
          context.restore();
        });
      }

      context.save();
      context.font = "600 13px Georgia, serif";
      context.textBaseline = "middle";
      let legendX = plot.left;
      const legendY = cssHeight - 18;
      visibleWorks.forEach((work, index) => {
        const color = COLORS[index % COLORS.length];
        const title = work.title.length > 28 ? `${work.title.slice(0, 27)}...` : work.title;
        context.fillStyle = color;
        context.fillRect(legendX, legendY - 5, 18, 10);
        context.fillStyle = "#d6e7dc";
        context.fillText(title, legendX + 26, legendY);
        legendX += Math.min(260, 52 + title.length * 8);
      });
      context.restore();

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))), "image/png");
      });
      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `popchart-${platform}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    } catch (error) {
      console.error(error);
      window.alert("导出图片失败，请稍后再试。");
    } finally {
      setIsExporting(false);
    }
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
          <button
            type="button"
            onClick={exportPng}
            disabled={data.length === 0 || visibleWorks.length === 0 || isExporting}
            className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#d6e7dc] transition hover:border-[#1ed760]/40 hover:bg-[#1ed760]/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isExporting ? "导出中" : "导出 PNG"}
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

      <div className="-mx-3 overflow-x-auto pb-2 sm:mx-0">
      <div
        ref={chartContainerRef}
        className={`${isExpanded ? "h-[calc(100vh-190px)] min-h-[560px] min-w-[780px]" : "h-[620px] min-h-[620px] min-w-[760px] sm:h-[820px] sm:min-h-[820px] sm:min-w-0"} relative w-full overflow-hidden rounded-[1.1rem] border border-white/10 bg-[#050806] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-[1.35rem]`}
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
          <ResponsiveContainer width="100%" height="100%" minWidth={720} minHeight={320}>
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
                content={(props) => (
                  <DedupedTooltip
                    active={props.active}
                    label={props.label}
                    payload={props.payload as unknown as readonly TooltipPayloadItem[] | undefined}
                    works={works}
                    valueMode={valueMode}
                    labelFormatter={(value) => formatXTick(value)}
                  />
                )}
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
      </div>
    </>
  );

  return (
    <>
    <section className="stage-panel min-w-0 rounded-[1.35rem] p-4 sm:rounded-[1.7rem] sm:p-5">
        {expanded ? null : renderChart(false)}
      </section>

      {expanded ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#090909]/95 p-4 backdrop-blur-xl sm:p-6">
          <section className="stage-panel mx-auto min-h-[calc(100vh-48px)] max-w-[1800px] rounded-[1.35rem] p-4 sm:rounded-[1.7rem] sm:p-5">
            {renderChart(true)}
          </section>
        </div>
      ) : null}
    </>
  );
}
