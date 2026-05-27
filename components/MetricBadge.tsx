"use client";

type MetricBadgeProps = {
  children: React.ReactNode;
  tone?: "green" | "gold" | "red" | "gray" | "blue";
  strong?: boolean;
};

const toneClass = {
  green: "border-[#1ed760]/35 bg-[#1ed760]/15 text-[#9fffc0]",
  gold: "border-[#f8d66d]/40 bg-[#f8d66d]/15 text-[#ffe29a]",
  red: "border-[#fb7185]/35 bg-[#fb7185]/15 text-[#fecdd3]",
  gray: "border-white/10 bg-white/[0.055] text-[#d6e7dc]",
  blue: "border-[#8aa7ff]/35 bg-[#8aa7ff]/15 text-[#c7d2ff]",
};

export default function MetricBadge({ children, tone = "gray", strong = false }: MetricBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${
        toneClass[tone]
      } ${strong ? "shadow-[0_0_22px_rgba(251,191,36,0.18)]" : ""}`}
    >
      {children}
    </span>
  );
}
