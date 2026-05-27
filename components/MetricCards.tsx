"use client";

import ComparisonTable from "@/components/ComparisonTable";
import type { ChartMetric } from "@/lib/types";

type MetricCardsProps = {
  metrics: ChartMetric[];
};

export default function MetricCards({ metrics }: MetricCardsProps) {
  return <ComparisonTable metrics={metrics} selectedCount={metrics.length} />;
}
