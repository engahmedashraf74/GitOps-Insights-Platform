"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { DeploymentTable } from "@/components/deployments/deployment-table";
import { PlanUsageBar } from "@/components/billing/plan-usage-bar";
import { ConnectArgoEmptyState } from "@/components/integrations/connect-argo-empty-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { isArgoConnected } from "@/lib/argo";
import { buildWorkspaceMetrics } from "@/lib/metrics";
import { syncApplications } from "@/services/applications";
import { Boxes, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function DashboardPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const { push } = useToast();
  const [syncing, setSyncing] = useState(false);
  const connected = isArgoConnected(snapshot);

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
  const recent = [...(snapshot?.deployments ?? [])]
    .sort(
      (a, b) =>
        new Date(b.deployedAt ?? 0).getTime() -
        new Date(a.deployedAt ?? 0).getTime(),
    )
    .slice(0, 8);

  if (!ready) return null;

  async function onSync() {
    setSyncing(true);
    try {
      await syncApplications();
      push("Applications refreshed from Argo CD.", "success");
      reload();
    } catch (err) {
      push(err instanceof Error ? err.message : "Sync failed.", "error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Overview"
        description="Observability for applications imported from Argo CD."
        actions={
          connected ? (
            <Button variant="secondary" loading={syncing} onClick={() => void onSync()}>
              <RefreshCw size={14} className="mr-2" />
              Sync Applications
            </Button>
          ) : undefined
        }
      />

      {snapshot?.subscription ? (
        <div className="mb-6">
          <PlanUsageBar
            applications={snapshot.usage?.applications ?? applications.length}
            applicationLimit={snapshot.subscription.maxApplications}
            isPro={snapshot.subscription.isPro}
            status={snapshot.subscription.status}
            plan={snapshot.subscription.plan === "PRO" ? "pro" : "free"}
          />
        </div>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : !connected ? (
        <ConnectArgoEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Applications" value={metrics.applications} hint="In this workspace" />
          <MetricCard label="Deployments" value={metrics.deployments} hint="Recorded history" />
          <MetricCard
            label="Healthy applications"
            value={metrics.healthyApplications}
            hint="Latest health is Healthy"
          />
        </div>
      )}

      {connected && !error && !loading ? (
      <>
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
              description="Sync Argo CD to import applications and start tracking health."
            />
          ) : (
            applications.slice(0, 4).map((application) => (
              <ApplicationCard key={application.id} application={application} />
            ))
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">AI Analysis</h2>
        {snapshot?.subscription?.aiFeatures ? (
          <Link
            href="/ai"
            className="block rounded-xl border border-teal-400/20 bg-teal-400/5 p-5 text-sm text-teal-200"
          >
            Open AI Deployment Analysis for risk, recommendations, and deployment history.
          </Link>
        ) : (
          <div className="rounded-xl border border-white/8 p-5 text-sm text-zinc-400">
            AI Deployment Analysis is included with Pro.{" "}
            <Link href="/upgrade" className="text-teal-300">
              Upgrade to Pro
            </Link>
          </div>
        )}
      </section>
      </>
      ) : null}
    </div>
  );
}
