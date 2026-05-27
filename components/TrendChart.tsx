"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const COLORS = ["#1ed760", "#f8d66d", "#65a8ff", "#ff6b8a", "#39e6c2"];
const LINE_SHADOWS = ["#1ed760", "#f8d66d", "#65a8ff", "#ff6b8a", "#39e6c2"];

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
  const selectedWorks = works.filter((work) => selectedWorkIds.includes(work.work_id));
  const visibleWorks = selectedWorks.filter((work) => data.some((point) => typeof point[work.work_id] === "number"));
  const yMax = platform === "spotify" ? 200 : 100;
  const isRankMode = valueMode === "rank";
  const reCount = markers.filter((marker) => marker.type === "re").length;
  const outCount = markers.filter((marker) => marker.type === "out").length;
  const colorByWorkId = useMemo(
    () => new Map(visibleWorks.map((work, index) => [work.work_id, COLORS[index % COLORS.length]])),
    [visibleWorks],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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

      <div
        className={`${isExpanded ? "h-[calc(100vh-190px)] min-h-[560px]" : "h-[820px] min-h-[820px]"} relative w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#050806] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_8%,rgba(30,215,96,0.16),transparent_28%),radial-gradient(circle_at_78%_0%,rgba(101,168,255,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1ed760]/70 to-transparent" />
        {!mounted ? (
          <div className="h-full rounded-[1.2rem] border border-white/10 bg-white/[0.03]" />
        ) : data.length === 0 || visibleWorks.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[1.2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 text-center text-sm text-[#8fa399]">
            还没有可展示的榜单数据。请先搜索并加入歌曲，或切换平台/地区。
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={320} minHeight={320}>
            <LineChart data={data} margin={{ top: 28, right: 42, left: 18, bottom: 24 }}>
              <defs>
                {visibleWorks.map((work, index) => {
                  const shadow = LINE_SHADOWS[index % LINE_SHADOWS.length];
                  return (
                    <filter key={`${work.work_id}-glow`} id={`line-glow-${index}`} x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="0" stdDeviation="2.6" floodColor={shadow} floodOpacity="0.32" />
                    </filter>
                  );
                })}
                {visibleWorks.map((work, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <linearGradient key={`${work.work_id}-gradient`} id={`line-gradient-${index}`} x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor={color} stopOpacity="0.78" />
                      <stop offset="48%" stopColor={color} stopOpacity="1" />
                      <stop offset="100%" stopColor="#f4fff7" stopOpacity="0.92" />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="1 10" vertical={false} stroke="rgba(255,255,255,0.09)" />
              <XAxis
                dataKey="x"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#7f9188", fontSize: 12, fontWeight: 700 }}
                minTickGap={24}
                padding={{ left: 8, right: 8 }}
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
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8fa399", fontSize: 12, fontWeight: 800 }}
                width={isRankMode ? 64 : 78}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,8,6,0.94)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 18,
                  color: "#f4fff7",
                  boxShadow: "0 24px 80px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.08)",
                  backdropFilter: "blur(18px)",
                }}
                labelStyle={{ color: "#d6e7dc", marginBottom: 8 }}
                formatter={(value, name) => {
                  const work = works.find((item) => item.work_id === name);
                  const formatted =
                    valueMode === "rank"
                      ? `#${value}`
                      : new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(Number(value));
                  return [formatted, work?.title ?? name];
                }}
                labelFormatter={(label) => `${label}`}
              />
              <Legend
                wrapperStyle={{ color: "#d6e7dc", paddingTop: 12 }}
                formatter={(value) => {
                  const work = works.find((item) => item.work_id === value);
                  return work?.title ?? value;
                }}
              />
              {visibleWorks.map((work, index) => (
                <Line
                  key={work.work_id}
                  type="monotone"
                  dataKey={work.work_id}
                  name={work.work_id}
                  stroke={`url(#line-gradient-${index})`}
                  strokeWidth={3.85}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#line-glow-${index})`}
                  dot={false}
                  activeDot={{
                    r: 6.5,
                    stroke: "#050806",
                    strokeWidth: 3,
                    fill: COLORS[index % COLORS.length],
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {isRankMode ? markers.map((marker, index) => (
                <ReferenceDot
                  key={`${marker.work_id}-${marker.type}-${marker.x}-${index}`}
                  x={marker.x}
                  y={marker.y}
                  r={marker.type === "re" ? 6.5 : 7.5}
                  fill={colorByWorkId.get(marker.work_id) ?? "#a1a1aa"}
                  stroke={marker.type === "re" ? "#f4fff7" : "#050806"}
                  strokeWidth={marker.type === "re" ? 2.5 : 3.25}
                  label={{
                    value: marker.label,
                    position: marker.type === "re" ? "top" : "bottom",
                    fill: colorByWorkId.get(marker.work_id) ?? "#d4d8d4",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                />
              )) : null}
            </LineChart>
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
