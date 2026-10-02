import type {
  ActivityPoint,
  Application,
  Deployment,
  HealthBreakdown,
  Project,
  TimeRange,
  WorkspaceMetrics,
} from "@/types";
import { toNumber } from "./format";

export interface WorkspaceSnapshot {
  projects: Project[];
  applications: Application[];
  deployments: Deployment[];
  argocd?: {
    connected: boolean;
    url: string | null;
    lastSyncedAt: string | null;
  };
  subscription?: {
    plan: "FREE" | "PRO";
    status: string;
    isPro: boolean;
    maxApplications: number;
    historyDays: number | null;
    fullAnalytics: boolean;
    fullHistory: boolean;
    aiFeatures: boolean;
  };
  usage?: {
    applications: number;
    applicationLimit: number;
  };
}

export function buildWorkspaceMetrics(
  snapshot: WorkspaceSnapshot,
): WorkspaceMetrics {
  const deployments = snapshot.deployments;
  const failedDeployments = deployments.filter((item) =>
    isFailed(item),
  ).length;
  const succeeded = deployments.filter((item) => isSucceeded(item)).length;
  const successRate =
    deployments.length === 0 ? 0 : (succeeded / deployments.length) * 100;

  const latestByApp = new Map<number, Deployment>();
  for (const deployment of deployments) {
    const appId = deployment.applicationId;
    if (!appId) continue;
    const current = latestByApp.get(appId);
    if (!current || newer(deployment.deployedAt, current.deployedAt)) {
      latestByApp.set(appId, deployment);
    }
  }

  let healthyApplications = 0;
  for (const application of snapshot.applications) {
    const latest = latestByApp.get(application.id);
    if (
      normalizeHealth(application.healthStatus || latest?.healthStatus) ===
      "Healthy"
    ) {
      healthyApplications += 1;
    }
  }

  return {
    applications: snapshot.applications.length,
    deployments: deployments.length,
    healthyApplications,
    failedDeployments,
    successRate,
  };
}

export function buildActivitySeries(
  deployments: Deployment[],
  range: TimeRange,
): ActivityPoint[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const buckets = new Map<string, number>();
  const today = startOfDay(new Date());

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    buckets.set(keyFor(date), 0);
  }

  for (const deployment of deployments) {
    if (!deployment.deployedAt) continue;
    const date = startOfDay(new Date(deployment.deployedAt));
    const key = keyFor(date);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([label, count]) => ({
    label: range === "7d" ? weekday(label) : shortDate(label),
    deployments: count,
  }));
}

export function buildHealthBreakdown(
  deployments: Deployment[],
): HealthBreakdown {
  const latestByApp = new Map<number, Deployment>();
  for (const deployment of deployments) {
    const appId = deployment.applicationId ?? 0;
    const current = latestByApp.get(appId);
    if (!current || newer(deployment.deployedAt, current.deployedAt)) {
      latestByApp.set(appId, deployment);
    }
  }

  const breakdown: HealthBreakdown = {
    healthy: 0,
    degraded: 0,
    progressing: 0,
  };

  for (const deployment of latestByApp.values()) {
    const health = normalizeHealth(deployment.healthStatus);
    if (health === "Healthy") breakdown.healthy += 1;
    else if (health === "Degraded") breakdown.degraded += 1;
    else if (health === "Progressing") breakdown.progressing += 1;
  }

  return breakdown;
}

export function normalizeHealth(value?: string | null): string {
  return value?.trim() || "Unknown";
}

export function normalizeSync(value?: string | null): string {
  return value?.trim() || "Unknown";
}

export type DeploymentOutcome = "success" | "failed" | "unknown";

const FAILED_RESULTS = new Set(["failed", "failure", "error", "errored"]);

const SUCCESS_RESULTS = new Set(["succeeded", "success", "successful"]);

/**
 * Outcome comes from the stored Result. Health is used only when Result is
 * absent, so a Succeeded revision is not also counted as failed because the
 * current application is Degraded.
 */
export function classifyDeployment(deployment: Deployment): DeploymentOutcome {
  const status = (deployment.status ?? "").trim().toLowerCase();
  const health = normalizeHealth(deployment.healthStatus).toLowerCase();

  if (FAILED_RESULTS.has(status)) return "failed";
  if (SUCCESS_RESULTS.has(status)) return "success";
  if (health === "degraded") return "failed";
  if (health === "healthy") return "success";
  return "unknown";
}

export function isFailed(deployment: Deployment): boolean {
  return classifyDeployment(deployment) === "failed";
}

export function isSucceeded(deployment: Deployment): boolean {
  return classifyDeployment(deployment) === "success";
}

function newer(a?: string, b?: string): boolean {
  return new Date(a ?? 0).getTime() > new Date(b ?? 0).getTime();
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function keyFor(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

export function parseSuccessRate(value: number | string | undefined): number {
  return toNumber(value);
}
