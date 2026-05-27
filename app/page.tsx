"use client";

import { useEffect, useMemo, useState } from "react";
import AIChartAnalyst from "@/components/AIChartAnalyst";
import ComparisonTable from "@/components/ComparisonTable";
import CoverArt from "@/components/CoverArt";
import CrossPlatformChart from "@/components/CrossPlatformChart";
import DataCoverage from "@/components/DataCoverage";
import MetricBadge from "@/components/MetricBadge";
import SearchCommand from "@/components/SearchCommand";
import TrendChart from "@/components/TrendChart";
import {
  buildChartMarkers,
  buildLineChartData,
  calculateDatasetCoverage,
  calculateMetrics,
  calculateWorkCoverage,
  getLatestChartDate,
  mergeWorks,
  normalizeChartData,
} from "@/lib/chartUtils";
import type { ChartEntry, ChartValueMode, Platform, TimelineMode, Work } from "@/lib/types";

type WorkEntryIndex = Record<
  string,
  {
    file: string;
    entries: number;
    platforms: Platform[];
    regions: string[];
  }
>;

type ChartEntriesIndexItem = {
  platform: Platform;
  region: string;
  file: string;
  entries: number;
  first_date: string | null;
  latest_date: string | null;
  dates?: string[];
};

type DataManifest = {
  generated_at?: string;
  spotify_latest_dates?: Record<string, string>;
};

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function buildDateAxis(firstDate: string | null | undefined, latestDate: string | null | undefined, platform: Platform) {
  if (!firstDate || !latestDate) return [];
  const dates: string[] = [];
  const stepMs = platform === "billboard" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  let current = new Date(`${firstDate}T00:00:00Z`).getTime();
  const end = new Date(`${latestDate}T00:00:00Z`).getTime();

  while (current <= end) {
    dates.push(new Date(current).toISOString().slice(0, 10));
    current += stepMs;
  }

  return dates;
}

