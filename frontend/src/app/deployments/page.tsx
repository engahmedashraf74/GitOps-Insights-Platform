"use client";

import { DeploymentTable } from "@/components/deployments/deployment-table";
import { ConnectArgoEmptyState } from "@/components/integrations/connect-argo-empty-state";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { isArgoConnected } from "@/lib/argo";
import { isFailed, isSucceeded } from "@/lib/metrics";
import { Activity } from "lucide-react";
import { useState } from "react";

export default function DeploymentsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const deployments = snapshot?.deployments ?? [];
  const latest = [...deployments].sort(
    (a, b) =>
      new Date(b.deployedAt ?? 0).getTime() -
      new Date(a.deployedAt ?? 0).getTime(),
  )[0];
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

  const connected = isArgoConnected(snapshot);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Deployments"
        description="Revision history imported from Argo CD applications."
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      ) : !connected ? (
        <ConnectArgoEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard label="History" value={deployments.length} hint="All recorded deployments" />
          <MetricCard
            label="Latest"
            value={latest?.revision?.slice(0, 8) || "—"}
            hint={latest?.environment || "No deployments yet"}
          />
        </div>
      )}

      {connected && !error && !loading ? (
      <>
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
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
      </>
      ) : null}
    </div>
  );
}
