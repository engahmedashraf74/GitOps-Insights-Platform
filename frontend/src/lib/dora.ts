import type { DoraMetric, DoraMetrics, Deployment } from "@/types";
import { isFailed, isSucceeded } from "./metrics";
import { percentLabel } from "./format";

export function buildDoraMetrics(deployments: Deployment[]): DoraMetrics {
  const days = 7;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = deployments.filter((item) => {
    if (!item.deployedAt) return false;
    const time = new Date(item.deployedAt).getTime();
    return !Number.isNaN(time) && time >= cutoff;
  });
  const frequencyValue = recent.length / days;
  const failed = deployments.filter(isFailed).length;
  const failureRate =
    deployments.length === 0 ? 0 : (failed / deployments.length) * 100;
  const mttrHours = estimateMttrHours(deployments);

  return {
    deploymentFrequency: metric(
      "deploymentFrequency",
      "Deployment frequency",
      `${frequencyValue.toFixed(1)} / day`,
      "Derived from recorded deployments in the last 7 days.",
      "derived",
    ),
    leadTime: metric(
      "leadTime",
      "Lead time for changes",
      "Awaiting data",
      "Commit-to-deploy timestamps are not provided by the current API.",
      "unavailable",
    ),
    changeFailureRate: metric(
      "changeFailureRate",
      "Change failure rate",
      percentLabel(failureRate),
      "Derived from failed and degraded deployments in workspace history.",
      "derived",
    ),
    mttr: metric(
      "mttr",
      "Time to restore",
      mttrHours === null ? "Awaiting data" : `${mttrHours.toFixed(1)} h`,
      mttrHours === null
        ? "Restore intervals require a failed deployment followed by a successful one with timestamps."
        : "Estimated from failed-to-successful deployment pairs with timestamps.",
      mttrHours === null ? "unavailable" : "derived",
    ),
  };
}

function metric(
  key: DoraMetric["key"],
  label: string,
  value: string,
  hint: string,
  source: DoraMetric["source"],
): DoraMetric {
  return { key, label, value, hint, source };
}

function estimateMttrHours(deployments: Deployment[]): number | null {
  const sorted = [...deployments]
    .filter((item) => item.deployedAt)
    .sort(
      (a, b) =>
        new Date(a.deployedAt ?? 0).getTime() -
        new Date(b.deployedAt ?? 0).getTime(),
    );

  const recoveries: number[] = [];
  let lastFailure: number | null = null;

  for (const item of sorted) {
    const time = new Date(item.deployedAt ?? 0).getTime();
    if (Number.isNaN(time)) continue;
    if (isFailed(item)) {
      lastFailure = time;
      continue;
    }
    if (lastFailure !== null && isSucceeded(item) && time > lastFailure) {
      recoveries.push((time - lastFailure) / 36e5);
      lastFailure = null;
    }
  }

  if (recoveries.length === 0) return null;
  return recoveries.reduce((sum, value) => sum + value, 0) / recoveries.length;
}
