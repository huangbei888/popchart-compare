"use client";

import { useMemo, useState } from "react";
import CoverArt from "@/components/CoverArt";
import MetricBadge from "@/components/MetricBadge";
import Sparkline from "@/components/Sparkline";
import type { ChartMetric, ChartStatus } from "@/lib/types";

type ComparisonTableProps = {
  metrics: ChartMetric[];
  selectedCount: number;
};

type SortKey =
  | "peakRank"
  | "debutRank"
  | "latestRank"
  | "totalEntries"
  | "weeksAtNumberOne"
  | "weeksInTop10"
  | "biggestRise"
  | "biggestDrop"
  | "status";

type SortDirection = "asc" | "desc";
type StatusFilter = "All" | ChartStatus;

const dash = "—";
const formatRank = (rank: number | null) => (rank === null ? dash : `#${rank}`);
const formatDate = (date: string | null) => date ?? dash;
const formatNumber = (value: number | null | undefined) => (value === null || value === undefined ? dash : value.toString());
const formatStreams = (streams: number | null) => {
  if (streams === null) return dash;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(streams);
};

const statusOrder: Record<ChartStatus, number> = {
  Charting: 0,
  "Re-entry": 1,
  Out: 2,
};

function RankBadge({ label, rank }: { label: string; rank: number | null }) {
  return (
    <MetricBadge tone={rank === 1 ? "gold" : rank && rank <= 10 ? "green" : "gray"} strong={rank === 1}>
      {label} {formatRank(rank)}
    </MetricBadge>
  );
}

function statusTone(status: ChartMetric["status"]) {
  if (status === "Charting") return "green";
  if (status === "Re-entry") return "blue";
  return "red";
}

function sortValue(metric: ChartMetric, key: SortKey): number {
  if (key === "status") return statusOrder[metric.status];
  const value = metric[key];
  if (typeof value !== "number") return Number.POSITIVE_INFINITY;
  return value;
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition ${
        active ? "bg-[#1ed760]/15 text-[#9fffc0]" : "text-[#6f8178] hover:bg-white/[0.07] hover:text-[#d6e7dc]"
      }`}
    >
      {label}
      <span className="text-[10px]">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

export default function ComparisonTable({ metrics, selectedCount }: ComparisonTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("peakRank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const missingCount = Math.max(0, selectedCount - metrics.length);

  const filteredMetrics = useMemo(() => {
    const rows = statusFilter === "All" ? metrics : metrics.filter((metric) => metric.status === statusFilter);
    return rows.slice().sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);
      const result = aValue - bValue;
      return sortDirection === "asc" ? result : -result;
    });
  }, [metrics, sortDirection, sortKey, statusFilter]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "totalEntries" || key === "weeksAtNumberOne" || key === "weeksInTop10" ? "desc" : "asc");
  };

  return (
    <section className="stage-panel overflow-hidden rounded-[1.7rem]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Comparison Table</p>
          <h2 className="mt-1 text-2xl font-black text-white">榜单表现对比表</h2>
          <p className="mt-1 text-sm leading-6 text-[#8fa399]">按峰值、续航、涨跌幅和当前状态排序筛选。</p>
        </div>
        {missingCount > 0 ? <MetricBadge tone="gold">{missingCount} 首已选歌曲暂无本地数据</MetricBadge> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {(["All", "Charting", "Out", "Re-entry"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                statusFilter === status
                  ? "border-[#1ed760]/50 bg-[#1ed760]/15 text-[#9fffc0]"
                  : "border-white/10 bg-white/[0.035] text-[#8fa399] hover:text-white"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="text-xs font-semibold text-[#6f8178]">
          Showing {filteredMetrics.length} of {metrics.length}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-[#8fa399]">
          还没有可对比数据。搜索并加入歌曲后，表格会自动生成。
        </div>
      ) : filteredMetrics.length === 0 ? (
        <div className="px-5 py-16 text-center text-sm text-[#8fa399]">当前状态筛选下没有匹配歌曲。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-wide text-[#6f8178]">
              <tr>
                <th className="w-[320px] px-5 py-4 font-black">Track</th>
                <th className="px-4 py-4 font-black">
                  <div className="flex flex-wrap gap-1">
                    <SortButton label="Peak" sortKey="peakRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                    <SortButton label="Debut" sortKey="debutRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                    <SortButton label="Latest" sortKey="latestRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                  </div>
                </th>
                <th className="px-4 py-4 font-black">
                  <div className="flex flex-wrap gap-1">
                    <SortButton label="Entries" sortKey="totalEntries" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                    <SortButton label="#1" sortKey="weeksAtNumberOne" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                    <SortButton label="Top 10" sortKey="weeksInTop10" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                  </div>
                </th>
                <th className="px-4 py-4 font-black">
                  <div className="flex flex-wrap gap-1">
                    <SortButton label="Rise" sortKey="biggestRise" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                    <SortButton label="Drop" sortKey="biggestDrop" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                  </div>
                </th>
                <th className="px-4 py-4 font-black">
                  <SortButton label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                </th>
                <th className="px-4 py-4 font-black">Sparkline</th>
                <th className="px-4 py-4 font-black">Streams</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {filteredMetrics.map((metric) => (
                <tr key={metric.work_id} className="transition hover:bg-[#1ed760]/[0.055]">
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-4">
                      <CoverArt work={metric} size="lg" linked />
                      <div className="min-w-0">
                        {metric.spotify_url ? (
                          <a
                            href={metric.spotify_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-base font-black text-white hover:text-[#9fffc0]"
                          >
                            {metric.title}
                          </a>
                        ) : (
                          <div className="truncate text-base font-black text-white">{metric.title}</div>
                        )}
                        <div className="truncate text-sm text-[#8fa399]">{metric.artist}</div>
                        <div className="truncate text-xs text-[#6f8178]">{metric.album_name ?? dash}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex flex-wrap gap-2">
                      <RankBadge label="Peak" rank={metric.peakRank} />
                      <RankBadge label="Debut" rank={metric.debutRank} />
                      <RankBadge label="Latest" rank={metric.latestRank} />
                    </div>
                    <div className="mt-2 text-xs text-[#6f8178]">
                      {formatDate(metric.firstChartDate)} → {formatDate(metric.latestDate)}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="font-black text-white">{metric.totalEntries} entries</div>
                    <div className="mt-1 text-xs text-[#8fa399]">{formatNumber(metric.weeksOnChart)} weeks on chart</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <MetricBadge tone={metric.weeksAtNumberOne > 0 ? "gold" : "gray"}>#1 × {metric.weeksAtNumberOne}</MetricBadge>
                      <MetricBadge tone={metric.weeksInTop10 > 0 ? "green" : "gray"}>Top 10 × {metric.weeksInTop10}</MetricBadge>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex flex-wrap gap-2">
                      <MetricBadge tone={metric.biggestRise ? "green" : "gray"}>Rise {formatNumber(metric.biggestRise)}</MetricBadge>
                      <MetricBadge tone={metric.biggestDrop ? "red" : "gray"}>Drop {formatNumber(metric.biggestDrop)}</MetricBadge>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex flex-wrap gap-2">
                      <MetricBadge tone={statusTone(metric.status)}>{metric.status}</MetricBadge>
                      {metric.reEntryCount > 0 ? <MetricBadge tone="blue">Re × {metric.reEntryCount}</MetricBadge> : null}
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <Sparkline data={metric.sparkline} />
                  </td>
                  <td className="px-4 py-5 font-black text-[#d6e7dc]">{formatStreams(metric.maxStreams)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
