"use client";

import { useEffect, useState } from "react";
import type { Work } from "@/lib/types";

type CoverArtProps = {
  work: Pick<Work, "work_id" | "title" | "artist" | "cover_url" | "spotify_url">;
  size?: "sm" | "md" | "lg" | "xl";
  linked?: boolean;
};

const sizeClass = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-xl",
  xl: "h-24 w-24 text-2xl",
};

function Placeholder({ work, size }: Pick<CoverArtProps, "work" | "size">) {
  const initials = work.title?.trim()?.slice(0, 1).toUpperCase() || "♪";
  return (
    <div
      className={`${sizeClass[size ?? "md"]} flex shrink-0 items-center justify-center rounded-2xl border border-[#1ed760]/25 bg-[linear-gradient(135deg,#12160f,#1f2d20_44%,#0b100d)] font-black text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]`}
      title={`${work.title} - ${work.artist}`}
    >
      {initials}
    </div>
  );
}

export default function CoverArt({ work, size = "md", linked = false }: CoverArtProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = [work.cover_url, `/covers/${work.work_id}.jpg`].filter(Boolean) as string[];
  const src = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
  }, [work.work_id, work.cover_url]);

  const image =
    src && sourceIndex < sources.length ? (
      <img
        src={src}
        alt={`${work.title} cover`}
        className={`${sizeClass[size]} shrink-0 rounded-2xl border border-white/10 object-cover shadow-[0_18px_50px_rgba(0,0,0,0.35)]`}
        onError={() => setSourceIndex((index) => index + 1)}
      />
    ) : (
      <Placeholder work={work} size={size} />
    );

  if (linked && work.spotify_url) {
    return (
      <a href={work.spotify_url} target="_blank" rel="noreferrer" className="shrink-0">
        {image}
      </a>
    );
  }

  return image;
}
