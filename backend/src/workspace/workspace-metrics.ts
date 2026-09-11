import type { Deployment } from '@prisma/client';
import type { TimeRange } from '../common/dto/time-range.dto';
import { rangeToDays } from '../common/dto/time-range.dto';

export function isFailed(deployment: Deployment): boolean {
  const status = deployment.status?.toLowerCase() ?? '';
  const health = (deployment.healthStatus ?? '').toLowerCase();
  return status.includes('fail') || health === 'degraded';
}

export function isSucceeded(deployment: Deployment): boolean {
  const status = deployment.status?.toLowerCase() ?? '';
  const health = (deployment.healthStatus ?? '').toLowerCase();
  return status.includes('success') || status === 'succeeded' || health === 'healthy';
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildActivity(
  deployments: Deployment[],
  range: TimeRange | undefined,
): Array<{ label: string; deployments: number }> {
  const days = rangeToDays(range);
  const today = startOfDay(new Date());
  const buckets = new Map<string, number>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    buckets.set(dayKey(date), 0);
  }

  for (const deployment of deployments) {
    const key = dayKey(startOfDay(deployment.deployedAt));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return Array.from(buckets.entries()).map(([iso, count]) => ({
    label: days <= 7 ? weekday(iso) : shortDate(iso),
    deployments: count,
  }));
}

export function buildSuccessFailure(
  deployments: Deployment[],
  range: TimeRange | undefined,
): Array<{ label: string; succeeded: number; failed: number }> {
  const days = rangeToDays(range);
  const today = startOfDay(new Date());
  const buckets = new Map<string, { succeeded: number; failed: number }>();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    buckets.set(dayKey(date), { succeeded: 0, failed: 0 });
  }

  for (const deployment of deployments) {
    const key = dayKey(startOfDay(deployment.deployedAt));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (isFailed(deployment)) bucket.failed += 1;
    else if (isSucceeded(deployment)) bucket.succeeded += 1;
  }

  return Array.from(buckets.entries()).map(([iso, value]) => ({
    label: days <= 7 ? weekday(iso) : shortDate(iso),
    ...value,
  }));
}

export function buildDora(deployments: Deployment[]) {
  const days = 7;
  const cutoff = Date.now() - days * 86400000;
  const recent = deployments.filter(
    (item) => item.deployedAt.getTime() >= cutoff,
  );
  const frequency = recent.length / days;
  const failed = deployments.filter(isFailed).length;
  const failureRate =
    deployments.length === 0 ? 0 : (failed / deployments.length) * 100;
  const leadHours = averageLeadHours(deployments);
  const mttrHours = averageMttrHours(deployments);

  return {
    deploymentFrequency: metric(
      'deploymentFrequency',
      'Deployment frequency',
      `${frequency.toFixed(1)} / day`,
      'api',
      'Recorded deployments in the last 7 days.',
    ),
    leadTime: metric(
      'leadTime',
      'Lead time for changes',
      leadHours === null ? 'Awaiting data' : `${leadHours.toFixed(1)} h`,
      leadHours === null ? 'unavailable' : 'api',
      leadHours === null
        ? 'Requires committedAt and deployedAt on deployments.'
        : 'Average hours from commit to deploy.',
    ),
    changeFailureRate: metric(
      'changeFailureRate',
      'Change failure rate',
      `${Math.round(failureRate * 10) / 10}%`,
      'api',
      'Failed or degraded deployments over recorded history.',
    ),
    mttr: metric(
      'mttr',
      'Time to restore',
      mttrHours === null ? 'Awaiting data' : `${mttrHours.toFixed(1)} h`,
      mttrHours === null ? 'unavailable' : 'api',
      mttrHours === null
        ? 'Requires a failed deployment followed by a successful one with timestamps.'
        : 'Average restore interval from failed to successful deploys.',
    ),
  };
}

function metric(
  key: string,
  label: string,
  value: string,
  source: 'api' | 'unavailable',
  hint: string,
) {
  return { key, label, value, source, hint, trend: null as string | null };
}

function averageLeadHours(deployments: Deployment[]): number | null {
  const samples = deployments
    .filter((item) => item.committedAt)
    .map(
      (item) =>
        (item.deployedAt.getTime() - (item.committedAt as Date).getTime()) /
        36e5,
    )
    .filter((hours) => hours >= 0);
  if (samples.length === 0) return null;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function averageMttrHours(deployments: Deployment[]): number | null {
  const sorted = [...deployments].sort(
    (a, b) => a.deployedAt.getTime() - b.deployedAt.getTime(),
  );
  const recoveries: number[] = [];
  let lastFailure: number | null = null;

  for (const item of sorted) {
    if (isFailed(item)) {
      lastFailure = item.deployedAt.getTime();
      continue;
    }
    if (lastFailure !== null && isSucceeded(item)) {
      recoveries.push((item.deployedAt.getTime() - lastFailure) / 36e5);
      lastFailure = null;
    }
  }

  if (recoveries.length === 0) return null;
  return recoveries.reduce((sum, value) => sum + value, 0) / recoveries.length;
}

function weekday(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
    new Date(`${isoDate}T00:00:00`),
  );
}

function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00`));
}
