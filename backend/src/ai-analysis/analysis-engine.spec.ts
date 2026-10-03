import { analyzeDeploymentSignals } from './analysis-engine';
import { classifyDeployment } from '../workspace/workspace-metrics';
import type { Deployment } from '@prisma/client';

function row(status: string, healthStatus: string, syncStatus = 'Unknown'): Deployment {
  return { status, healthStatus, syncStatus } as Deployment;
}

describe('deployment result classification', () => {
  it('counts Succeeded as successful even when health is Degraded', () => {
    expect(classifyDeployment(row('Succeeded', 'Degraded', 'Synced'))).toBe('success');
  });

  it('counts Failed as failed once when health is also Degraded', () => {
    expect(classifyDeployment(row('Failed', 'Degraded', 'Synced'))).toBe('failed');
  });

  it('uses Degraded health only when Result is missing', () => {
    expect(classifyDeployment(row('', 'Degraded'))).toBe('failed');
  });

  it('keeps an all-succeeded history at 100 percent', () => {
    const rows = Array.from({ length: 10 }, () => row('Succeeded', 'Healthy', 'Synced'));
    const successCount = rows.filter((item) => classifyDeployment(item) === 'success').length;
    const failedCount = rows.filter((item) => classifyDeployment(item) === 'failed').length;
    expect(successCount).toBe(10);
    expect(failedCount).toBe(0);
  });

  it('counts Succeeded as success when no health or sync snapshot was stored', () => {
    expect(
      classifyDeployment({
        ...row('Succeeded', 'Unknown'),
        healthStatus: null,
        syncStatus: null,
        stateRecorded: false,
      }),
    ).toBe('success');
  });

  it('counts Failed with a recorded snapshot as failed', () => {
    expect(
      classifyDeployment({
        ...row('Failed', 'Degraded', 'Synced'),
        stateRecorded: true,
      }),
    ).toBe('failed');
  });

  it('keeps nine succeeded results and one failed result at 90 percent', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => ({
        ...row('Succeeded', 'Unknown'),
        healthStatus: null,
        syncStatus: null,
        stateRecorded: false,
      })),
      { ...row('Failed', 'Degraded', 'Synced'), stateRecorded: true },
    ];
    const successCount = rows.filter((item) => classifyDeployment(item) === 'success').length;
    const failedCount = rows.filter((item) => classifyDeployment(item) === 'failed').length;
    const successRate = Number(((successCount / rows.length) * 100).toFixed(1));
    expect(rows.length).toBe(10);
    expect(successCount).toBe(9);
    expect(failedCount).toBe(1);
    expect(successRate).toBe(90);

    const analysis = analyzeDeploymentSignals({
      applicationId: 1,
      deploymentCount: rows.length,
      successCount,
      failedDeploymentCount: failedCount,
      lastDeploymentAt: '2026-10-02T00:00:00.000Z',
      eventCount: 1,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText: 'Operation successfully synced (all tasks run)',
    });
    expect(analysis.successRate).toBe(90);
    expect(analysis.riskScore).toBe(38);
    expect(analysis.stabilityScore).toBe(82);
  });
});

describe('sync success versus workload failure', () => {
  const mixed = {
    applicationId: 1,
    deploymentCount: 10,
    successCount: 9,
    failedDeploymentCount: 1,
    lastDeploymentAt: '2026-10-02T00:00:00.000Z',
    eventCount: 2,
  };

  it('explains an image pull failure when the sync itself succeeded', () => {
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText: [
        'Operation successfully synced (all tasks run)',
        'Failed Degraded Synced',
        'Deployment/gitops-ai-failure-test Back-off pulling image "example/missing:never": ErrImagePull',
      ].join('\n'),
    });

    expect(analysis.successRate).toBe(90);
    expect(analysis.rootCause).toContain('latest sync completed successfully');
    expect(analysis.rootCause.toLowerCase()).toContain('image could not be pulled');
    expect(analysis.rootCause).not.toContain('did not finish successfully');
    expect(analysis.recommendedFix.toLowerCase()).toContain('image name and tag');
    expect(analysis.confidence).toBeGreaterThanOrEqual(85);
  });

  it('reports a sync failure only when the sync did not succeed', () => {
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'OutOfSync',
      eventText: 'ComparisonError the sync failed while applying resources',
    });

    expect(analysis.rootCause).toContain('latest Argo CD sync failed');
    expect(analysis.rootCause).not.toContain('completed successfully');
  });

  it('treats a healthy synced deployment as successful with no active failure', () => {
    expect(classifyDeployment(row('Succeeded', 'Healthy', 'Synced'))).toBe('success');
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      deploymentCount: 1,
      successCount: 1,
      failedDeploymentCount: 0,
      healthStatus: 'Healthy',
      syncStatus: 'Synced',
      eventText: 'Operation successfully synced (all tasks run)',
    });
    expect(analysis.rootCause).toBe('No obvious deployment problem detected.');
    expect(analysis.rootCause).not.toContain('sync failed');
    expect(analysis.rootCause).not.toContain('did not finish successfully');
  });

  it('explains ImagePullBackOff on a synced degraded deployment as an image pull failure', () => {
    expect(classifyDeployment(row('Failed', 'Degraded', 'Synced'))).toBe('failed');
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText: 'Deployment/example ImagePullBackOff',
    });
    expect(analysis.rootCause.toLowerCase()).toContain('image could not be pulled');
    expect(analysis.recommendedFix.toLowerCase()).toContain('image name and tag');
    expect(analysis.rootCause).not.toContain('did not finish successfully');
  });

  it('explains a progress deadline failure without calling the sync a failure', () => {
    expect(classifyDeployment(row('Failed', 'Degraded', 'Synced'))).toBe('failed');
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText:
        'Operation successfully synced (all tasks run)\nDeployment/example exceeded its progress deadline',
    });
    expect(analysis.rootCause).toContain(
      'The workload did not become ready before its progress deadline.',
    );
    expect(analysis.recommendedFix).toContain('readiness/liveness probes');
    expect(analysis.rootCause).toContain('latest sync completed successfully');
    expect(analysis.rootCause).not.toContain('did not finish successfully');
    expect(analysis.rootCause).not.toContain('latest Argo CD sync failed');
    expect(analysis.rootCause.toLowerCase()).not.toContain('sync failed');
    expect(analysis.successRate).toBe(90);
    expect(analysis.riskScore).toBe(38);
    expect(analysis.stabilityScore).toBe(82);
    expect(classifyDeployment(row('Failed', 'Degraded', 'Synced'))).toBe('failed');
  });

  it('prefers an image pull diagnosis over a progress deadline in the same text', () => {
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText: 'ErrImagePull exceeded its progress deadline',
    });
    expect(analysis.rootCause.toLowerCase()).toContain('image could not be pulled');
    expect(analysis.rootCause).not.toContain('progress deadline');
  });

  it('does not call a successful sync a sync failure when no workload error is stored', () => {
    const analysis = analyzeDeploymentSignals({
      ...mixed,
      healthStatus: 'Degraded',
      syncStatus: 'Synced',
      eventText: 'Operation successfully synced (all tasks run)\nFailed Degraded Synced',
    });

    expect(analysis.rootCause).toContain('latest sync completed successfully');
    expect(analysis.rootCause).not.toContain('did not finish successfully');
    expect(analysis.rootCause.toLowerCase()).not.toContain('image could not be pulled');
  });
});
