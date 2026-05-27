import type { ChartMetric, ChartValueMode, Platform, TimelineMode } from "@/lib/types";

export type ChartAnalystInput = {
  platform: Platform;
  region: string;
  timelineMode: TimelineMode;
  valueMode: ChartValueMode;
  metrics: ChartMetric[];
};

export type ChartAnalystResult = {
  openingWinner: string;
  openingReason: string;
  longevityWinner: string;
  longevityReason: string;
  viralCandidate: string;
  viralReason: string;
  fanbaseCandidate: string;
  fanbaseReason: string;
  oneLineSummary: string;
  caveat: string;
};

function compactMetric(metric: ChartMetric) {
  return {
    title: metric.title,
    artist: metric.artist,
    peakRank: metric.peakRank,
    debutRank: metric.debutRank,
    debutDate: metric.debutDate,
    latestRank: metric.latestRank,
    latestDate: metric.latestDate,
    totalEntries: metric.totalEntries,
    weeksAtNumberOne: metric.weeksAtNumberOne,
    weeksInTop10: metric.weeksInTop10,
    biggestRise: metric.biggestRise,
    biggestDrop: metric.biggestDrop,
    status: metric.status,
    reEntryCount: metric.reEntryCount,
    maxStreams: metric.maxStreams,
    sparkline: metric.sparkline.slice(0, 80),
  };
}

export function buildChartAnalystMessages(input: ChartAnalystInput) {
  const payload = {
    platform: input.platform,
    region: input.region,
    timelineMode: input.timelineMode,
    valueMode: input.valueMode,
    songs: input.metrics.slice(0, 5).map(compactMetric),
  };

  return [
    {
      role: "system",
      content:
        "你是一个音乐榜单走势分析师，擅长用中文做清晰、有网感但不冒犯艺人的点评。你必须只基于用户提供的数据分析，不要编造榜单记录。输出必须是严格 JSON，不要 Markdown。",
    },
    {
      role: "user",
      content: `请分析这些歌曲的榜单走势，并返回严格 JSON。

判断口径：
- 谁开局强：debutRank 越小越强，首周/首日成绩越高越强。
- 谁后劲强：totalEntries、weeksInTop10、latestRank、status、下降幅度综合判断。
- 谁更像 viral：开局未必最高，但后续爬升明显，biggestRise 大，或有回榜/re-entry。
- 谁更像粉丝盘：开局很高但后续掉得快，biggestDrop 大，totalEntries 相对短。
- 一句网感总结：短、准、有梗，但不要人身攻击，不要攻击粉丝。

返回 JSON 字段必须完全是：
{
  "openingWinner": "歌名 - 艺人",
  "openingReason": "一句原因",
  "longevityWinner": "歌名 - 艺人",
  "longevityReason": "一句原因",
  "viralCandidate": "歌名 - 艺人",
  "viralReason": "一句原因",
  "fanbaseCandidate": "歌名 - 艺人",
  "fanbaseReason": "一句原因",
  "oneLineSummary": "一句网感总结",
  "caveat": "一句数据限制说明"
}

数据：
${JSON.stringify(payload, null, 2)}`,
    },
  ];
}

export function fallbackChartAnalysis(input: ChartAnalystInput): ChartAnalystResult {
  const metrics = input.metrics.slice().filter((metric) => metric.totalEntries > 0);
  const dash = "暂无";

  if (metrics.length === 0) {
    return {
      openingWinner: dash,
      openingReason: "当前选择没有可分析的本地榜单记录。",
      longevityWinner: dash,
      longevityReason: "暂无足够数据判断后劲。",
      viralCandidate: dash,
      viralReason: "暂无足够数据判断爬升趋势。",
      fanbaseCandidate: dash,
      fanbaseReason: "暂无足够数据判断首周冲高后的回落。",
      oneLineSummary: "数据还没上桌，先别急着开麦。",
      caveat: "AI 未启用或数据不足，因此展示本地规则分析。",
    };
  }

  const label = (metric: ChartMetric) => `${metric.title} - ${metric.artist}`;
  const opening = metrics
    .slice()
    .sort((a, b) => (a.debutRank ?? 999) - (b.debutRank ?? 999) || (a.debutDate ?? "").localeCompare(b.debutDate ?? ""))[0];
  const longevity = metrics
    .slice()
    .sort(
      (a, b) =>
        b.weeksInTop10 - a.weeksInTop10 ||
        b.totalEntries - a.totalEntries ||
        (a.latestRank ?? 999) - (b.latestRank ?? 999),
    )[0];
  const viral = metrics
    .slice()
    .sort((a, b) => (b.biggestRise ?? 0) - (a.biggestRise ?? 0) || b.reEntryCount - a.reEntryCount)[0];
  const fanbase = metrics
    .slice()
    .sort(
      (a, b) =>
        (b.debutRank ? 101 - b.debutRank : 0) + (b.biggestDrop ?? 0) - ((a.debutRank ? 101 - a.debutRank : 0) + (a.biggestDrop ?? 0)),
    )[0];

  return {
    openingWinner: label(opening),
    openingReason: `首登 ${opening.debutRank ? `#${opening.debutRank}` : "未知"}，开局冲击力最明显。`,
    longevityWinner: label(longevity),
    longevityReason: `累计 ${longevity.totalEntries} 条记录，Top 10 周数为 ${longevity.weeksInTop10}，续航更稳。`,
    viralCandidate: label(viral),
    viralReason: `最大上升幅度 ${viral.biggestRise ?? 0}，更像靠后续热度往上爬。`,
    fanbaseCandidate: label(fanbase),
    fanbaseReason: `首登和最大下跌幅度组合更像前期动员强、后续回落明显。`,
    oneLineSummary: "这组歌像是在比谁先炸场、谁能留桌，热闹但各有剧本。",
    caveat: "当前为本地规则分析；配置 AI key 后会生成更自然的中文点评。",
  };
}
