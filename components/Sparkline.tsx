"use client";

type SparklineProps = {
  data: Array<{ date: string; rank: number }>;
};

export default function Sparkline({ data }: SparklineProps) {
  if (data.length < 2) {
    return <div className="h-9 w-28 rounded-md border border-white/10 bg-white/[0.045]" />;
  }

  const width = 132;
  const height = 38;
  const minRank = Math.min(...data.map((point) => point.rank));
  const maxRank = Math.max(...data.map((point) => point.rank));
  const rankSpan = Math.max(1, maxRank - minRank);
  const points = data
    .map((point, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = ((point.rank - minRank) / rankSpan) * (height - 8) + 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-32 overflow-visible">
      <polyline points={points} fill="none" stroke="rgba(30,215,96,0.95)" strokeWidth="2.6" strokeLinecap="round" />
      <circle
        cx={(width).toFixed(1)}
        cy={(((data[data.length - 1].rank - minRank) / rankSpan) * (height - 8) + 4).toFixed(1)}
        r="3"
        fill="#f8d66d"
      />
    </svg>
  );
}
