import { classifyDeployment } from '../workspace/workspace-metrics';
import type { Deployment } from '@prisma/client';
import {
  mergeDeploymentSnapshots,
  presentDeploymentSnapshot,
  type StoredDeploymentSnapshot,
} from './deployment-history';

function stored(
  overrides: Partial<StoredDeploymentSnapshot> & Pick<StoredDeploymentSnapshot, 'id' | 'revision'>,
): StoredDeploymentSnapshot {
  return {
    deployedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: 'Succeeded',
    syncStatus: 'Unknown',
    healthStatus: 'Unknown',
    environment: 'demo',
    startedAt: null,
    stateRecorded: false,
    ...overrides,
  };
}

describe('deployment snapshot merge', () => {
  const olderAt = new Date('2026-01-01T00:00:00.000Z');
  const newerAt = new Date('2026-02-01T00:00:00.000Z');

  it('keeps a historical success when the current application is Degraded', () => {
    const historical = stored({
      id: 1,
      revision: 'old-revision',
      deployedAt: olderAt,
      status: 'Succeeded',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots(
      [historical],
      [
        { revision: 'new-revision', deployedAt: newerAt, startedAt: null, environment: 'demo' },
        { revision: 'old-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'new-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: newerAt,
        namespace: 'demo',
      },
    );

    expect(writes).toContainEqual({ action: 'keep', id: 1 });
    expect(writes.some((write) => write.action === 'insert' && write.data.revision === 'old-revision')).toBe(
      false,
    );
    expect(classifyDeployment({ status: historical.status, healthStatus: historical.healthStatus } as Deployment)).toBe(
      'success',
    );
  });

  it('does not fabricate Healthy or Synced when no snapshot was recorded', () => {
    const unrecorded = stored({ id: 4, revision: 'old-revision', deployedAt: olderAt });
    const presented = presentDeploymentSnapshot(unrecorded);
    expect(presented.healthStatus).toBeNull();
    expect(presented.syncStatus).toBeNull();
    expect(presented.healthStatus).not.toBe('Healthy');
    expect(presented.syncStatus).not.toBe('Synced');

    const writes = mergeDeploymentSnapshots(
      [],
      [
        { revision: 'new-revision', deployedAt: newerAt, startedAt: null, environment: 'demo' },
        { revision: 'old-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'new-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: newerAt,
        namespace: 'demo',
      },
    );
    const inserted = writes.find(
      (write) => write.action === 'insert' && write.data.revision === 'old-revision',
    );
    expect(inserted?.action).toBe('insert');
    if (inserted?.action !== 'insert') return;
    expect(inserted.data.healthStatus).toBeNull();
    expect(inserted.data.syncStatus).toBeNull();
    expect(inserted.data.stateRecorded).toBe(false);
    expect(inserted.data.healthStatus).not.toBe('Healthy');
    expect(inserted.data.syncStatus).not.toBe('Synced');
  });

  it('does not change a recorded snapshot when the same revision later becomes Degraded', () => {
    const at = new Date('2026-03-01T00:00:00.000Z');
    const fact = {
      revision: 'revision-a',
      deployedAt: at,
      startedAt: null,
      environment: 'demo',
    };
    const first = mergeDeploymentSnapshots([], [fact], {
      revision: 'revision-a',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      deployedAt: at,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: 'revision-a',
    });
    const created = first.find((write) => write.action === 'insert');
    expect(created?.action).toBe('insert');
    if (created?.action !== 'insert') return;
    expect(created.data.healthStatus).toBe('Healthy');
    expect(created.data.syncStatus).toBe('Synced');
    expect(created.data.status).toBe('Succeeded');
    expect(created.data.stateRecorded).toBe(true);

    const saved = stored({
      id: 8,
      revision: 'revision-a',
      deployedAt: at,
      status: created.data.status,
      healthStatus: created.data.healthStatus,
      syncStatus: created.data.syncStatus,
      stateRecorded: true,
    });
    const later = mergeDeploymentSnapshots([saved], [fact], {
      revision: 'revision-a',
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      deployedAt: at,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: 'revision-a',
    });
    expect(later).toEqual([{ action: 'keep', id: 8 }]);
    expect(saved.healthStatus).toBe('Healthy');
    expect(saved.syncStatus).toBe('Synced');
    expect(saved.status).toBe('Succeeded');
  });

  it('keeps a stored Failed Degraded snapshot instead of rewriting it from a later sync', () => {
    const at = new Date('2026-03-02T00:00:00.000Z');
    const saved = stored({
      id: 9,
      revision: 'failure-revision',
      deployedAt: at,
      status: 'Failed',
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots(
      [saved],
      [{ revision: 'failure-revision', deployedAt: at, startedAt: null, environment: 'demo' }],
      {
        revision: 'failure-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: at,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'failure-revision',
      },
    );
    expect(writes).toEqual([{ action: 'keep', id: 9 }]);
    expect(saved.status).toBe('Failed');
    expect(saved.healthStatus).toBe('Degraded');
    expect(saved.syncStatus).toBe('Synced');
  });

  it('stores the operation result on first sight and does not infer Failed from Degraded health', () => {
    const at = new Date('2026-03-03T00:00:00.000Z');
    const writes = mergeDeploymentSnapshots(
      [],
      [{ revision: 'failure-revision', deployedAt: at, startedAt: null, environment: 'demo' }],
      {
        revision: 'failure-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: at,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'failure-revision',
      },
    );
    const created = writes.find((write) => write.action === 'insert');
    expect(created?.action).toBe('insert');
    if (created?.action !== 'insert') return;
    expect(created.data.status).toBe('Succeeded');
    expect(created.data.healthStatus).toBe('Degraded');
    expect(created.data.syncStatus).toBe('Synced');
  });

  it('does not mark a history entry Succeeded merely because the revision exists', () => {
    const writes = mergeDeploymentSnapshots(
      [],
      [
        {
          revision: 'older-only',
          deployedAt: olderAt,
          startedAt: null,
          environment: 'demo',
        },
      ],
      {
        revision: 'current-other',
        healthStatus: 'Healthy',
        syncStatus: 'Synced',
        deployedAt: newerAt,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'current-other',
      },
    );
    const created = writes.find((write) => write.action === 'insert');
    expect(created?.action).toBe('insert');
    if (created?.action !== 'insert') return;
    expect(created.data.revision).toBe('older-only');
    expect(created.data.status).toBe('');
    expect(created.data.healthStatus).toBeNull();
    expect(created.data.syncStatus).toBeNull();
    expect(created.data.stateRecorded).toBe(false);
  });

  it('records an operation failure from operationState.phase', () => {
    const writes = mergeDeploymentSnapshots(
      [],
      [{ revision: 'bad-sync', deployedAt: newerAt, startedAt: null, environment: 'demo' }],
      {
        revision: 'bad-sync',
        healthStatus: 'Degraded',
        syncStatus: 'OutOfSync',
        deployedAt: newerAt,
        namespace: 'demo',
        operationPhase: 'Failed',
        operationRevision: 'bad-sync',
      },
    );
    const created = writes.find((write) => write.action === 'insert');
    expect(created?.action).toBe('insert');
    if (created?.action !== 'insert') return;
    expect(created.data.status).toBe('Failed');
    expect(created.data.healthStatus).toBe('Degraded');
    expect(created.data.syncStatus).toBe('OutOfSync');
  });

  it('keeps an older recorded snapshot when a newer revision is first stored', () => {
    const older = stored({
      id: 2,
      revision: 'old-revision',
      deployedAt: olderAt,
      status: 'Succeeded',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots(
      [older],
      [
        { revision: 'new-revision', deployedAt: newerAt, startedAt: null, environment: 'demo' },
        { revision: 'old-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'new-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: newerAt,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'new-revision',
      },
    );

    const created = writes.find((write) => write.action === 'insert');
    expect(created?.action).toBe('insert');
    if (created?.action !== 'insert') return;
    expect(created.data.status).toBe('Succeeded');
    expect(created.data.healthStatus).toBe('Degraded');
    expect(created.data.syncStatus).toBe('Synced');
    expect(created.data.stateRecorded).toBe(true);
    expect(writes).toContainEqual({ action: 'keep', id: 2 });
    expect(older.healthStatus).toBe('Healthy');
    expect(older.status).toBe('Succeeded');
  });

  it('does not copy the current Degraded health onto an older unrecorded revision', () => {
    const writes = mergeDeploymentSnapshots(
      [stored({ id: 3, revision: 'old-revision', deployedAt: olderAt, status: 'Succeeded' })],
      [
        { revision: 'new-revision', deployedAt: newerAt, startedAt: null, environment: 'demo' },
        { revision: 'old-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'new-revision',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: newerAt,
        namespace: 'demo',
      },
    );
    expect(writes).toContainEqual({ action: 'keep', id: 3 });
    const presented = presentDeploymentSnapshot(
      stored({ id: 3, revision: 'old-revision', deployedAt: olderAt, status: 'Succeeded' }),
    );
    expect(presented.healthStatus).toBeNull();
    expect(presented.syncStatus).toBeNull();
    expect(presented.status).toBe('Succeeded');
    expect(
      classifyDeployment({
        status: 'Succeeded',
        healthStatus: null,
        syncStatus: null,
        stateRecorded: false,
      } as Deployment),
    ).toBe('success');
  });

  it('fills an unrecorded revision once when it later becomes the synced revision, then freezes it', () => {
    const revisionA = {
      revision: 'revision-a',
      deployedAt: olderAt,
      startedAt: null,
      environment: 'demo',
    };
    const revisionB = {
      revision: 'revision-b',
      deployedAt: newerAt,
      startedAt: null,
      environment: 'demo',
    };
    const first = mergeDeploymentSnapshots([], [revisionB, revisionA], {
      revision: 'revision-b',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      deployedAt: newerAt,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: 'revision-b',
    });
    const insertedA = first.find(
      (write) => write.action === 'insert' && write.data.revision === 'revision-a',
    );
    expect(insertedA?.action).toBe('insert');
    if (insertedA?.action !== 'insert') return;
    expect(insertedA.data.stateRecorded).toBe(false);
    expect(insertedA.data.healthStatus).toBeNull();
    expect(insertedA.data.syncStatus).toBeNull();

    const storedA = stored({
      id: 11,
      revision: 'revision-a',
      deployedAt: olderAt,
      status: '',
      healthStatus: null,
      syncStatus: null,
      stateRecorded: false,
    });
    const filled = mergeDeploymentSnapshots([storedA], [revisionB, revisionA], {
      revision: 'revision-a',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      deployedAt: olderAt,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: 'revision-a',
    });
    expect(filled).toContainEqual({
      action: 'fill',
      id: 11,
      data: {
        status: 'Succeeded',
        healthStatus: 'Healthy',
        syncStatus: 'Synced',
        stateRecorded: true,
      },
    });

    const frozen = stored({
      id: 11,
      revision: 'revision-a',
      deployedAt: olderAt,
      status: 'Succeeded',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const later = mergeDeploymentSnapshots(
      [
        frozen,
        stored({
          id: 12,
          revision: 'revision-b',
          deployedAt: newerAt,
          status: 'Succeeded',
          healthStatus: 'Healthy',
          syncStatus: 'Synced',
          stateRecorded: true,
        }),
      ],
      [revisionB, revisionA],
      {
        revision: 'revision-a',
        healthStatus: 'Degraded',
        syncStatus: 'Synced',
        deployedAt: olderAt,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'revision-a',
      },
    );
    expect(later).toContainEqual({ action: 'keep', id: 11 });
    expect(later.some((write) => write.action === 'fill')).toBe(false);
    expect(frozen.healthStatus).toBe('Healthy');
    expect(frozen.syncStatus).toBe('Synced');
    expect(frozen.status).toBe('Succeeded');
  });

  it('snapshots only the latest history entry when the same revision was deployed twice', () => {
    const latestAt = new Date('2026-04-02T00:00:00.000Z');
    const earlierAt = new Date('2026-04-01T00:00:00.000Z');
    const latest = stored({
      id: 21,
      revision: 'sha-a',
      deployedAt: latestAt,
      status: '',
      healthStatus: null,
      syncStatus: null,
      stateRecorded: false,
    });
    const earlier = stored({
      id: 22,
      revision: 'sha-a',
      deployedAt: earlierAt,
      status: 'Succeeded',
      healthStatus: 'Unknown',
      syncStatus: 'Unknown',
      stateRecorded: false,
    });
    const writes = mergeDeploymentSnapshots(
      [earlier, latest],
      [
        { revision: 'sha-a', deployedAt: latestAt, startedAt: null, environment: 'demo' },
        { revision: 'sha-a', deployedAt: earlierAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'sha-a',
        healthStatus: 'Healthy',
        syncStatus: 'Synced',
        deployedAt: latestAt,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'sha-a',
      },
    );

    expect(writes).toContainEqual({
      action: 'fill',
      id: 21,
      data: {
        status: 'Succeeded',
        healthStatus: 'Healthy',
        syncStatus: 'Synced',
        stateRecorded: true,
      },
    });
    expect(writes).toContainEqual({ action: 'keep', id: 22 });
    expect(earlier.healthStatus).toBe('Unknown');
    expect(earlier.syncStatus).toBe('Unknown');
    const presented = presentDeploymentSnapshot(earlier);
    expect(presented.status).toBe('Succeeded');
    expect(presented.healthStatus).toBeNull();
    expect(presented.syncStatus).toBeNull();
  });

  it('replaces Progressing with Healthy once, then freezes the snapshot', () => {
    const at = new Date('2026-10-08T20:09:52.000Z');
    const fact = {
      revision: '388858e2d3c2493275631f3b13d7fee4b855c191',
      deployedAt: at,
      startedAt: null,
      environment: 'demo',
    };
    const progressing = stored({
      id: 30,
      revision: fact.revision,
      deployedAt: at,
      status: 'Succeeded',
      healthStatus: 'Progressing',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const settled = mergeDeploymentSnapshots([progressing], [fact], {
      revision: fact.revision,
      healthStatus: 'Healthy',
      syncStatus: 'OutOfSync',
      deployedAt: at,
      namespace: 'demo',
      operationPhase: 'Failed',
      operationRevision: fact.revision,
    });

    expect(settled).toEqual([
      { action: 'settle', id: 30, data: { healthStatus: 'Healthy' } },
    ]);
    expect(progressing.status).toBe('Succeeded');
    expect(progressing.syncStatus).toBe('Synced');
    expect(progressing.revision).toBe(fact.revision);
    expect(progressing.deployedAt).toBe(at);

    const frozen = stored({
      ...progressing,
      healthStatus: 'Healthy',
    });
    const later = mergeDeploymentSnapshots([frozen], [fact], {
      revision: fact.revision,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      deployedAt: at,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: fact.revision,
    });
    expect(later).toEqual([{ action: 'keep', id: 30 }]);
    expect(frozen.healthStatus).toBe('Healthy');
    expect(frozen.status).toBe('Succeeded');
    expect(frozen.syncStatus).toBe('Synced');
  });

  it('replaces Progressing with Degraded and does not change the sync result', () => {
    const at = new Date('2026-10-08T20:09:52.000Z');
    const fact = {
      revision: 'revision-progressing',
      deployedAt: at,
      startedAt: null,
      environment: 'demo',
    };
    const progressing = stored({
      id: 31,
      revision: fact.revision,
      deployedAt: at,
      status: 'Succeeded',
      healthStatus: 'Progressing',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots([progressing], [fact], {
      revision: fact.revision,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      deployedAt: at,
      namespace: 'demo',
      operationPhase: 'Succeeded',
      operationRevision: fact.revision,
    });

    expect(writes).toEqual([
      { action: 'settle', id: 31, data: { healthStatus: 'Degraded' } },
    ]);
    expect(progressing.status).toBe('Succeeded');
    expect(progressing.syncStatus).toBe('Synced');
    expect(progressing.deployedAt).toBe(at);
  });

  it('leaves a stored Healthy snapshot unchanged', () => {
    const at = new Date('2026-10-08T20:09:52.000Z');
    const saved = stored({
      id: 32,
      revision: 'revision-healthy',
      deployedAt: at,
      status: 'Succeeded',
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots(
      [saved],
      [{ revision: 'revision-healthy', deployedAt: at, startedAt: null, environment: 'demo' }],
      {
        revision: 'revision-healthy',
        healthStatus: 'Degraded',
        syncStatus: 'OutOfSync',
        deployedAt: at,
        namespace: 'demo',
        operationPhase: 'Failed',
        operationRevision: 'revision-healthy',
      },
    );
    expect(writes).toEqual([{ action: 'keep', id: 32 }]);
    expect(saved.healthStatus).toBe('Healthy');
    expect(saved.status).toBe('Succeeded');
    expect(saved.syncStatus).toBe('Synced');
    expect(saved.deployedAt).toBe(at);
  });

  it('does not rewrite Progressing health on an older revision', () => {
    const olderAt = new Date('2026-10-01T00:00:00.000Z');
    const currentAt = new Date('2026-10-08T20:09:52.000Z');
    const older = stored({
      id: 33,
      revision: 'older-revision',
      deployedAt: olderAt,
      status: 'Succeeded',
      healthStatus: 'Progressing',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const earlierSameSha = stored({
      id: 34,
      revision: 'current-revision',
      deployedAt: olderAt,
      status: 'Succeeded',
      healthStatus: 'Progressing',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const current = stored({
      id: 35,
      revision: 'current-revision',
      deployedAt: currentAt,
      status: 'Succeeded',
      healthStatus: 'Progressing',
      syncStatus: 'Synced',
      stateRecorded: true,
    });
    const writes = mergeDeploymentSnapshots(
      [older, earlierSameSha, current],
      [
        { revision: 'current-revision', deployedAt: currentAt, startedAt: null, environment: 'demo' },
        { revision: 'current-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
        { revision: 'older-revision', deployedAt: olderAt, startedAt: null, environment: 'demo' },
      ],
      {
        revision: 'current-revision',
        healthStatus: 'Healthy',
        syncStatus: 'Synced',
        deployedAt: currentAt,
        namespace: 'demo',
        operationPhase: 'Succeeded',
        operationRevision: 'current-revision',
      },
    );

    expect(writes).toContainEqual({ action: 'keep', id: 33 });
    expect(writes).toContainEqual({ action: 'keep', id: 34 });
    expect(writes).toContainEqual({
      action: 'settle',
      id: 35,
      data: { healthStatus: 'Healthy' },
    });
    expect(older.healthStatus).toBe('Progressing');
    expect(earlierSameSha.healthStatus).toBe('Progressing');
    expect(older.status).toBe('Succeeded');
    expect(older.syncStatus).toBe('Synced');
  });
});
