"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import CoverArt from "@/components/CoverArt";
import MetricBadge from "@/components/MetricBadge";
import type { Work } from "@/lib/types";

type SearchCommandProps = {
  catalog: Work[];
  selectedWorkIds: string[];
  onAdd: (workId: string) => void;
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  onPrimeCatalog?: () => void;
};

const dash = "—";
const rank = (value?: number | null) => (value ? `#${value}` : dash);

function normalizeSearchText(value: string | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasArtist(work: Work, artist: string) {
  return normalizeSearchText(work.artist).includes(artist);
}

function chartStrengthSort(a: Work, b: Work) {
  return (
    (a.peak_rank ?? 999) - (b.peak_rank ?? 999) ||
    (b.total_chart_entries ?? 0) - (a.total_chart_entries ?? 0)
  );
}

function buildDefaultRecommendations(catalog: Work[], limit: number) {
  const ranked = catalog.slice().sort(chartStrengthSort);
  const used = new Set<string>();
  const picks: Work[] = [];
  const add = (work: Work | undefined) => {
    if (!work || used.has(work.work_id) || picks.length >= limit) return;
    used.add(work.work_id);
    picks.push(work);
  };

  ranked.filter((work) => hasArtist(work, "olivia rodrigo")).slice(0, Math.max(0, limit - 2)).forEach(add);
  add(
    ranked.find(
      (work) => hasArtist(work, "sabrina carpenter") && normalizeSearchText(work.title).includes("espresso"),
    ),
  );
  add(
    ranked.find(
      (work) => hasArtist(work, "taylor swift") && normalizeSearchText(work.title).includes("cruel summer"),
    ),
  );
  add(ranked.find((work) => hasArtist(work, "taylor swift")));
  ranked.filter((work) => hasArtist(work, "olivia rodrigo")).forEach(add);
  ranked.forEach(add);

  return picks.slice(0, limit);
}

export default function SearchCommand({
  catalog,
  selectedWorkIds,
  onAdd,
  title = "Search catalog",
  subtitle = "Search by song or artist, then add up to 5 tracks.",
  badgeLabel,
  emptyMessage,
  isLoading = false,
  onPrimeCatalog,
}: SearchCommandProps) {
  const [query, setQuery] = useState("");
  const selected = new Set(selectedWorkIds);
  const fuse = useMemo(
    () =>
      new Fuse(catalog, {
        keys: ["title", "artist", "album_name"],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [catalog],
  );

  const results = useMemo(() => {
    const availableCatalog = catalog.filter((work) => !selected.has(work.work_id));
    if (!query.trim()) return buildDefaultRecommendations(availableCatalog, 8);
    return fuse
      .search(query.trim())
      .map((result) => result.item)
      .filter((work) => !selected.has(work.work_id))
      .slice(0, 8);
  }, [catalog, fuse, query, selected]);

  const add = (workId: string) => {
    onAdd(workId);
    setQuery("");
  };

  return (
    <section className="stage-panel rounded-[1.6rem] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#1ed760]">Search Catalog</p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#8fa399]">{subtitle}</p>
        </div>
        <MetricBadge tone="green">{badgeLabel ?? `${catalog.length.toLocaleString()} songs`}</MetricBadge>
      </div>

      <input
        value={query}
        autoComplete="off"
        onFocus={onPrimeCatalog}
        onChange={(event) => {
          onPrimeCatalog?.();
          setQuery(event.target.value);
        }}
        placeholder="输入歌曲名称"
        className="w-full rounded-full border border-white/10 bg-[#050806] px-4 py-2.5 text-sm text-[#f4fff7] outline-none transition placeholder:text-[#6f8178] focus:border-[#1ed760]/70 focus:bg-[#07100b]"
        style={{ colorScheme: "dark" }}
      />

      <div className="mt-3 grid gap-2">
        {isLoading ? (
          <div className="rounded-[1.25rem] border border-white/10 bg-black/24 px-4 py-8 text-center text-sm text-[#8fa399]">
            正在加载曲库，马上就好。
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-[1.25rem] border border-white/10 bg-black/24 px-4 py-8 text-center text-sm text-[#8fa399]">
            {emptyMessage ?? "当前本地数据集中没有搜到匹配歌曲。"}
          </div>
        ) : (
          results.map((work) => (
            <button
              key={work.work_id}
              type="button"
              onClick={() => add(work.work_id)}
              className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.045] p-2.5 text-left transition hover:border-[#1ed760]/40 hover:bg-[#1ed760]/[0.07]"
            >
              <CoverArt work={work} size="md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">{work.title}</div>
                <div className="truncate text-sm text-[#8fa399]">{work.artist}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6f8178]">
                  <span>First {work.first_chart_date ?? dash}</span>
                  <span>{work.total_chart_entries ?? 0} entries</span>
                  <span className="font-black text-[#9fffc0]">Peak {rank(work.peak_rank)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
