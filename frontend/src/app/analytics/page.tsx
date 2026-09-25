"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { DeploymentActivityChart } from "@/components/charts/deployment-activity-chart";
import { EnvironmentChart } from "@/components/charts/environment-chart";
import { ConnectArgoEmptyState } from "@/components/integrations/connect-argo-empty-state";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { MetricSkeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { isArgoConnected } from "@/lib/argo";
import { buildEnvironmentComparison } from "@/lib/analytics";
import { buildActivitySeries } from "@/lib/metrics";
import type { TimeRange } from "@/types";
import { useMemo, useState } from "react";

export default function AnalyticsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, reload } = useWorkspace(ready);
  const [range, setRange] = useState<TimeRange>("7d");
  const deployments = snapshot?.deployments ?? [];
  const connected = isArgoConnected(snapshot);
  const volume = useMemo(
    () => buildActivitySeries(deployments, snapshot?.subscription?.fullAnalytics ? range : "7d"),
    [deployments, range, snapshot?.subscription?.fullAnalytics],
  );

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Analytics"
        description="Deployment volume and environment distribution from recorded history."
        actions={
          snapshot?.subscription?.fullAnalytics ? (
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
          ) : (
            <Link href="/upgrade" className="text-sm text-teal-300">
              Upgrade to Pro
            </Link>
          )
        }
      />
      {snapshot?.subscription && !snapshot.subscription.fullAnalytics ? (
        <p className="mb-4 rounded-lg border border-teal-400/20 bg-teal-400/5 px-3 py-2 text-sm text-zinc-300">
          Charts use the last 7 days on Free.{" "}
          <Link href="/upgrade" className="text-teal-300">
            Upgrade to Pro
          </Link>{" "}
          for a longer history window.
        </p>
      ) : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!error && !loading && !connected ? (
        <ConnectArgoEmptyState />
      ) : null}
      {loading ? (
        <MetricSkeleton />
      ) : connected ? (
        <MetricCard
          label="Deployment volume"
          value={volume.reduce((sum, point) => sum + point.deployments, 0)}
          hint="Recorded deployments in the selected window"
        />
      ) : null}

      {connected && !error && !loading ? (
      <>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Deployment volume">
          {deployments.length === 0 ? (
            <EmptyState
              title="No analytics yet"
              description="Volume appears after applications record deployments with timestamps."
            />
          ) : (
            <DeploymentActivityChart data={volume} />
          )}
        </ChartCard>
        <ChartCard title="Environment distribution">
          <EnvironmentChart data={buildEnvironmentComparison(deployments)} />
        </ChartCard>
      </div>
      </>
      ) : null}
    </div>
  );
}
