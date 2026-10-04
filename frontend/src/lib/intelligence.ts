import { shownResult, shownSnapshot } from "@/lib/deployment-display";
import { formatDateTime, formatUtcDateTime } from "@/lib/format";
import { classifyDeployment } from "@/lib/metrics";
import type { DeploymentAnalysis } from "@/services/billing";
import type { ApplicationEvent, Deployment, SuccessFailurePoint } from "@/types";

export type HistoryWindow = "7d" | "30d" | "all";

export type Situation =
  | "healthy"
  | "degraded"
  | "sync-failed"
  | "out-of-sync"
  | "progressing"
  | "unknown";

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

export interface EvidenceItem {
  signal: string;
  value: string;
  interpretation: string;
}

export interface ComparisonRow {
  label: string;
  previous: string;
  current: string;
  changed: boolean;
  previousTitle?: string;
  currentTitle?: string;
}

export interface RevisionComparison {
  previousRevision: string;
  currentRevision: string;
  rows: ComparisonRow[];
  changes: string[];
}

const IMAGE_PULL = [
  "imagepullbackoff",
  "errimagepull",
  "failed to pull image",
  "failed to pull and unpack image",
  "error pulling image",
  "back-off pulling image",
  "backoff pulling image",
];

export function buildWindowStats(
  rows: Deployment[],
  result: DeploymentAnalysis | null,
  events: ApplicationEvent[],
): WindowStats | null {
  const deploymentCount = rows.length;
  if (deploymentCount === 0) return null;

  const failed = rows.filter((row) => classifyDeployment(row) === "failed").length;
  const succeeded = rows.filter((row) => classifyDeployment(row) === "success").length;
  const successRate = Number(((succeeded / deploymentCount) * 100).toFixed(1));

  const health = (result?.healthStatus || "Unknown").toLowerCase();
  const sync = (result?.syncStatus || "Unknown").toLowerCase();
  const corpus = events
    .map((event) => `${event.type} ${event.message}`)
    .join(" ")
    .toLowerCase();

  let risk = 0;
  if (health === "missing") risk += 45;
  else if (health === "degraded") risk += 35;
  else if (health === "progressing") risk += 15;
  if (sync === "outofsync") risk += 20;
  if (deploymentCount > 0) {
    risk += Math.round((failed / deploymentCount) * 30);
  }
  if (
    corpus.includes("imagepullbackoff") ||
    corpus.includes("crashloopbackoff") ||
    corpus.includes("failedscheduling") ||
    corpus.includes("progressdeadlineexceeded")
  ) {
    risk += 15;
  }
  const riskScore = Math.max(0, Math.min(100, risk));
  const stabilityScore = Math.max(
    0,
    Math.min(100, Math.round(successRate * 0.7 + (100 - riskScore) * 0.3)),
  );

  const last = [...rows].sort(
    (left, right) =>
      new Date(right.deployedAt ?? 0).getTime() - new Date(left.deployedAt ?? 0).getTime(),
  )[0];

  return {
    deploymentCount,
    successfulDeployments: succeeded,
    successRate,
    failedDeploymentCount: failed,
    unclassifiedDeployments: deploymentCount - succeeded - failed,
    lastDeploymentAt: last?.deployedAt ?? null,
    riskScore,
    stabilityScore,
  };
}

export function situationFor(
  healthStatus: string,
  syncStatus: string,
  rootCause: string,
): Situation {
  const health = healthStatus.trim().toLowerCase();
  const sync = syncStatus.trim().toLowerCase();
  const cause = rootCause.toLowerCase();
  if (cause.includes("latest argo cd sync failed")) return "sync-failed";
  if (health === "degraded" || health === "missing") return "degraded";
  if (sync === "outofsync") return "out-of-sync";
  if (health === "progressing") return "progressing";
  if (health === "healthy") return "healthy";
  return "unknown";
}

