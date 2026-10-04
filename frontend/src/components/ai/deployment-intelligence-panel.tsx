import { MetricCard } from "@/components/ui/metric-card";
import { HealthBadge, StatusBadge, SyncBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatRelative, percentLabel, shortRevision } from "@/lib/format";
import {
  actionNotes,
  actionSteps,
  buildEvidence,
  compareLatestDeployments,
  newestDeployment,
  situationFor,
  whyItMatters,
  type Situation,
  type WindowStats,
} from "@/lib/intelligence";
import type { DeploymentAnalysis } from "@/services/billing";
import type { Application, ApplicationEvent, Deployment } from "@/types";

export type { WindowStats };

const situationCopy: Record<Situation, { label: string; tone: string }> = {
  healthy: { label: "Healthy", tone: "border-[var(--success)]/35 bg-[var(--success-bg)]" },
  degraded: { label: "Workload incident", tone: "border-[var(--danger)]/40 bg-[var(--danger-bg)]" },
  "sync-failed": { label: "Sync failed", tone: "border-[var(--danger)]/40 bg-[var(--danger-bg)]" },
  "out-of-sync": { label: "Out of sync", tone: "border-[var(--warning)]/40 bg-[var(--warning-bg)]" },
  progressing: { label: "Progressing", tone: "border-[var(--warning)]/35 bg-[var(--warning-bg)]" },
  unknown: { label: "Health not reported", tone: "border-[var(--border)] bg-[var(--elevated)]" },
};

export function DeploymentIntelligencePanel({
  application,
  result,
  stats,
  events,
  deployments,
  loadedAt,
}: {
  application?: Application;
  result: DeploymentAnalysis;
  stats: WindowStats | null;
  events: ApplicationEvent[];
  deployments: Deployment[];
  loadedAt: string | null;
}) {
  const situation = situationFor(result.healthStatus, result.syncStatus, result.rootCause);
  const frame = situationCopy[situation];
  const calm =
    situation === "healthy" &&
    result.rootCause.toLowerCase().includes("no obvious deployment problem");
  const latest = newestDeployment(deployments);
  const evidence = buildEvidence(result, events, latest);
  const steps = actionSteps(result.recommendedFix, calm);
  const notes = actionNotes(result.recommendations, result.recommendedFix);
  const comparison = compareLatestDeployments(deployments);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Deployment intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">
            {application?.name || "Application"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            What is failing, which stored signal supports it, and what to check next.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <HealthBadge value={result.healthStatus} />
          <SyncBadge value={result.syncStatus} />
          {application?.namespace ? <span>{application.namespace}</span> : null}
          <span>Observed from Argo CD</span>
          {loadedAt ? <span>Loaded {formatDateTime(loadedAt)}</span> : null}
        </div>
      </header>

      {stats ? (
        <section aria-label="Operational summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Deployment risk" value={stats.riskScore} hint="0 is lower risk" />
          <MetricCard label="Stability" value={stats.stabilityScore} hint="0 to 100" />
          <MetricCard
            label="Success rate"
            value={percentLabel(stats.successRate)}
            hint={`${stats.successfulDeployments} succeeded of ${stats.deploymentCount}`}
          />
          <MetricCard label="Failed deployments" value={stats.failedDeploymentCount} hint="In this window" />
          <MetricCard label="Last deployment" value={formatRelative(stats.lastDeploymentAt)} />
        </section>
      ) : (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-medium text-[var(--text)]">No deployments in this window</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Risk, stability, and success rate are calculated from stored deployments in the
            selected namespace and time window. Widen the window or choose another namespace.
          </p>
        </section>
      )}

      <section className={`rounded-xl border p-5 ${frame.tone}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text)]">Deployment intelligence</h2>
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {frame.label}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Current state
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <HealthBadge value={result.healthStatus} />
              <SyncBadge value={result.syncStatus} />
              {latest ? (
                <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  Newest result
                  <StatusBadge value={latest.status || "Not recorded"} />
                </span>
              ) : null}
            </div>
            <h3 className="mt-5 text-sm font-medium text-[var(--text)]">Primary diagnosis</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text)]">{result.rootCause}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {whyItMatters(result.healthStatus, result.syncStatus, result.rootCause)}
            </p>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Confidence {result.confidence}. Diagnosis uses the current Argo CD health and sync
              plus stored events, not only the selected time window.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[var(--text)]">Evidence</h3>
            {evidence.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                No health, sync, or matching event signal is stored.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {evidence.map((item) => (
                  <li key={`${item.signal}-${item.value}`} className="text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        {item.signal}
                      </span>
                      <span className="text-[var(--text)]">{item.value}</span>
                    </div>
                    <p className="mt-1 text-[var(--text-secondary)]">↓ {item.interpretation}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">What to do next</h2>
        {calm ? (
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            No specific workload or sync failure is stored for the current application.
            {result.rootCause ? ` ${result.rootCause}` : ""}
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-[var(--text)]">
                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--elevated)] text-[11px] text-[var(--text-secondary)]">
                  {index + 1}
                </span>
                <span>
                  <span className="mr-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Priority {index + 1}
                  </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        )}
        {notes.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-[var(--text-secondary)]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {comparison ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">What changed</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Newest stored revision {shortRevision(comparison.currentRevision)} compared with{" "}
            {shortRevision(comparison.previousRevision)}. Risk and stability are window scores,
            not per-revision scores, so they are not compared. Git file diffs are not stored.
          </p>
          {comparison.changes.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-[var(--text)]">
              {comparison.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No recorded field differs. Health or sync marked Not recorded was not snapshotted
              for that revision.
            </p>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-2 pr-3 font-medium">Field</th>
                  <th className="py-2 pr-3 font-medium">Previous</th>
                  <th className="py-2 font-medium">Current</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.label} className="border-b border-[var(--border)]">
                    <th className="py-2 pr-3 text-left font-medium text-[var(--text-secondary)]">
                      {row.label}
                    </th>
                    <td className="py-2 pr-3 font-mono text-xs text-[var(--text)]">{row.previous}</td>
                    <td className="py-2 font-mono text-xs text-[var(--text)]">{row.current}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text)]">What changed</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Comparison unavailable. At least two stored deployments are required.
          </p>
        </section>
      )}
    </div>
  );
}
