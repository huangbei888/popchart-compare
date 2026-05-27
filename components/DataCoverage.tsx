"use client";

import MetricBadge from "@/components/MetricBadge";
import type { DatasetCoverage, Platform, WorkCoverage } from "@/lib/types";

type DataCoverageProps = {
  dataset: DatasetCoverage;
  works: WorkCoverage[];
  platform: Platform;
};

const dash = "—";

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) return dash;
  return `${start} 至 ${end}`;
}

export default function DataCoverage({ dataset, works, platform }: DataCoverageProps) {
  const unit = platform === "billboard" ? "周" : "天";
  const topGaps = dataset.gaps.slice(0, 3);

  return (
    <section className="stage-panel rounded-[1.6rem] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Coverage</p>
          <h2 className="mt-1 text-lg font-black text-white">数据覆盖范围</h2>
          <p className="mt-1 text-sm leading-6 text-[#8fa399]">
            当前榜单数据：{dataset.platform} / {dataset.region}
          </p>
        </div>
        <MetricBadge tone={dataset.missingChartDates > 0 ? "gold" : "green"}>
          {dataset.missingChartDates > 0 ? `缺 ${dataset.missingChartDates} ${unit}` : "区间连续"}
        </MetricBadge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.15rem] border border-white/10 bg-black/24 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#6f8178]">覆盖区间</div>
          <div className="mt-1 text-sm font-black text-white">{formatRange(dataset.firstDate, dataset.latestDate)}</div>
        </div>
        <div className="rounded-[1.15rem] border border-white/10 bg-black/24 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#6f8178]">已加载</div>
          <div className="mt-1 text-sm font-black text-white">
            {dataset.totalChartDates.toLocaleString()} / {dataset.expectedChartDates.toLocaleString()} {unit}
          </div>
        </div>
        <div className="rounded-[1.15rem] border border-white/10 bg-black/24 p-3">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[#6f8178]">缺口</div>
          <div className="mt-1 text-sm font-black text-white">{dataset.gaps.length.toLocaleString()} 段</div>
        </div>
      </div>

      {topGaps.length > 0 ? (
        <div className="mt-4 rounded-[1.15rem] border border-[#f8d66d]/20 bg-[#f8d66d]/10 p-3 text-xs text-[#ffe29a]">
          <div className="mb-2 font-black">主要缺口</div>
          <div className="grid gap-1">
            {topGaps.map((gap) => (
              <div key={`${gap.start}-${gap.end}`} className="flex justify-between gap-3">
                <span>
                  {gap.start} 至 {gap.end}
                </span>
                <span>
                  {gap.days} {unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {works.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {works.map((work) => (
            <div key={work.work_id} className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{work.title}</div>
                  <div className="truncate text-xs text-[#6f8178]">{work.artist}</div>
                </div>
                <MetricBadge tone={work.coverageStartsAfterRelease ? "gold" : work.totalEntries > 0 ? "green" : "red"}>
                  {work.totalEntries > 0 ? `${work.totalEntries} 条记录` : "无记录"}
                </MetricBadge>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[#8fa399] sm:grid-cols-2">
                <span>本地记录：{formatRange(work.firstEntryDate, work.latestEntryDate)}</span>
                <span>发行/基准：{work.releaseDate ?? dash}</span>
              </div>
              {work.coverageStartsAfterRelease ? (
                <p className="mt-2 text-xs leading-5 text-[#ffe29a]">
                  本地记录从发行/基准日后的第 {work.missingBeforeFirstEntry} {unit} 才开始，早期走势可能不完整。
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#6f8178]">选择歌曲后，这里会显示每首歌的本地数据覆盖情况。</p>
      )}
    </section>
  );
}