export function whyItMatters(healthStatus: string, syncStatus: string, rootCause: string): string {
  const health = healthStatus.trim().toLowerCase();
  const sync = syncStatus.trim().toLowerCase();
  if (rootCause.toLowerCase().includes("latest argo cd sync failed")) {
    return "Argo CD did not finish applying the Git revision.";
  }
  if (health === "degraded" && sync === "synced") {
    return "The Git revision was applied. The workload is unhealthy, so this is not a failed sync.";
  }
  if (health === "missing") {
    return "A resource declared for this application is not present in the cluster.";
  }
  if (sync === "outofsync") {
    return "The cluster does not match the Git revision Argo CD is tracking.";
  }
  if (health === "progressing") {
    return "The rollout is still in progress. Health can still change.";
  }
  if (health === "healthy" && sync === "synced") {
    return "Argo CD reports the application healthy and synced.";
  }
  if (!health || health === "unknown") {
    return "Argo CD has not reported health for the current application.";
  }
  return rootCause;
}

export function buildEvidence(
  result: Pick<DeploymentAnalysis, "healthStatus" | "syncStatus">,
  events: ApplicationEvent[],
  latest: Deployment | null,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  if (result.healthStatus.trim()) {
    items.push({
      signal: "Health",
      value: result.healthStatus,
      interpretation: healthMeaning(result.healthStatus),
    });
  }
  if (result.syncStatus.trim()) {
    items.push({
      signal: "Sync",
      value: result.syncStatus,
      interpretation: syncMeaning(result.syncStatus),
    });
  }
  const resultLabel = shownResult(latest?.status);
  if (latest && resultLabel !== "Not recorded") {
    items.push({
      signal: "Result",
      value: resultLabel,
      interpretation: resultMeaning(resultLabel),
    });
  }
  const matched = new Set<string>();
  const ordered = [...events].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  for (const event of ordered) {
    const text = `${event.type} ${event.message}`.toLowerCase();
    const rule = eventRule(text);
    if (!rule || matched.has(rule.id)) continue;
    matched.add(rule.id);
    const message = event.message.trim();
    if (!message) continue;
    items.push({
      signal: event.type.trim() || "Event",
      value: message,
      interpretation: rule.interpretation,
    });
  }
  return items;
}

export function actionSteps(recommendedFix: string, calm: boolean): string[] {
  const fix = recommendedFix.trim();
  if (!fix || calm) return [];
  const known = knownSteps(fix);
  return known.length > 0 ? known : [fix];
}

export function actionNotes(recommendations: string[], recommendedFix: string): string[] {
  const fix = recommendedFix.trim();
  return recommendations
    .map((item) => item.trim())
    .filter((item) => item && item !== fix && !/failed or degraded/i.test(item));
}

const FAILED_RESULTS = new Set(["failed", "failure", "error", "errored"]);

/** Result failures and observed Degraded health are counted separately. */
export function deploymentOutcomeSummary(rows: Deployment[]): string | null {
  const failed = rows.filter((row) =>
    FAILED_RESULTS.has((row.status ?? "").trim().toLowerCase()),
  ).length;
  const degraded = rows.filter(
    (row) => (row.healthStatus ?? "").trim().toLowerCase() === "degraded",
  ).length;
  if (failed === 0 && degraded === 0) return null;
  const parts: string[] = [];
  if (failed > 0) {
    parts.push(`${failed} stored deployment${failed === 1 ? "" : "s"} failed`);
  }
  if (degraded > 0) {
    parts.push(
      `${degraded} stored deployment${degraded === 1 ? " was" : "s were"} observed as degraded`,
    );
  }
  return `${parts.join("; ")}.`;
}