function markerSortValue(x: string, timelineMode: TimelineMode) {
  if (timelineMode === "absolute") return new Date(`${x}T00:00:00Z`).getTime();
  const match = x.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function includeMarkerXPoints(
  data: Record<string, string | number | null>[],
  markers: Array<{ x: string }>,
  timelineMode: TimelineMode,
) {
  const byX = new Map(data.map((point) => [String(point.x), point]));

  markers.forEach((marker) => {
    if (!byX.has(marker.x)) {
      byX.set(marker.x, { x: marker.x, sortValue: markerSortValue(marker.x, timelineMode) });
    }
  });

  return Array.from(byX.values()).sort((a, b) => Number(a.sortValue ?? 0) - Number(b.sortValue ?? 0));
}

export default function Home() {
  const [manualWorks, setManualWorks] = useState<Work[]>([]);
  const [billboardCatalog, setBillboardCatalog] = useState<Work[]>([]);
  const [spotifyCatalog, setSpotifyCatalog] = useState<Work[]>([]);
  const [workEntryIndex, setWorkEntryIndex] = useState<WorkEntryIndex>({});
  const [chartEntriesIndex, setChartEntriesIndex] = useState<ChartEntriesIndexItem[]>([]);
  const [dataManifest, setDataManifest] = useState<DataManifest>({});
  const [chartEntries, setChartEntries] = useState<ChartEntry[]>([]);
  const [selectedWorkIds, setSelectedWorkIds] = useState<string[]>([]);
  const [crossPlatformWorkId, setCrossPlatformWorkId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("billboard");
  const [region, setRegion] = useState("us");
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("absolute");
  const [chartValueMode, setChartValueMode] = useState<ChartValueMode>("rank");
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCatalogs() {
      const [worksData, billboardCatalogData, spotifyCatalogData, entryIndexData, chartIndexData, manifestData] = await Promise.all([
        fetchJson<Work[]>("/data/works.json", []),
        fetchJson<Work[]>("/data/billboard_catalog.json", []),
        fetchJson<Work[]>("/data/spotify_catalog.json", []),
        fetchJson<WorkEntryIndex>("/data/work_entries_index.json", {}),
        fetchJson<ChartEntriesIndexItem[]>("/data/chart_entries_index.json", []),
        fetchJson<DataManifest>("/data/manifest.json", {}),
      ]);

      if (!active) return;
      setManualWorks(worksData);
      setBillboardCatalog(billboardCatalogData);
      setSpotifyCatalog(spotifyCatalogData);
      setWorkEntryIndex(entryIndexData);
      setChartEntriesIndex(chartIndexData);
      setDataManifest(manifestData);
      setLoadingCatalogs(false);
    }

    loadCatalogs();
    return () => {
      active = false;
    };
  }, []);

  const effectiveRegion = platform === "billboard" ? "us" : region;
  const catalogAvailable = billboardCatalog.length > 0;

  const allWorks = useMemo(
    () => mergeWorks(mergeWorks(catalogAvailable ? billboardCatalog : [], spotifyCatalog), manualWorks),
    [billboardCatalog, catalogAvailable, manualWorks, spotifyCatalog],
  );
  const billboardWorks = useMemo(
    () => mergeWorks(catalogAvailable ? billboardCatalog : [], manualWorks),
    [billboardCatalog, catalogAvailable, manualWorks],
  );
  const availableWorkIds = useMemo(
    () =>
      new Set(
        Object.entries(workEntryIndex)
          .filter(([, item]) => item.platforms.includes(platform) && item.regions.includes(effectiveRegion))
          .map(([workId]) => workId),
      ),
    [effectiveRegion, platform, workEntryIndex],
  );
  const spotifySearchCatalog = useMemo(() => {
    const source = spotifyCatalog.length > 0 ? spotifyCatalog : manualWorks;
    return source.filter((work) => availableWorkIds.has(work.work_id));
  }, [availableWorkIds, manualWorks, spotifyCatalog]);
  const billboardSearchCatalog = useMemo(() => {
    const spotifyById = new Map(spotifyCatalog.map((work) => [work.work_id, work]));
    const source = catalogAvailable ? billboardWorks : manualWorks;
    return source.map((work) => ({ ...spotifyById.get(work.work_id), ...work }));
  }, [billboardWorks, catalogAvailable, manualWorks, spotifyCatalog]);
  const searchCatalog = platform === "spotify" ? spotifySearchCatalog : billboardSearchCatalog;
  const selectedWorks = useMemo(
    () => allWorks.filter((work) => selectedWorkIds.includes(work.work_id)),
    [allWorks, selectedWorkIds],
  );

  useEffect(() => {
    if (selectedWorkIds.length === 0) {
      setCrossPlatformWorkId(null);
      return;
    }
    setCrossPlatformWorkId((current) => (current && selectedWorkIds.includes(current) ? current : selectedWorkIds[0]));
  }, [selectedWorkIds]);

  useEffect(() => {
    let active = true;

    async function loadSelectedEntries() {
      if (selectedWorkIds.length === 0) {
        setChartEntries([]);
        setLoadingEntries(false);
        return;
      }

      setLoadingEntries(true);
      const chunks = await Promise.all(
        selectedWorkIds.map((workId) => {
          const file = workEntryIndex[workId]?.file;
          return file ? fetchJson<ChartEntry[]>(file, []) : Promise.resolve([]);
        }),
      );

      if (!active) return;
      setChartEntries(chunks.flat());
      setLoadingEntries(false);
    }

    loadSelectedEntries();
    return () => {
      active = false;
    };
  }, [selectedWorkIds, workEntryIndex]);

  const activeChartIndex = useMemo(
    () => chartEntriesIndex.find((item) => item.platform === platform && item.region === effectiveRegion),
    [chartEntriesIndex, effectiveRegion, platform],
  );
  const chartDates = useMemo(
    () =>
      activeChartIndex?.dates?.length
        ? activeChartIndex.dates
        : buildDateAxis(activeChartIndex?.first_date, activeChartIndex?.latest_date, platform),
    [activeChartIndex, platform],
  );
  const latestChartDate = useMemo(
    () => activeChartIndex?.latest_date ?? getLatestChartDate(chartEntries, platform, effectiveRegion),
    [activeChartIndex, chartEntries, effectiveRegion, platform],
  );
  const filteredEntries = useMemo(
    () => normalizeChartData(chartEntries, { workIds: selectedWorkIds, platform, region: effectiveRegion }),
    [chartEntries, effectiveRegion, platform, selectedWorkIds],
  );
  const effectiveChartValueMode = platform === "billboard" ? "rank" : chartValueMode;
  const chartData = useMemo(
    () => buildLineChartData(filteredEntries, allWorks, timelineMode, platform, effectiveChartValueMode),
    [allWorks, effectiveChartValueMode, filteredEntries, platform, timelineMode],
  );
  const chartMarkers = useMemo(
    () => buildChartMarkers(filteredEntries, allWorks, timelineMode, platform, latestChartDate, chartDates),
    [allWorks, chartDates, filteredEntries, latestChartDate, platform, timelineMode],
  );
  const activeChartMarkers = effectiveChartValueMode === "rank" ? chartMarkers : [];
  const chartDataWithMarkers = useMemo(
    () => includeMarkerXPoints(chartData, activeChartMarkers, timelineMode),
    [activeChartMarkers, chartData, timelineMode],
  );
  const metrics = useMemo(
    () => calculateMetrics(filteredEntries, allWorks, latestChartDate),
    [allWorks, filteredEntries, latestChartDate],
  );
  const datasetCoverage = useMemo(
    () =>
      calculateDatasetCoverage(
        chartDates.map((date) => ({
          work_id: "__chart_date__",
          platform,
          chart_name: platform === "billboard" ? "hot_100" : "top_200",
          region: effectiveRegion,
          date,
          rank: null,
          streams: null,
          weeks_on_chart: null,
          peak_position: null,
        })),
        platform,
        effectiveRegion,
      ),
    [chartDates, effectiveRegion, platform],
  );
  const workCoverage = useMemo(
    () => calculateWorkCoverage(filteredEntries, allWorks, selectedWorkIds, platform, effectiveRegion),
    [allWorks, effectiveRegion, filteredEntries, platform, selectedWorkIds],
  );

  const addWork = (workId: string) => {
    setSelectedWorkIds((current) => (current.includes(workId) || current.length >= 5 ? current : [...current, workId]));
  };
  const removeWork = (workId: string) => {
    setSelectedWorkIds((current) => current.filter((id) => id !== workId));
  };
  const updatePlatform = (value: Platform) => {
    setPlatform(value);
    if (value === "billboard") {
      setRegion("us");
      setChartValueMode("rank");
    }
  };

  return (
    <main className="stage-shell mx-auto flex min-h-screen w-full max-w-[1540px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="stage-panel overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[#1ed760] to-transparent" />
        <div className="relative flex flex-wrap items-start justify-between gap-7">
          <div className="max-w-4xl">
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#1ed760]/40 bg-[#1ed760]/15 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#9fffc0]">
                Music Data Lab
              </span>
              <span className="rounded-full border border-white/10 bg-black/28 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#8fa399]">
                Billboard + Spotify
              </span>
            </div>
            <h1 className="text-5xl font-black leading-[0.92] tracking-tight text-[#f4fff7] sm:text-7xl">
              PopChart Compare
            </h1>
            <p className="mt-5 text-lg font-semibold text-[#d6e7dc]">欧美流行单曲榜单走势对比器</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#a7b8ad]">
              Compare chart trajectories across absolute time and release-relative time.
            </p>
          </div>

          <div className="grid min-w-[240px] gap-3 rounded-[1.6rem] border border-white/10 bg-[#0d120f]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#6f8178]">Now loaded</span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#1ed760] shadow-[0_0_18px_rgba(30,215,96,0.8)]" />
            </div>
            <MetricBadge tone="green">
              {loadingCatalogs || loadingEntries ? "数据加载中" : `${filteredEntries.length.toLocaleString()} 条已选记录`}
            </MetricBadge>
            <MetricBadge tone={catalogAvailable ? "gold" : "gray"}>
              {catalogAvailable ? `${searchCatalog.length.toLocaleString()} 首可搜索歌曲` : "手动歌单模式"}
            </MetricBadge>
            {dataManifest.spotify_latest_dates?.global || dataManifest.spotify_latest_dates?.us ? (
              <MetricBadge tone="blue">
                Spotify latest {dataManifest.spotify_latest_dates.global ?? "—"} / US {dataManifest.spotify_latest_dates.us ?? "—"}
              </MetricBadge>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="grid content-start gap-6">
          <SearchCommand
            catalog={searchCatalog}
            selectedWorkIds={selectedWorkIds}
            onAdd={addWork}
            title={platform === "spotify" ? "搜索本地 Spotify 数据" : "搜索 Billboard 曲库"}
            subtitle={
              platform === "spotify"
                ? "这里只显示当前本地 Spotify 数据里有记录的歌曲。"
                : "按歌名或艺人搜索，最多加入 5 首歌对比。"
            }
            badgeLabel={
              platform === "spotify"
                ? `${searchCatalog.length.toLocaleString()} 首 Spotify 歌曲`
                : `${searchCatalog.length.toLocaleString()} 首 Hot 100 歌曲`
            }
          />

          <section className="stage-panel rounded-[1.6rem] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Control Deck</p>
                <h2 className="mt-1 text-lg font-black text-white">控制面板</h2>
              </div>
              <MetricBadge tone={effectiveChartValueMode === "streams" ? "blue" : "green"}>
                {effectiveChartValueMode === "streams" ? "Streams" : "Rank"}
              </MetricBadge>
            </div>

            <div className="grid gap-4">
              <div>
                <span className="mb-2 block text-sm font-semibold text-[#d6e7dc]">平台</span>
                <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-white/10 bg-black/28 p-1">
                  {(["billboard", "spotify"] as Platform[]).map((value) => (
                    <button
                      key={value}
                      className={`rounded-[0.9rem] px-3 py-2 text-sm font-black transition ${
                        platform === value
                          ? "bg-[#1ed760] text-black shadow-[0_0_24px_rgba(30,215,96,0.22)]"
                          : "text-[#a7b8ad] hover:bg-white/[0.07] hover:text-white"
                      }`}
                      onClick={() => updatePlatform(value)}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {platform === "spotify" ? (
                  <p className="mt-2 text-xs leading-5 text-[#f8d66d]">Spotify 数据取决于当前本地已下载的 CSV 覆盖范围。</p>
                ) : null}
              </div>

              <label className="grid gap-2 text-sm font-semibold text-[#d6e7dc]">
                地区
                <select
                  className="rounded-[1.15rem] border border-white/10 bg-black/28 px-3 py-2 text-sm text-white outline-none transition focus:border-[#1ed760]/60"
                  value={platform === "billboard" ? "us" : region}
                  onChange={(event) => setRegion(event.target.value)}
                  disabled={platform === "billboard"}
                >
                  <option value="us">us</option>
                  <option value="global">global</option>
                </select>
              </label>

              <div>
                <span className="mb-2 block text-sm font-semibold text-[#d6e7dc]">时间轴</span>
                <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-white/10 bg-black/28 p-1">
                  {(["absolute", "relative"] as TimelineMode[]).map((value) => (
                    <button
                      key={value}
                      className={`rounded-[0.9rem] px-3 py-2 text-sm font-black transition ${
                        timelineMode === value
                          ? "bg-white text-black"
                          : "text-[#a7b8ad] hover:bg-white/[0.07] hover:text-white"
                      }`}
                      onClick={() => setTimelineMode(value)}
                      type="button"
                    >
                      {value === "absolute" ? "绝对时间" : "相对时间"}
                    </button>
                  ))}
                </div>
                {platform === "billboard" && timelineMode === "relative" ? (
                  <p className="mt-2 text-xs leading-5 text-[#8fa399]">Billboard 相对时间基于首次进入 Hot 100 的榜周。</p>
                ) : null}
              </div>

              <div>
                <span className="mb-2 block text-sm font-semibold text-[#d6e7dc]">图表指标</span>
                <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-white/10 bg-black/28 p-1">
                  {(["rank", "streams"] as ChartValueMode[]).map((value) => {
                    const disabled = platform === "billboard" && value === "streams";
                    return (
                      <button
                        key={value}
                        className={`rounded-[0.9rem] px-3 py-2 text-sm font-black transition ${
                          effectiveChartValueMode === value
                            ? "bg-white text-black"
                            : disabled
                              ? "cursor-not-allowed text-[#4d5c53]"
                              : "text-[#a7b8ad] hover:bg-white/[0.07] hover:text-white"
                        }`}
                        onClick={() => {
                          if (!disabled) setChartValueMode(value);
                        }}
                        disabled={disabled}
                        type="button"
                      >
                        {value === "rank" ? "排名" : "播放量"}
                      </button>
                    );
                  })}
                </div>
                {platform === "billboard" ? (
                  <p className="mt-2 text-xs leading-5 text-[#8fa399]">Billboard 本地数据没有播放量字段，图表固定展示排名走势。</p>
                ) : null}
              </div>
            </div>
          </section>

          <DataCoverage dataset={datasetCoverage} works={workCoverage} platform={platform} />
        </div>

        <div className="grid content-start gap-6">
          <section className="stage-panel rounded-[1.6rem] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Selected Tracks</p>
              <h2 className="mt-1 text-lg font-black text-white">已选歌曲</h2>
            </div>
            <span className="text-sm font-semibold text-[#8fa399]">已选 {selectedWorks.length}/5</span>
          </div>
          {selectedWorks.length === 0 ? (
            <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-black/24 px-4 py-10 text-center text-sm text-[#8fa399]">
              先在左侧搜索并加入歌曲。默认不自动选歌，避免打开页面就替你做决定。
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {selectedWorks.map((work) => (
                <article
                  key={work.work_id}
                  className="group rounded-[1.2rem] border border-white/10 bg-white/[0.045] p-3 transition hover:border-[#1ed760]/40 hover:bg-[#1ed760]/[0.06]"
                >
                  <div className="flex gap-3">
                    <CoverArt work={work} size="md" linked />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-white">{work.title}</div>
                      <div className="truncate text-sm text-[#8fa399]">{work.artist}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <MetricBadge tone={work.peak_rank === 1 ? "gold" : "green"}>
                          Peak {work.peak_rank ? `#${work.peak_rank}` : "—"}
                        </MetricBadge>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWork(work.work_id)}
                      className="h-8 w-8 rounded-full border border-white/10 text-[#8fa399] transition hover:border-[#fb7185]/50 hover:bg-[#fb7185]/10 hover:text-[#fecdd3]"
                      aria-label={`Remove ${work.title}`}
                    >
                      ×
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          </section>

          <TrendChart
            data={chartDataWithMarkers}
            works={allWorks}
            selectedWorkIds={selectedWorkIds}
            platform={platform}
            timelineMode={timelineMode}
            valueMode={effectiveChartValueMode}
            markers={activeChartMarkers}
          />
        </div>
      </div>

      <CrossPlatformChart
        entries={chartEntries}
        selectedWorks={selectedWorks}
        activeWorkId={crossPlatformWorkId}
        onActiveWorkChange={setCrossPlatformWorkId}
        timelineMode={timelineMode}
      />

      <AIChartAnalyst
        metrics={metrics}
        platform={platform}
        region={effectiveRegion}
        timelineMode={timelineMode}
        valueMode={effectiveChartValueMode}
      />

      <ComparisonTable metrics={metrics} selectedCount={selectedWorkIds.length} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-6 text-sm text-[#6f8178]">
        <span>PopChart Compare 使用本地处理后的榜单数据。公开访问时 AI 分析会做限流和缓存。</span>
        <a className="font-semibold text-[#9fffc0] hover:text-white" href="/privacy">
          隐私与数据说明
        </a>
      </footer>
    </main>
  );
}
