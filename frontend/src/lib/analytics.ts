import type {
  Deployment,
  EnvironmentComparison,
  SuccessFailurePoint,
  TimeRange,
} from "@/types";
import { isFailed, isSucceeded } from "./metrics";

export function buildSuccessFailureSeries(
  deployments: Deployment[],
  range: TimeRange,
): SuccessFailurePoint[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const today = startOfDay(new Date());
  const buckets = new Map<string, SuccessFailurePoint>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = keyFor(date);
    buckets.set(key, {
      label: range === "7d" ? weekday(key) : shortDate(key),
      succeeded: 0,
      failed: 0,
    });
  }

  for (const deployment of deployments) {
    if (!deployment.deployedAt) continue;
    const key = keyFor(startOfDay(new Date(deployment.deployedAt)));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (isFailed(deployment)) bucket.failed += 1;
    else if (isSucceeded(deployment)) bucket.succeeded += 1;
  }

  return Array.from(buckets.values());
}

export function buildEnvironmentComparison(
  deployments: Deployment[],
): EnvironmentComparison[] {
  const map = new Map<string, EnvironmentComparison>();
  for (const deployment of deployments) {
    const environment = deployment.environment?.trim() || "Unspecified";
    const current = map.get(environment) ?? {
      environment,
      deployments: 0,
      failures: 0,
    };
    current.deployments += 1;
    if (isFailed(deployment)) current.failures += 1;
    map.set(environment, current);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.deployments - a.deployments,
  );
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function keyFor(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekday(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    new Date(`${isoDate}T00:00:00`),
  );
}

function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}