export function compareLatestDeployments(rows: Deployment[]): RevisionComparison | null {
  const sorted = [...rows].sort(
    (left, right) =>
      new Date(right.deployedAt ?? 0).getTime() - new Date(left.deployedAt ?? 0).getTime(),
  );
  const current = sorted[0];
  const previous = sorted[1];
  if (!current || !previous) return null;

  const definitions = [
    {
      label: "Revision",
      previous: previous.revision || "Not recorded",
      current: current.revision || "Not recorded",
    },
    {
      label: "Deployed",
      previous: formatDateTime(previous.deployedAt),
      current: formatDateTime(current.deployedAt),
      previousTitle: formatUtcDateTime(previous.deployedAt),
      currentTitle: formatUtcDateTime(current.deployedAt),
    },
    {
      label: "Result",
      previous: shownResult(previous.status),
      current: shownResult(current.status),
    },
    {
      label: "Health",
      previous: shownSnapshot(previous.healthStatus),
      current: shownSnapshot(current.healthStatus),
    },
    {
      label: "Sync",
      previous: shownSnapshot(previous.syncStatus),
      current: shownSnapshot(current.syncStatus),
    },
  ];

  const rowsOut: ComparisonRow[] = definitions.map((row) => ({
    ...row,
    changed: concrete(row.previous) && concrete(row.current) && row.previous !== row.current,
  }));

  return {
    previousRevision: previous.revision,
    currentRevision: current.revision,
    rows: rowsOut,
    changes: rowsOut
      .filter((row) => row.changed)
      .map((row) => `${row.label}: ${row.previous} → ${row.current}`),
  };
}

export function buildOutcomeSeries(
  deployments: Deployment[],
  range: HistoryWindow,
): SuccessFailurePoint[] {
  const dated = deployments.filter((row) => row.deployedAt);
  if (range !== "all") {
    return fillDaily(dated, range === "7d" ? 7 : 30, new Date());
  }
  const times = dated
    .map((row) => new Date(row.deployedAt ?? 0).getTime())
    .filter((time) => !Number.isNaN(time));
  if (times.length === 0) return [];
  const start = startOfDay(new Date(Math.min(...times)));
  const end = startOfDay(new Date(Math.max(...times)));
  const span = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (span <= 90) return fillDaily(dated, span, end);
  return fillWeekly(dated, start, end);
}

export function failureDirection(deployments: Deployment[]): string | null {
  const dated = deployments
    .filter((row) => row.deployedAt)
    .sort(
      (left, right) =>
        new Date(left.deployedAt ?? 0).getTime() - new Date(right.deployedAt ?? 0).getTime(),
    );
  if (dated.length < 2) return null;
  const start = new Date(dated[0].deployedAt ?? 0).getTime();
  const end = new Date(dated[dated.length - 1].deployedAt ?? 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const mid = start + (end - start) / 2;
  const earlier = dated.filter((row) => new Date(row.deployedAt ?? 0).getTime() < mid);
  const later = dated.filter((row) => new Date(row.deployedAt ?? 0).getTime() >= mid);
  if (earlier.length === 0 || later.length === 0) return null;
  const earlierFailed = earlier.filter((row) => classifyDeployment(row) === "failed").length;
  const laterFailed = later.filter((row) => classifyDeployment(row) === "failed").length;
  if (laterFailed === earlierFailed) {
    return `Failed results are unchanged between the earlier half (${earlierFailed}) and the later half (${laterFailed}) of this window.`;
  }
  const direction = laterFailed > earlierFailed ? "more common" : "less common";
  return `Failed results are ${direction} in the later half of this window (${laterFailed}) than the earlier half (${earlierFailed}).`;
}

export function newestDeployment(rows: Deployment[]): Deployment | null {
  return (
    [...rows].sort(
      (left, right) =>
        new Date(right.deployedAt ?? 0).getTime() - new Date(left.deployedAt ?? 0).getTime(),
    )[0] ?? null
  );
}

function healthMeaning(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "degraded") return "Workload unhealthy";
  if (value === "healthy") return "Argo CD reports the application healthy";
  if (value === "progressing") return "Rollout is still progressing";
  if (value === "missing") return "A declared resource is not in the cluster";
  if (value === "unknown") return "Argo CD has not reported health";
  return "Reported by the current Argo CD application";
}

function syncMeaning(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "synced") return "Git revision was applied";
  if (value === "outofsync") return "Cluster state differs from Git";
  if (value === "unknown") return "Argo CD has not reported sync";
  return "Reported by the current Argo CD application";
}

function resultMeaning(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "succeeded" || value === "success" || value === "successful") {
    return "The stored sync result succeeded";
  }
  if (value === "failed" || value === "failure" || value === "error" || value === "errored") {
    return "The stored sync result failed";
  }
  return "Stored deployment result";
}

