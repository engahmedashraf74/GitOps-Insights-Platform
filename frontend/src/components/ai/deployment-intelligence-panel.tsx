import { MetricCard } from "@/components/ui/metric-card";
import { formatRelative, percentLabel } from "@/lib/format";
import type { DeploymentAnalysis } from "@/services/billing";

export function DeploymentIntelligencePanel({
  result,
  stats,
}: {
  result: DeploymentAnalysis;
  stats: {
    deploymentCount: number;
    successfulDeployments: number;
    successRate: number;
    failedDeploymentCount: number;
    lastDeploymentAt: string | null;
    riskScore: number;
    stabilityScore: number;
  };
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Total deployments" value={stats.deploymentCount} />
        <MetricCard label="Successful deployments" value={stats.successfulDeployments} />
        <MetricCard label="Failed deployments" value={stats.failedDeploymentCount} />
        <MetricCard label="Success rate" value={percentLabel(stats.successRate)} />
        <MetricCard
          label="Last deployment"
          value={formatRelative(stats.lastDeploymentAt)}
        />
        <MetricCard label="Risk score" value={stats.riskScore} hint="0 is lower risk" />
        <MetricCard label="Stability score" value={stats.stabilityScore} hint="0 to 100" />
      </div>
      <section className="rounded-xl border border-white/8 p-5">
        <h2 className="text-sm font-medium text-zinc-100">AI recommendations</h2>
        <p className="mt-2 text-sm text-zinc-400">{result.rootCause}</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-200">
          {result.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">Confidence {result.confidence}</p>
      </section>
    </div>
  );
}
