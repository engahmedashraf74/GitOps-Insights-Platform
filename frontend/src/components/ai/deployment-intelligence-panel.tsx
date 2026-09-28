import { MetricCard } from "@/components/ui/metric-card";
import { formatRelative, percentLabel } from "@/lib/format";
import type { DeploymentAnalysis } from "@/services/billing";

export interface WindowStats {
  deploymentCount: number;
  successfulDeployments: number;
  successRate: number;
  failedDeploymentCount: number;
  unclassifiedDeployments: number;
  lastDeploymentAt: string | null;
  riskScore: number;
  stabilityScore: number;
}

export function DeploymentIntelligencePanel({
  result,
  stats,
}: {
  result: DeploymentAnalysis;
  stats: WindowStats | null;
}) {
  return (
    <div className="space-y-6">
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Total deployments" value={stats.deploymentCount} />
          <MetricCard
            label="Successful deployments"
            value={stats.successfulDeployments}
            hint={
              stats.unclassifiedDeployments > 0
                ? `${stats.unclassifiedDeployments} without a recorded outcome`
                : undefined
            }
          />
          <MetricCard label="Failed deployments" value={stats.failedDeploymentCount} />
          <MetricCard label="Success rate" value={percentLabel(stats.successRate)} />
          <MetricCard
            label="Last deployment"
            value={formatRelative(stats.lastDeploymentAt)}
          />
          <MetricCard label="Risk score" value={stats.riskScore} hint="0 is lower risk" />
          <MetricCard label="Stability score" value={stats.stabilityScore} hint="0 to 100" />
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 p-5">
          <p className="text-sm text-zinc-300">No deployment data in this window.</p>
          <p className="mt-2 text-sm text-zinc-500">
            Scores are calculated from stored deployments. Select a wider time
            window or a different namespace.
          </p>
        </div>
      )}
      <section className="rounded-xl border border-white/8 p-5">
        <h2 className="text-sm font-medium text-zinc-100">Current application state</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-zinc-400">
            Health: <span className="text-zinc-200">{result.healthStatus || "—"}</span>
          </p>
          <p className="text-sm text-zinc-400">
            Sync: <span className="text-zinc-200">{result.syncStatus || "—"}</span>
          </p>
        </div>
        <h3 className="mt-5 text-sm font-medium text-zinc-100">Root cause</h3>
        <p className="mt-2 text-sm text-zinc-400">{result.rootCause}</p>
        {result.recommendations.length > 0 ? (
          <>
            <h3 className="mt-5 text-sm font-medium text-zinc-100">Recommended actions</h3>
            <ul className="mt-2 space-y-2 text-sm text-zinc-200">
              {result.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-4 text-xs text-zinc-500">
          Derived from current Argo CD health, sync, and all stored events and
          deployments for this application, not the selected time window.
          Confidence {result.confidence}.
        </p>
      </section>
    </div>
  );
}
