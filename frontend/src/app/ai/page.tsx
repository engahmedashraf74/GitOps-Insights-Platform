"use client";

import { DeploymentIntelligencePanel } from "@/components/ai/deployment-intelligence-panel";
import { SuccessFailureChart } from "@/components/charts/success-failure-chart";
import { DeploymentHistoryTable } from "@/components/deployments/deployment-table";
import { EventExplorer } from "@/components/events/event-explorer";
import { UpgradeBadge } from "@/components/billing/plan-badges";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  buildOutcomeSeries,
  buildWindowStats,
  failureDirection,
  type HistoryWindow,
} from "@/lib/intelligence";
import { analyzeDeployment, type DeploymentAnalysis } from "@/services/billing";
import { ApiError } from "@/services/api";
import { getApplicationEvents } from "@/services/applications";
import { getDeployments } from "@/services/deployments";
import type { ApplicationEvent, Deployment } from "@/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  const [historyError, setHistoryError] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [windowRange, setWindowRange] = useState<HistoryWindow>("30d");
  const [environment, setEnvironment] = useState("all");

  useEffect(() => {
    if (!isPro || applications.length === 0) return;
    const requested = Number(new URLSearchParams(window.location.search).get("applicationId"));
    setApplicationId((current) => {
      if (applications.some((application) => application.id === requested)) return requested;
      return current ?? applications[0].id;
    });
  }, [applications, isPro]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void analyzeDeployment(applicationId)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setLoadedAt(new Date().toISOString());
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(null);
        if (err instanceof ApiError && err.status === 403) {
          setError("Deployment intelligence requires Pro.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load deployment intelligence.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready, reloadToken]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    setHistoryError("");
    void getDeployments(applicationId)
      .then((rows) => {
        if (!cancelled) setDeployments(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDeployments([]);
        setHistoryError(err instanceof Error ? err.message : "Deployment history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready, reloadToken]);

  useEffect(() => {
    if (!ready || !isPro || applicationId == null) return;
    let cancelled = false;
    setEventsError("");
    void getApplicationEvents(applicationId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEvents([]);
        setEventsError(err instanceof Error ? err.message : "Application events could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, isPro, ready, reloadToken]);

  const application = applications.find((item) => item.id === applicationId);
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
    () => buildWindowStats(filtered, result, events),
    [events, filtered, result],
  );
  const outcomes = useMemo(
    () => buildOutcomeSeries(filtered, windowRange),
    [filtered, windowRange],
  );
  const direction = useMemo(() => failureDirection(filtered), [filtered]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-7xl">
      {isPro ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="block max-w-md text-sm text-[var(--text-secondary)]">
              Application
              <select
                className="mt-2 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
                value={applicationId ?? ""}
                onChange={(event) => setApplicationId(Number(event.target.value))}
                disabled={applications.length === 0}
              >
                {applications.length === 0 ? (
                  <option value="">No applications</option>
                ) : (
                  applications.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            {applicationId != null ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  aria-label="Namespace"
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]"
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
                <div className="flex gap-1" role="group" aria-label="History window">
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
                      aria-pressed={windowRange === value}
                      onClick={() => setWindowRange(value)}
                      className={`rounded-md px-2 py-1 text-xs ${
                        windowRange === value
                          ? "bg-[var(--accent-dim)] text-[var(--accent-strong)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {applicationId != null ? (
            <p className="text-xs text-[var(--text-muted)]">
              The window filters stored deployment history. Diagnosis still uses the current
              application and stored events. All time is the history this API returns, not the
              full Argo CD history.
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
              Loading deployment intelligence…
            </p>
          ) : null}
          {error ? (
            <ErrorState message={error} onRetry={() => setReloadToken((value) => value + 1)} />
          ) : null}
          {!loading && !error && result ? (
            <DeploymentIntelligencePanel
              application={application}
              result={result}
              stats={stats}
              events={events}
              deployments={filtered}
              storedDeployments={deployments}
              loadedAt={loadedAt}
            />
          ) : null}
          {applicationId != null && !historyError ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="text-sm font-semibold text-[var(--text)]">Outcome trend</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Succeeded and failed results from stored deployments. Days without a deployment
                are 0. A result that is neither success nor failure is omitted from both series.
              </p>
              {direction ? (
                <p className="mt-3 text-sm text-[var(--text)]">{direction}</p>
              ) : null}
              {filtered.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  No stored deployments in this window, so there is no trend to plot.
                </p>
              ) : (
                <div className="mt-4">
                  <SuccessFailureChart data={outcomes} />
                </div>
              )}
            </section>
          ) : null}
          {historyError ? (
            <ErrorState
              title="Deployment history could not be loaded"
              message={historyError}
              onRetry={() => setReloadToken((value) => value + 1)}
            />
          ) : null}
          {applicationId != null && !historyError ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">Deployment history</h2>
              <p className="mb-4 text-xs text-[var(--text-muted)]">
                Newest first. Not recorded means health or sync was never snapshotted. Unknown
                is a value Argo CD reported.
              </p>
              {filtered.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  No deployment history is stored for this filter.
                </p>
              ) : (
                <DeploymentHistoryTable rows={filtered} />
              )}
            </section>
          ) : null}
          {eventsError ? (
            <ErrorState
              title="Events could not be loaded"
              message={eventsError}
              onRetry={() => setReloadToken((value) => value + 1)}
            />
          ) : null}
          {applicationId != null && !eventsError ? (
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-4 text-sm font-semibold text-[var(--text)]">Event explorer</h2>
              <EventExplorer rows={events} />
            </section>
          ) : null}
          {!loading && !error && !result && applications.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">No applications found.</p>
          ) : null}
        </div>
      ) : (
        <div>
          <PageHeader
            title="Deployment intelligence"
            description="Failure diagnosis, evidence, and deployment history for a selected application."
          />
          <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-dim)] p-6">
            <UpgradeBadge />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Free workspaces cannot access deployment intelligence. Upgrade to Pro for risk,
              stability, evidence-backed diagnosis, and deployment history.
            </p>
            <Link href="/upgrade" className="mt-4 inline-block">
              <Button>Upgrade to Pro</Button>
            </Link>
          </div>
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
