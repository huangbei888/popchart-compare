"use client";

import type { Platform, TimelineMode, Work } from "@/lib/types";

type WorkSelectorProps = {
  works: Work[];
  selectedWorkIds: string[];
  platform: Platform;
  region: string;
  timelineMode: TimelineMode;
  onWorkToggle: (workId: string) => void;
  onPlatformChange: (platform: Platform) => void;
  onRegionChange: (region: string) => void;
  onTimelineModeChange: (mode: TimelineMode) => void;
};

export default function WorkSelector({
  works,
  selectedWorkIds,
  platform,
  region,
  timelineMode,
  onWorkToggle,
  onPlatformChange,
  onRegionChange,
  onTimelineModeChange,
}: WorkSelectorProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-5 text-white">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Select tracks</h2>
            <span className="text-sm text-zinc-400">{selectedWorkIds.length} selected</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {works.slice(0, 12).map((work) => {
              const checked = selectedWorkIds.includes(work.work_id);
              return (
                <label
                  key={work.work_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                    checked ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-emerald-400"
                    checked={checked}
                    onChange={() => onWorkToggle(work.work_id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{work.title}</span>
                    <span className="block truncate text-xs text-zinc-400">{work.artist}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div>
            <h2 className="mb-3 text-base font-semibold">Chart settings</h2>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/35 p-1">
              {(["billboard", "spotify"] as Platform[]).map((value) => (
                <button
                  key={value}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    platform === value ? "bg-emerald-300 text-black" : "text-zinc-300 hover:bg-white/10"
                  }`}
                  onClick={() => onPlatformChange(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-medium text-zinc-300">
            Region
            <select
              className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none"
              value={platform === "billboard" ? "us" : region}
              onChange={(event) => onRegionChange(event.target.value)}
              disabled={platform === "billboard"}
            >
              <option value="us">us</option>
              <option value="global">global</option>
            </select>
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-300">Timeline</span>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/35 p-1">
              {(["absolute", "relative"] as TimelineMode[]).map((value) => (
                <button
                  key={value}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    timelineMode === value ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10"
                  }`}
                  onClick={() => onTimelineModeChange(value)}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
