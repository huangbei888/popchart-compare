"use client";

import ComparisonTable from "@/components/ComparisonTable";
import type { ChartMetric, Platform } from "@/lib/types";

type MetricCardsProps = {
  metrics: ChartMetric[];
  platform?: Platform;
};

export default function MetricCards({ metrics, platform = "billboard" }: MetricCardsProps) {
  return <ComparisonTable metrics={metrics} platform={platform} selectedCount={metrics.length} />;
}
