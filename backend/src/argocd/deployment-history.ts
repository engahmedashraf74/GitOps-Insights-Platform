/**
 * Field sources for a deployment row:
 *
 * revision, deployedAt, startedAt
 *   Argo CD status.history. History has no health, sync, or operation result.
 *
 * healthStatus, syncStatus
 *   Copied only when that revision is first stored, from the live application
 *   status at that moment (status.health.status and status.sync.status).
 *   A later health change stays on the application and its events.
 *   Null means this revision has no snapshot. It is not Argo's "Unknown".
 *
 * status (Result)
 *   The sync operation result, and only when status.operationState.phase is
 *   Succeeded, Failed, or Error for this same revision. Workload health does
 *   not set Result. A blank result was not observed.
 *   Older rows may still contain "Succeeded" written by the previous
 *   reconstruction. That string is preserved. It remains the result even
 *   when health and sync were not snapshotted.
 */

export interface HistoryFact {
  revision: string;
  deployedAt: Date;
  startedAt: Date | null;
  environment: string;
}

export interface StoredDeploymentSnapshot {
  id: number;
  revision: string;
  deployedAt: Date;
  status: string;
  syncStatus: string | null;
  healthStatus: string | null;
  environment: string;
  startedAt: Date | null;
  stateRecorded: boolean;
}

export interface LiveObservation {
  revision: string;
  healthStatus: string;
  syncStatus: string;
  deployedAt: Date | null;
  namespace: string | null;
  /** status.operationState.phase. Absent when Argo has no operation result. */
  operationPhase?: string | null;
  /** Revision the operation applied. Absent when Argo did not name one. */
  operationRevision?: string | null;
}

export interface DeploymentInsert {
  revision: string;
  deployedAt: Date;
  startedAt: Date | null;
  environment: string;
  status: string;
  healthStatus: string | null;
  syncStatus: string | null;
  stateRecorded: boolean;
}

export interface SnapshotFill {
  status: string;
  healthStatus: string;
  syncStatus: string;
  stateRecorded: true;
}

export type HistoryWrite =
  | { action: 'insert'; data: DeploymentInsert }
  | { action: 'fill'; id: number; data: SnapshotFill }
  | { action: 'keep'; id: number };

const MATCH_WINDOW_MS = 1000;

/**
 * Maps Argo's operation phase to Result.
 * Succeeded, Failed, and Error are operation outcomes. Health is not consulted.
 */
export function operationResultFor(revision: string, live: LiveObservation): string {
  if (!revision || revision !== live.revision) return '';
  if (live.operationRevision && live.operationRevision !== revision) return '';
  const phase = (live.operationPhase ?? '').trim().toLowerCase();
  if (phase === 'succeeded') return 'Succeeded';
  if (phase === 'failed' || phase === 'error') return 'Failed';
  return '';
}

export function mergeDeploymentSnapshots(
  existing: StoredDeploymentSnapshot[],
  facts: HistoryFact[],
  live: LiveObservation,
): HistoryWrite[] {
  const sorted = [...facts].sort(
    (left, right) => right.deployedAt.getTime() - left.deployedAt.getTime(),
  );
  const entries = sorted.length > 0 ? sorted : fallbackFact(existing, live);
  const used = new Set<number>();
  const writes: HistoryWrite[] = [];

  entries.forEach((entry, index) => {
    const latestForLiveRevision = isLatestForLiveRevision(entries, index, live.revision);
    const match = existing.find((row) => {
      if (used.has(row.id)) return false;
      if (row.revision !== entry.revision) return false;
      return Math.abs(row.deployedAt.getTime() - entry.deployedAt.getTime()) < MATCH_WINDOW_MS;
    });

    if (!match) {
      writes.push({
        action: 'insert',
        data: latestForLiveRevision ? liveInsert(entry, live) : unrecordedInsert(entry),
      });
      return;
    }

    used.add(match.id);
    if (!match.stateRecorded && latestForLiveRevision) {
      const operationResult = operationResultFor(entry.revision, live);
      writes.push({
        action: 'fill',
        id: match.id,
        data: {
          status: operationResult || match.status,
          healthStatus: live.healthStatus,
          syncStatus: live.syncStatus,
          stateRecorded: true,
        },
      });
      return;
    }
    writes.push({ action: 'keep', id: match.id });
  });

  return writes;
}

export function presentDeploymentSnapshot<
  T extends {
    healthStatus: string | null;
    syncStatus: string | null;
    stateRecorded: boolean;
  },
>(row: T): T {
  if (row.stateRecorded) return row;
  return {
    ...row,
    healthStatus: null,
    syncStatus: null,
  };
}

function isLatestForLiveRevision(
  entries: HistoryFact[],
  index: number,
  liveRevision: string,
): boolean {
  const entry = entries[index];
  if (!entry || !liveRevision || entry.revision !== liveRevision) return false;
  return !entries.slice(0, index).some((prior) => prior.revision === liveRevision);
}

function liveInsert(entry: HistoryFact, live: LiveObservation): DeploymentInsert {
  if (entry.revision !== live.revision) return unrecordedInsert(entry);
  return {
    revision: entry.revision,
    deployedAt: entry.deployedAt,
    startedAt: entry.startedAt,
    environment: entry.environment,
    status: operationResultFor(entry.revision, live),
    healthStatus: live.healthStatus,
    syncStatus: live.syncStatus,
    stateRecorded: true,
  };
}

function unrecordedInsert(entry: HistoryFact): DeploymentInsert {
  return {
    revision: entry.revision,
    deployedAt: entry.deployedAt,
    startedAt: entry.startedAt,
    environment: entry.environment,
    status: '',
    healthStatus: null,
    syncStatus: null,
    stateRecorded: false,
  };
}

function fallbackFact(
  existing: StoredDeploymentSnapshot[],
  live: LiveObservation,
): HistoryFact[] {
  if (!live.revision) return [];
  const prior = existing
    .filter((row) => row.revision === live.revision)
    .sort((left, right) => right.deployedAt.getTime() - left.deployedAt.getTime())[0];
  return [
    {
      revision: live.revision,
      deployedAt: prior?.deployedAt ?? live.deployedAt ?? new Date(),
      startedAt: prior?.startedAt ?? null,
      environment: prior?.environment || live.namespace || 'default',
    },
  ];
}
