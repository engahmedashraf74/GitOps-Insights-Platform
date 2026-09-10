"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { DeploymentActivityChart } from "@/components/charts/deployment-activity-chart";
import { SuccessFailureChart } from "@/components/charts/success-failure-chart";
import { DeploymentTable } from "@/components/deployments/deployment-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildSuccessFailureSeries } from "@/lib/analytics";
import { percentLabel } from "@/lib/format";
import { buildActivitySeries, isFailed, isSucceeded } from "@/lib/metrics";
import type { TimeRange } from "@/types";
import { Activity } from "lucide-react";
import { useMemo, useState } from "react";

export default function DeploymentsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const [range, setRange] = useState<TimeRange>("30d");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const deployments = snapshot?.deployments ?? [];
  const succeeded = deployments.filter(isSucceeded).length;
  const failed = deployments.filter(isFailed).length;
  const latest = [...deployments].sort(
    (a, b) =>
      new Date(b.deployedAt ?? 0).getTime() -
      new Date(a.deployedAt ?? 0).getTime(),
  )[0];
  const activity = useMemo(
    () => buildActivitySeries(deployments, range),
    [deployments, range],
  );
  const successFailure = useMemo(
    () => buildSuccessFailureSeries(deployments, range),
    [deployments, range],
  );
  const rows = deployments.filter((item) => {
    const q = query.toLowerCase();
    const appName =
      applications.find((application) => application.id === item.applicationId)
        ?.name || "";
    const matchesQuery =
      item.revision.toLowerCase().includes(q) ||
      appName.toLowerCase().includes(q) ||
      (item.environment || "").toLowerCase().includes(q);
    const matchesStatus =
      status === "all" ||
      (status === "failed" && isFailed(item)) ||
      (status === "succeeded" && isSucceeded(item));
    return matchesQuery && matchesStatus;
  });

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Deployments"
        description="Operational history across applications, including frequency and recent failures."
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="History" value={deployments.length} hint="All recorded deployments" />
          <MetricCard label="Successful" value={succeeded} hint="Healthy or succeeded" />
          <MetricCard label="Failed" value={failed} hint="Failed or degraded" />
          <MetricCard
            label="Latest"
            value={latest?.revision?.slice(0, 8) || "—"}
            hint={latest?.environment || "No deployments yet"}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Deployments over time"
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
        >
          <DeploymentActivityChart data={activity} />
        </ChartCard>
        <ChartCard title="Success vs failure">
          <SuccessFailureChart data={successFailure} />
        </ChartCard>
      </div>

      <div className="mt-6 rounded-xl border border-white/8 bg-[#111113]/80 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <SearchInput
            className="max-w-md flex-1"
            placeholder="Filter by application, revision, or environment"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-10 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="succeeded">Successful</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Activity size={22} />}
            title="No matching deployments"
            description="Adjust filters or record deployments against an application."
          />
        ) : (
          <DeploymentTable
            rows={rows}
            applicationName={(id) =>
              applications.find((application) => application.id === id)?.name ||
              "Application"
            }
          />
        )}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Success rate in this view is {percentLabel(deployments.length ? (succeeded / deployments.length) * 100 : 0)}.
      </p>
    </div>
  );
}
