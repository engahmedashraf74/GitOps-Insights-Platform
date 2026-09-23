import { MetricCard } from "@/components/ui/metric-card";
import { formatRelative, percentLabel } from "@/lib/format";
import type { DeploymentAnalysis } from "@/services/billing";

export function DeploymentIntelligencePanel({
  result,
}: {
  result: DeploymentAnalysis;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Deployments" value={result.deploymentCount} />
        <MetricCard label="Success rate" value={percentLabel(result.successRate)} />
        <MetricCard label="Failed deployments" value={result.failedDeploymentCount} />
        <MetricCard
          label="Last deployment"
          value={formatRelative(result.lastDeploymentAt)}
        />
        <MetricCard label="Risk score" value={result.riskScore} hint="0 is lower risk" />
        <MetricCard label="Stability score" value={result.stabilityScore} hint="0 to 100" />
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
