"use client";

import { DeploymentIntelligencePanel } from "@/components/ai/deployment-intelligence-panel";
import { DeploymentHistoryTable } from "@/components/deployments/deployment-table";
import { EventExplorer } from "@/components/events/event-explorer";
import { UpgradeBadge } from "@/components/billing/plan-badges";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  analyzeDeployment,
  type DeploymentAnalysis,
} from "@/services/billing";
import { ApiError } from "@/services/api";
import { getApplicationEvents } from "@/services/applications";
import { getDeployments } from "@/services/deployments";
import type { ApplicationEvent, Deployment } from "@/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HistoryWindow = "7d" | "30d" | "all";

export default function AiAnalysisPage() {
  const ready = useAuthGuard();
  const { snapshot, applications } = useWorkspace(ready);
  const isPro = Boolean(snapshot?.subscription?.isPro);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [result, setResult] = useState<DeploymentAnalysis | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [windowRange, setWindowRange] = useState<HistoryWindow>("30d");
  const [environment, setEnvironment] = useState("all");

  useEffect(() => {
    if (!isPro || applications.length === 0) return;
    setApplicationId((current) => current ?? applications[0].id);
  }, [applications, isPro]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void analyzeDeployment(applicationId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(null);
        if (err instanceof ApiError && err.status === 403) {
          setError("AI Deployment Analysis requires Pro.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load AI analysis.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    void getDeployments(applicationId)
      .then((rows) => {
        if (!cancelled) setDeployments(rows);
      })
      .catch(() => {
        if (!cancelled) setDeployments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    void getApplicationEvents(applicationId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready]);

  const environments = useMemo(
    () =>
      Array.from(
        new Set(
          deployments
            .map((row) => row.environment)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [deployments],
  );
  const filtered = useMemo(
    () =>
      deployments.filter((row) => {
        const envOk = environment === "all" || row.environment === environment;
        return envOk && inWindow(row.deployedAt, windowRange);
      }),
    [deployments, environment, windowRange],
  );
  const stats = useMemo(
    () => windowStats(filtered, result, events),
    [events, filtered, result],
  );

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="AI Deployment Analysis"
        description="Scores and recommendations from stored deployments and application events."
      />
      {isPro ? (
        <div className="space-y-6">
          <label className="block max-w-md text-sm text-zinc-400">
            Application
            <select
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-zinc-100"
              value={applicationId ?? ""}
              onChange={(event) => setApplicationId(Number(event.target.value))}
              disabled={applications.length === 0}
            >
              {applications.length === 0 ? (
                <option value="">No applications</option>
              ) : (
                applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.name}
                  </option>
                ))
              )}
            </select>
          </label>
          {applicationId != null ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                className="h-10 rounded-lg border border-white/10 bg-zinc-950/60 px-3 text-sm text-zinc-100"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              >
                <option value="all">All namespaces</option>
                {environments.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                {(
                  [
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["all", "All time"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWindowRange(value)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      windowRange === value ? "bg-teal-400/15 text-teal-200" : "text-zinc-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {loading ? <p className="text-sm text-zinc-300">Analyzing deployment...</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {!loading && !error && result ? (
            <DeploymentIntelligencePanel result={result} stats={stats} />
          ) : null}
          {applicationId != null ? (
            <section className="rounded-xl border border-white/8 p-5">
              <h2 className="mb-4 text-sm font-medium">Deployment history</h2>
              {filtered.length === 0 ? (
                <p className="text-sm text-zinc-500">No deployment history is stored for this filter.</p>
              ) : (
                <DeploymentHistoryTable rows={filtered} />
              )}
            </section>
          ) : null}
          {applicationId != null ? (
            <section className="rounded-xl border border-white/8 p-5">
              <h2 className="mb-4 text-sm font-medium">Event explorer</h2>
              <EventExplorer rows={events} />
            </section>
          ) : null}
          {!loading && !error && !result && applications.length === 0 ? (
            <p className="text-sm text-zinc-300">No applications found.</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-6">
          <UpgradeBadge />
          <p className="mt-3 text-sm text-zinc-300">
            Free workspaces cannot access AI Deployment Analysis. Upgrade to Pro
            for unlimited history and AI insights.
          </p>
          <Link href="/upgrade" className="mt-4 inline-block">
            <Button>Upgrade to Pro</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function inWindow(value: string | undefined, range: HistoryWindow): boolean {
  if (range === "all") return true;
  if (!value) return false;
  const days = range === "7d" ? 7 : 30;
  return new Date(value).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function windowStats(
  rows: Deployment[],
  result: DeploymentAnalysis | null,
  events: ApplicationEvent[],
) {
  const failed = rows.filter(isWindowFailed).length;
  const succeeded = rows.filter(isWindowSucceeded).length;
  const deploymentCount = rows.length;
  const successRate = deploymentCount === 0 ? 0 : Number(((succeeded / deploymentCount) * 100).toFixed(1));
  const health = (result?.healthStatus || "Unknown").toLowerCase();
  const sync = (result?.syncStatus || "Unknown").toLowerCase();
  const corpus = events.map((event) => `${event.type} ${event.message}`).join(" ").toLowerCase();
  let risk = 0;
  if (health === "missing") risk += 45;
  else if (health === "degraded") risk += 35;
  else if (health === "progressing") risk += 15;
  if (sync === "outofsync") risk += 20;
  if (deploymentCount > 0) risk += Math.round((failed / deploymentCount) * 30);
  if (
    corpus.includes("imagepullbackoff") ||
    corpus.includes("crashloopbackoff") ||
    corpus.includes("failedscheduling") ||
    corpus.includes("progressdeadlineexceeded")
  ) {
    risk += 15;
  }
  const riskScore = Math.max(0, Math.min(100, risk));
  const stabilityScore =
    deploymentCount === 0
      ? health === "healthy" && sync === "synced"
        ? 70
        : 40
      : Math.max(0, Math.min(100, Math.round(successRate * 0.7 + (100 - riskScore) * 0.3)));
  const last = [...rows].sort(
    (left, right) => new Date(right.deployedAt ?? 0).getTime() - new Date(left.deployedAt ?? 0).getTime(),
  )[0];
  return {
    deploymentCount,
    successfulDeployments: succeeded,
    successRate,
    failedDeploymentCount: failed,
    lastDeploymentAt: last?.deployedAt ?? null,
    riskScore,
    stabilityScore,
  };
}

function isWindowFailed(row: Deployment): boolean {
  const status = row.status?.toLowerCase() ?? "";
  const health = (row.healthStatus || "").toLowerCase();
  return status.includes("fail") || health === "degraded";
}

function isWindowSucceeded(row: Deployment): boolean {
  const status = row.status?.toLowerCase() ?? "";
  const health = (row.healthStatus || "").toLowerCase();
  return status.includes("success") && health !== "degraded";
}
