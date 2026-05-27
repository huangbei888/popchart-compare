"use client";

import { useState } from "react";
import MetricBadge from "@/components/MetricBadge";
import type { ChartAnalystResult } from "@/lib/ai/chartPrompt";
import type { ChartMetric, ChartValueMode, Platform, TimelineMode } from "@/lib/types";

type AIChartAnalystProps = {
  metrics: ChartMetric[];
  platform: Platform;
  region: string;
  timelineMode: TimelineMode;
  valueMode: ChartValueMode;
};

type AnalystResponse = {
  result: ChartAnalystResult;
  provider: string;
  fallback: boolean;
  cached?: boolean;
  error?: string;
};

function InsightBlock({ label, winner, reason }: { label: string; winner: string; reason: string }) {
  return (
    <article className="rounded-[1.2rem] border border-white/10 bg-black/24 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6f8178]">{label}</p>
      <h3 className="mt-2 text-base font-black text-white">{winner}</h3>
      <p className="mt-2 text-sm leading-6 text-[#d6e7dc]">{reason}</p>
    </article>
  );
}

export default function AIChartAnalyst({ metrics, platform, region, timelineMode, valueMode }: AIChartAnalystProps) {
  const [analysis, setAnalysis] = useState<AnalystResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAnalyze = metrics.length >= 1;

  const runAnalysis = async () => {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chart-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          region,
          timelineMode,
          valueMode,
          metrics,
        }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string; retryAfter?: number } | null;
        throw new Error(detail?.error ?? `AI 分析请求失败：${response.status}`);
      }

      const data = (await response.json()) as AnalystResponse;
      setAnalysis(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 分析暂时失败。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stage-panel rounded-[1.7rem] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#1ed760]">AI Chart Analyst</p>
          <h2 className="mt-2 text-2xl font-black text-white">AI 走势点评</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#8fa399]">
            一键判断谁开局强、谁后劲强、谁更像 viral，最后给一句网感总结。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetricBadge tone={analysis?.fallback ? "gold" : "green"}>{analysis?.provider ?? "Qwen / DeepSeek ready"}</MetricBadge>
          {analysis?.cached ? <MetricBadge tone="blue">cache hit</MetricBadge> : null}
          <button
            type="button"
            onClick={runAnalysis}
            disabled={!canAnalyze || loading}
            className="rounded-full border border-[#1ed760]/40 bg-[#1ed760] px-4 py-2 text-sm font-black text-black transition hover:bg-[#7df2a1] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-[#6f8178]"
          >
            {loading ? "分析中..." : "生成走势点评"}
          </button>
        </div>
      </div>

      {!canAnalyze ? (
        <div className="mt-5 rounded-[1.25rem] border border-dashed border-white/15 bg-black/24 px-4 py-10 text-center text-sm text-[#8fa399]">
          先选择至少一首有榜单数据的歌曲，AI 才能开始分析。
        </div>
      ) : error ? (
        <div className="mt-5 rounded-[1.25rem] border border-[#fb7185]/25 bg-[#fb7185]/10 p-4 text-sm text-[#fecdd3]">{error}</div>
      ) : analysis ? (
        <div className="mt-5 grid gap-4">
          {analysis.fallback ? (
            <div className="rounded-[1.25rem] border border-[#f8d66d]/25 bg-[#f8d66d]/10 p-4 text-sm text-[#ffe29a]">
              当前没有成功调用外部模型，下面先展示本地规则版分析。配置好 `.env.local` 后会自动升级成 AI 文案。
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <InsightBlock label="开局最强" winner={analysis.result.openingWinner} reason={analysis.result.openingReason} />
            <InsightBlock label="后劲最强" winner={analysis.result.longevityWinner} reason={analysis.result.longevityReason} />
            <InsightBlock label="更像 viral" winner={analysis.result.viralCandidate} reason={analysis.result.viralReason} />
            <InsightBlock label="更像粉丝盘" winner={analysis.result.fanbaseCandidate} reason={analysis.result.fanbaseReason} />
          </div>
          <div className="rounded-[1.25rem] border border-[#1ed760]/25 bg-[#1ed760]/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9fffc0]">一句网感总结</p>
            <p className="mt-2 text-lg font-black leading-8 text-white">{analysis.result.oneLineSummary}</p>
            <p className="mt-3 text-xs leading-5 text-[#8fa399]">{analysis.result.caveat}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-black/24 p-4 text-sm leading-6 text-[#8fa399]">
          当前会把已选歌曲的 peak、debut、latest、Top 10 周数、最大升跌幅和回榜次数发给后端分析。
        </div>
      )}
    </section>
  );
}
