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

  it('counts a mixed 9 succeeded and 1 failed history without double counting', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => row('Succeeded', 'Unknown')),
      row('Failed', 'Degraded', 'Synced'),
    ];
    const successCount = rows.filter((item) => classifyDeployment(item) === 'success').length;
    const failedCount = rows.filter((item) => classifyDeployment(item) === 'failed').length;
    expect(successCount).toBe(9);
    expect(failedCount).toBe(1);
    expect(successCount + failedCount).toBe(rows.length);
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
