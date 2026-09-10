"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { ChartCard } from "@/components/charts/chart-card";
import { DeploymentActivityChart } from "@/components/charts/deployment-activity-chart";
import { HealthChart } from "@/components/charts/health-chart";
import { DeploymentTable } from "@/components/deployments/deployment-table";
import { DoraCards } from "@/components/metrics/dora-cards";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { buildDoraMetrics } from "@/lib/dora";
import {
  buildActivitySeries,
  buildHealthBreakdown,
  buildWorkspaceMetrics,
} from "@/lib/metrics";
import { insightPlaceholders } from "@/mock/demo-data";
import { percentLabel } from "@/lib/format";
import type { TimeRange } from "@/types";
import { Boxes } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const [range, setRange] = useState<TimeRange>("7d");

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
  const activity = useMemo(
    () => buildActivitySeries(snapshot?.deployments ?? [], range),
    [range, snapshot],
  );
  const health = useMemo(
    () => buildHealthBreakdown(snapshot?.deployments ?? []),
    [snapshot],
  );
  const dora = useMemo(
    () => buildDoraMetrics(snapshot?.deployments ?? []),
    [snapshot],
  );
  const recent = [...(snapshot?.deployments ?? [])]
    .sort(
      (a, b) =>
        new Date(b.deployedAt ?? 0).getTime() -
        new Date(a.deployedAt ?? 0).getTime(),
    )
    .slice(0, 8);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Overview"
        description="Monitor your GitOps delivery health across environments."
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Applications" value={metrics.applications} hint="In this workspace" />
          <MetricCard label="Deployments" value={metrics.deployments} hint="Recorded history" />
          <MetricCard
            label="Healthy applications"
            value={metrics.healthyApplications}
            hint="Latest health is Healthy"
          />
          <MetricCard
            label="Failed deployments"
            value={metrics.failedDeployments}
            hint="Failed or degraded"
          />
          <MetricCard
            label="Success rate"
            value={percentLabel(metrics.successRate)}
            hint="From recorded outcomes"
          />
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-zinc-200">DORA metrics</h2>
        <DoraCards metrics={dora} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Deployment activity"
            description="Volume of recorded deployments over the selected window."
            actions={
              <div className="flex gap-1">
                {(["7d", "30d", "90d"] as TimeRange[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setRange(item)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      range === item
                        ? "bg-teal-400/15 text-teal-200"
                        : "text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          >
            {activity.every((point) => point.deployments === 0) ? (
              <EmptyState
                title="No deployment activity"
                description="Activity appears after applications record deployments with timestamps."
              />
            ) : (
              <DeploymentActivityChart data={activity} />
            )}
          </ChartCard>
        </div>
        <ChartCard title="Deployment health" description="Latest health by application.">
          {health.healthy + health.degraded + health.progressing === 0 ? (
            <EmptyState
              title="No health signals"
              description="Health badges populate from Argo CD-backed deployment records."
            />
          ) : (
            <HealthChart data={health} />
          )}
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-white/8 bg-[#111113]/80 p-5">
          <h2 className="mb-4 text-sm font-medium">Recent deployments</h2>
          {recent.length === 0 ? (
            <EmptyState
              title="No deployments yet"
              description="Recorded revisions will show up here with status, sync, and health."
              action={
                <Link href="/applications" className="text-sm text-teal-300">
                  View applications
                </Link>
              }
            />
          ) : (
            <DeploymentTable
              rows={recent}
              applicationName={(id) =>
                applications.find((application) => application.id === id)?.name ||
                "Application"
              }
            />
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-sm font-medium">Application health</h2>
          {applications.length === 0 ? (
            <EmptyState
              icon={<Boxes size={20} />}
              title="No applications"
              description="Create a project, then add applications to start tracking GitOps health."
            />
          ) : (
            applications.slice(0, 4).map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Insights</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {insightPlaceholders.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] p-5"
            >
              <p className="text-sm font-medium text-zinc-100">{item.title}</p>
              <p className="mt-2 text-sm text-zinc-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
