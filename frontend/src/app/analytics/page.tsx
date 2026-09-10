"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { DeploymentActivityChart } from "@/components/charts/deployment-activity-chart";
import { EnvironmentChart } from "@/components/charts/environment-chart";
import { HealthChart } from "@/components/charts/health-chart";
import { SuccessFailureChart } from "@/components/charts/success-failure-chart";
import { DoraCards } from "@/components/metrics/dora-cards";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  buildEnvironmentComparison,
  buildSuccessFailureSeries,
} from "@/lib/analytics";
import { buildDoraMetrics } from "@/lib/dora";
import { percentLabel } from "@/lib/format";
import {
  buildActivitySeries,
  buildHealthBreakdown,
  buildWorkspaceMetrics,
  isFailed,
} from "@/lib/metrics";
import type { TimeRange } from "@/types";
import { useMemo, useState } from "react";

export default function AnalyticsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, reload } = useWorkspace(ready);
  const [range, setRange] = useState<TimeRange>("30d");
  const deployments = snapshot?.deployments ?? [];
  const metrics = useMemo(
    () =>
      snapshot
        ? buildWorkspaceMetrics(snapshot)
        : {
            applications: 0,
            deployments: 0,
            healthyApplications: 0,
            failedDeployments: 0,
            successRate: 0,
          },
    [snapshot],
  );
  const failureRate =
    deployments.length === 0
      ? 0
      : (deployments.filter(isFailed).length / deployments.length) * 100;

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Analytics"
        description="Delivery frequency, reliability, and environment comparison from recorded GitOps history."
        actions={
          <div className="flex gap-1">
            {(["7d", "30d", "90d"] as TimeRange[]).map((item) => (
              <button
                key={item}
                onClick={() => setRange(item)}
                className={`rounded-md px-2 py-1 text-xs ${
                  range === item ? "bg-teal-400/15 text-teal-200" : "text-zinc-400"
                }`}
              >
                {item.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Deployment frequency"
            value={metrics.deployments}
            hint="Total recorded deployments"
          />
          <MetricCard
            label="Success rate"
            value={percentLabel(metrics.successRate)}
            hint="Derived from workspace history"
          />
          <MetricCard
            label="Failure rate"
            value={percentLabel(failureRate)}
            hint="Failed or degraded outcomes"
          />
          <MetricCard
            label="Healthy applications"
            value={metrics.healthyApplications}
            hint="Latest health snapshot"
          />
        </div>
      )}

      <div className="mt-8">
        <DoraCards metrics={buildDoraMetrics(deployments)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Health trends">
          <HealthChart data={buildHealthBreakdown(deployments)} />
        </ChartCard>
        <ChartCard title="Success vs failure">
          <SuccessFailureChart data={buildSuccessFailureSeries(deployments, range)} />
        </ChartCard>
        <ChartCard title="Activity">
          {deployments.length === 0 ? (
            <EmptyState
              title="No analytics yet"
              description="Charts populate from application deployment timestamps."
            />
          ) : (
            <DeploymentActivityChart data={buildActivitySeries(deployments, range)} />
          )}
        </ChartCard>
        <ChartCard title="Environment comparison">
          <EnvironmentChart data={buildEnvironmentComparison(deployments)} />
        </ChartCard>
      </div>
    </div>
  );
}
