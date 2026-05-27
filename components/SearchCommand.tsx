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
  limit?: number;
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
};

const dash = "—";
const rank = (value?: number | null) => (value ? `#${value}` : dash);

export default function SearchCommand({
  catalog,
  selectedWorkIds,
  onAdd,
  limit = 5,
  title = "Search catalog",
  subtitle = "Search by song or artist, then add up to 5 tracks.",
  badgeLabel,
}: SearchCommandProps) {
  const [query, setQuery] = useState("");
  const [limitMessage, setLimitMessage] = useState(false);
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
    const base = query.trim()
      ? fuse.search(query.trim()).map((result) => result.item)
      : catalog
          .slice()
          .sort(
            (a, b) =>
              (a.peak_rank ?? 999) - (b.peak_rank ?? 999) ||
              (b.total_chart_entries ?? 0) - (a.total_chart_entries ?? 0),
          );
    return base.filter((work) => !selected.has(work.work_id)).slice(0, 8);
  }, [catalog, fuse, query, selected]);

  const add = (workId: string) => {
    if (selectedWorkIds.length >= limit) {
      setLimitMessage(true);
      return;
    }
    setLimitMessage(false);
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
        onChange={(event) => {
          setQuery(event.target.value);
          setLimitMessage(false);
        }}
        placeholder="Search vampire, Taylor Swift, Espresso..."
        className="w-full rounded-full border border-white/10 bg-[#050806] px-4 py-2.5 text-sm text-[#f4fff7] outline-none transition placeholder:text-[#6f8178] focus:border-[#1ed760]/70 focus:bg-[#07100b]"
        style={{ colorScheme: "dark" }}
      />

      {limitMessage ? (
        <div className="mt-3 rounded-[1.15rem] border border-[#f8d66d]/25 bg-[#f8d66d]/10 px-4 py-3 text-sm text-[#ffe29a]">
          最多同时对比 5 首歌。先移除一首，再添加新的歌曲。
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {results.length === 0 ? (
          <div className="rounded-[1.25rem] border border-white/10 bg-black/24 px-4 py-8 text-center text-sm text-[#8fa399]">
            当前本地数据集中没有搜到匹配歌曲。
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
