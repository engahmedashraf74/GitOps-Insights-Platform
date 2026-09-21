"use client";

import { ApplicationCard } from "@/components/applications/application-card";
import { ConnectArgoEmptyState } from "@/components/integrations/connect-argo-empty-state";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PlanUsageBar } from "@/components/billing/plan-usage-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { isArgoConnected } from "@/lib/argo";
import { syncApplications } from "@/services/applications";
import { useToast } from "@/components/ui/toast";
import { Boxes, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

export default function ApplicationsPage() {
  const ready = useAuthGuard();
  const { loading, error, snapshot, applications, reload } = useWorkspace(ready);
  const { push } = useToast();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [syncing, setSyncing] = useState(false);
  const connected = isArgoConnected(snapshot);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return applications.filter(
      (application) =>
        application.name.toLowerCase().includes(q) ||
        (application.description || "").toLowerCase().includes(q) ||
        (application.repoUrl || "").toLowerCase().includes(q) ||
        (application.namespace || "").toLowerCase().includes(q),
    );
  }, [applications, query]);

  if (!ready) return null;

  async function onSync() {
    setSyncing(true);
    try {
      const result = await syncApplications();
      push(
        `Synced ${result.imported + result.updated} Argo CD applications.`,
        "success",
      );
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
        title="Applications"
        description="Imported from Argo CD. Health, sync, revision, and destination are observed — not managed here."
        actions={
          connected ? (
            <Button loading={syncing} onClick={() => void onSync()}>
              <RefreshCw size={14} className="mr-2" />
              Sync Applications
            </Button>
          ) : undefined
        }
      />
      {snapshot?.subscription ? (
        <div className="mb-5">
          <PlanUsageBar
            applications={snapshot.usage?.applications ?? applications.length}
            applicationLimit={snapshot.subscription.maxApplications}
            isPro={snapshot.subscription.isPro}
            status={snapshot.subscription.status}
            plan={snapshot.subscription.plan === "PRO" ? "pro" : "free"}
          />
        </div>
      ) : null}
      {connected ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            className="max-w-md flex-1"
            placeholder="Search applications"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex rounded-lg border border-white/10 p-1">
            <button
              className={`rounded-md px-3 py-1 text-xs ${view === "cards" ? "bg-white/10" : "text-zinc-400"}`}
              onClick={() => setView("cards")}
            >
              Cards
            </button>
            <button
              className={`rounded-md px-3 py-1 text-xs ${view === "table" ? "bg-white/10" : "text-zinc-400"}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      ) : !connected ? (
        <ConnectArgoEmptyState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes size={22} />}
          title="Connect Argo CD and sync applications"
          description="Applications are imported from Argo CD. Nothing is created manually."
          action={
            <Button loading={syncing} onClick={() => void onSync()}>
              Sync Applications
            </Button>
          }
        />
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Repository</th>
                <th className="px-3 py-3">Namespace</th>
                <th className="px-3 py-3">Health</th>
                <th className="px-3 py-3">Sync</th>
                <th className="px-3 py-3">Revision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((application) => (
                <tr key={application.id} className="border-b border-white/6">
                  <td className="px-3 py-3">{application.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-zinc-400">
                    {application.repoUrl || "—"}
                  </td>
                  <td className="px-3 py-3">{application.namespace || "—"}</td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      value={
                        application.healthStatus ||
                        application.latestDeployment?.healthStatus
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      value={
                        application.syncStatus ||
                        application.latestDeployment?.syncStatus
                      }
                    />
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {application.revision ||
                      application.latestDeployment?.revision ||
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