function eventRule(text: string): { id: string; interpretation: string } | null {
  if (IMAGE_PULL.some((phrase) => text.includes(phrase))) {
    return { id: "image-pull", interpretation: "The container image could not be pulled" };
  }
  if (text.includes("crashloopbackoff")) {
    return { id: "crashloop", interpretation: "The container is crashing after start" };
  }
  if (
    text.includes("progressdeadlineexceeded") ||
    text.includes("exceeded its progress deadline") ||
    text.includes("progress deadline exceeded")
  ) {
    return {
      id: "progress-deadline",
      interpretation: "The workload did not become ready before its progress deadline",
    };
  }
  if (text.includes("failedscheduling")) {
    return { id: "scheduling", interpretation: "The pod could not be placed on a node" };
  }
  return null;
}

function knownSteps(fix: string): string[] {
  const text = fix.toLowerCase();
  if (text.includes("image name and tag")) {
    return [
      "Verify the image name and tag.",
      "Confirm the image exists in the registry.",
      "Check registry access or image pull credentials.",
    ];
  }
  if (text.includes("progress deadline")) {
    return [
      "Check the new pods.",
      "Check readiness/liveness probes.",
      "Check container startup.",
      "Check the Deployment progress deadline.",
    ];
  }
  if (text.includes("container logs")) {
    return [
      "Inspect container logs.",
      "Inspect probes.",
      "Inspect startup configuration.",
    ];
  }
  if (text.includes("cpu, memory, and node selectors")) {
    return ["Check CPU, memory, and node selectors."];
  }
  if (text.includes("git path")) {
    return ["Verify the Git path and the destination namespace."];
  }
  if (text.includes("operation message")) {
    return ["Read the operation message and sync again after fixing the Git or cluster error."];
  }
  if (text.includes("review the diff")) {
    return ["Review the diff, then sync."];
  }
  if (text.includes("resource health messages")) {
    return ["Open the resource health messages stored for this application."];
  }
  if (text.includes("confirm the application exists")) {
    return ["Confirm the application exists in Argo CD and that a sync has completed."];
  }
  return [];
}

function concrete(value: string): boolean {
  return value !== "Not recorded" && value !== "—" && value.trim() !== "";
}

function fillDaily(rows: Deployment[], days: number, end: Date): SuccessFailurePoint[] {
  const buckets = new Map<string, SuccessFailurePoint>();
  const last = startOfDay(end);
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(last);
    date.setDate(last.getDate() - index);
    const key = keyFor(date);
    buckets.set(key, {
      label: days <= 7 ? weekday(key) : shortDate(key),
      succeeded: 0,
      failed: 0,
    });
  }
  addOutcomes(rows, buckets);
  return Array.from(buckets.values());
}

function fillWeekly(rows: Deployment[], start: Date, end: Date): SuccessFailurePoint[] {
  const buckets = new Map<string, SuccessFailurePoint>();
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    const key = keyFor(cursor);
    buckets.set(key, { label: shortDate(key), succeeded: 0, failed: 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  for (const row of rows) {
    if (!row.deployedAt) continue;
    const time = startOfDay(new Date(row.deployedAt)).getTime();
    let bucketKey = "";
    for (const key of buckets.keys()) {
      if (new Date(`${key}T00:00:00`).getTime() <= time) bucketKey = key;
    }
    const bucket = buckets.get(bucketKey);
    if (!bucket) continue;
    const outcome = classifyDeployment(row);
    if (outcome === "success") bucket.succeeded += 1;
    else if (outcome === "failed") bucket.failed += 1;
  }
  return Array.from(buckets.values());
}

function addOutcomes(rows: Deployment[], buckets: Map<string, SuccessFailurePoint>) {
  for (const row of rows) {
    if (!row.deployedAt) continue;
    const bucket = buckets.get(keyFor(startOfDay(new Date(row.deployedAt))));
    if (!bucket) continue;
    const outcome = classifyDeployment(row);
    if (outcome === "success") bucket.succeeded += 1;
    else if (outcome === "failed") bucket.failed += 1;
  }
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
