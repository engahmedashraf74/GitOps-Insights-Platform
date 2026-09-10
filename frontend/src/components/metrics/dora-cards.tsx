"use client";

import { MetricCard } from "@/components/ui/metric-card";
import type { DoraMetrics } from "@/types";
import {
  Activity,
  Clock3,
  ShieldAlert,
  TimerReset,
} from "lucide-react";

export function DoraCards({ metrics }: { metrics: DoraMetrics }) {
  const items = [
    { metric: metrics.deploymentFrequency, icon: <Activity size={16} /> },
    { metric: metrics.leadTime, icon: <Clock3 size={16} /> },
    { metric: metrics.changeFailureRate, icon: <ShieldAlert size={16} /> },
    { metric: metrics.mttr, icon: <TimerReset size={16} /> },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ metric, icon }) => (
        <MetricCard
          key={metric.key}
          label={metric.label}
          value={metric.value}
          hint={`${metric.hint} · ${metric.source}`}
          icon={icon}
        />
      ))}
    </div>
  );
}
