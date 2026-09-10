"use client";

import { ChartCard } from "@/components/charts/chart-card";
import { DeploymentActivityChart } from "@/components/charts/deployment-activity-chart";
import { DeploymentTable, DeploymentTimeline } from "@/components/deployments/deployment-table";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricSkeleton, Skeleton } from "@/components/ui/skeleton";
import { HealthBadge, SyncBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatRelative, percentLabel, toNumber } from "@/lib/format";
import { buildActivitySeries } from "@/lib/metrics";
import { getApplicationRepository } from "@/services/applications";
import { getOverview } from "@/services/dashboard";
import { createEnvironment, getEnvironments } from "@/services/environments";
import type {
  ApplicationOverview,
  ApplicationRepository,
  Environment,
  TimeRange,
} from "@/types";
import { ApiError } from "@/services/api";
import { use, useCallback, useEffect, useMemo, useState } from "react";

const tabs = ["Overview", "Deployments", "Environments", "Repository", "Events"] as const;
type Tab = (typeof tabs)[number];

export default function ApplicationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const applicationId = Number(id);
  const ready = useAuthGuard();
  const { applications } = useWorkspace(ready);
  const { push } = useToast();
  const application = applications.find((item) => item.id === applicationId);
  const [tab, setTab] = useState<Tab>("Overview");
  const [range, setRange] = useState<TimeRange>("30d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [envFilter, setEnvFilter] = useState("all");
  const [overview, setOverview] = useState<ApplicationOverview | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [repository, setRepository] = useState<ApplicationRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envName, setEnvName] = useState("");
  const [savingEnv, setSavingEnv] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, environmentData, repositoryData] = await Promise.all([
        getOverview(applicationId),
        getEnvironments(applicationId),
        getApplicationRepository(applicationId).catch(() => null),
      ]);
      setOverview(overviewData);
      setEnvironments(environmentData);
      setRepository(repositoryData);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Application details could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    if (!ready || Number.isNaN(applicationId)) return;
    void load();
  }, [ready, applicationId, load]);

  const timeline = overview?.timeline ?? [];
  const envNames = Array.from(
    new Set(
      timeline
        .map((item) => item.environment)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const rangeDays = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const rangeStart = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const filtered = timeline.filter((item) => {
    const statusOk =
      statusFilter === "all" ||
      item.status.toLowerCase().includes(statusFilter.toLowerCase());
    const envOk = envFilter === "all" || item.environment === envFilter;
    const time = item.deployedAt ? new Date(item.deployedAt).getTime() : 0;
    const inRange = !item.deployedAt || time >= rangeStart;
    return statusOk && envOk && inRange;
  });
  const activity = useMemo(
    () => buildActivitySeries(timeline, range),
    [range, timeline],
  );

  if (!ready) return null;

  async function addEnvironment() {
    if (!envName.trim()) return;
    setSavingEnv(true);
    try {
      await createEnvironment(envName.trim(), applicationId);
      setEnvName("");
      push("Environment created.", "success");
      const data = await getEnvironments(applicationId);
      setEnvironments(data);
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not create environment.", "error");
    } finally {
      setSavingEnv(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Application</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {application?.name || repository?.name || `Application ${applicationId}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {application?.description || "GitOps application details from live API data."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <HealthBadge value={application?.latestDeployment?.healthStatus} />
            <SyncBadge value={application?.latestDeployment?.syncStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setTab("Deployments")}>
            View deployments
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/8 p-1">
        {tabs.map((item) => (
          <button
            key={item}
            className={`rounded-lg px-3 py-2 text-sm ${
              tab === item ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {tab === "Overview" ? (
        loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricSkeleton key={index} />
            ))}
          </div>
        ) : overview ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Health"
                value={application?.latestDeployment?.healthStatus || "Unknown"}
              />
              <MetricCard
                label="Sync status"
                value={application?.latestDeployment?.syncStatus || "Unknown"}
              />
              <MetricCard
                label="Current revision"
                value={application?.latestDeployment?.revision?.slice(0, 10) || "—"}
              />
              <MetricCard
                label="Last deployment"
                value={formatRelative(application?.latestDeployment?.deployedAt)}
              />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MetricCard label="Total deployments" value={overview.stats.totalDeployments} />
              <MetricCard
                label="Success rate"
                value={`${percentLabel(toNumber(overview.stats.successRate))}`}
              />
              <MetricCard
                label="Failure rate"
                value={`${percentLabel(toNumber(overview.failureRate.failureRate))}`}
              />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/8 p-5 text-sm text-zinc-400">
                <p>Repository: {repository?.repoUrl || application?.repoUrl || "—"}</p>
                <p className="mt-2">Branch: {repository?.branch || application?.branch || "—"}</p>
                <p className="mt-2">Path: {repository?.path || application?.path || "—"}</p>
              </div>
              <ChartCard title="Recent activity">
                <DeploymentActivityChart data={activity} />
              </ChartCard>
            </div>
          </>
        ) : (
          <EmptyState
            title="No overview yet"
            description="Deployment stats appear after this application has recorded history."
          />
        )
      ) : null}

      {tab === "Deployments" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className="h-10 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
              value={envFilter}
              onChange={(event) => setEnvFilter(event.target.value)}
            >
              <option value="all">All environments</option>
              {envNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="success">Succeeded</option>
              <option value="fail">Failed</option>
              <option value="running">Running</option>
            </select>
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
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="No deployments in this filter"
              description="Try another environment, status, or time range."
            />
          ) : (
            <>
              <div className="rounded-xl border border-white/8 p-5">
                <DeploymentTable rows={filtered} />
              </div>
              <div className="rounded-xl border border-white/8 p-5">
                <h2 className="mb-4 text-sm font-medium">Timeline</h2>
                <DeploymentTimeline rows={filtered.slice(0, 12)} />
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === "Environments" ? (
        <div className="rounded-xl border border-white/8 p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Environment name"
              value={envName}
              onChange={(event) => setEnvName(event.target.value)}
            />
            <Button loading={savingEnv} onClick={() => void addEnvironment()}>
              Add environment
            </Button>
          </div>
          {environments.length === 0 ? (
            <EmptyState
              title="No environments"
              description="Add development, staging, or production to classify deployments."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {environments.map((environment) => (
                <li key={environment.id} className="rounded-lg border border-white/8 px-4 py-3">
                  <p className="text-sm font-medium">{environment.name}</p>
                  <p className="text-xs text-zinc-500">{formatRelative(environment.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "Repository" ? (
        <div className="rounded-xl border border-white/8 p-5 text-sm">
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">URL</dt>
                <dd className="mt-1 font-mono text-xs">
                  {repository?.repoUrl || application?.repoUrl || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Branch</dt>
                <dd className="mt-1">{repository?.branch || application?.branch || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Path</dt>
                <dd className="mt-1 font-mono text-xs">
                  {repository?.path || application?.path || "—"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      ) : null}

      {tab === "Events" ? (
        <EmptyState
          title="Events stream not available"
          description="Application events will appear here when the backend exposes an events API. No placeholder events are shown."
        />
      ) : null}
    </div>
  );
}
