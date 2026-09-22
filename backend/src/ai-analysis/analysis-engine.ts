export interface DeploymentAnalysis {
  applicationId: number;
  healthStatus: string;
  syncStatus: string;
  rootCause: string;
  recommendedFix: string;
  confidence: number;
}

export function analyzeDeploymentSignals(input: {
  applicationId: number;
  healthStatus: string;
  syncStatus: string;
  eventText: string;
}): DeploymentAnalysis {
  const health = (input.healthStatus || 'Unknown').trim() || 'Unknown';
  const sync = (input.syncStatus || 'Unknown').trim() || 'Unknown';
  const corpus = input.eventText.toLowerCase();
  const healthNorm = health.toLowerCase();
  const syncNorm = sync.toLowerCase();

  if (healthNorm === 'degraded' && corpus.includes('imagepullbackoff')) {
    return result(input.applicationId, health, sync, {
      rootCause: 'Container image cannot be pulled.',
      recommendedFix: 'Verify image exists and imagePullSecrets are correct.',
      confidence: 85,
    });
  }

  if (healthNorm === 'degraded' && corpus.includes('crashloopbackoff')) {
    return result(input.applicationId, health, sync, {
      rootCause: 'Application crashes during startup.',
      recommendedFix: 'Inspect container logs and startup configuration.',
      confidence: 85,
    });
  }

  if (healthNorm === 'missing') {
    return result(input.applicationId, health, sync, {
      rootCause: 'Application resource not found.',
      recommendedFix: 'Verify repository path and destination namespace.',
      confidence: 90,
    });
  }

  if (syncNorm === 'outofsync') {
    return result(input.applicationId, health, sync, {
      rootCause: 'Cluster state differs from Git state.',
      recommendedFix: 'Run sync operation or review drift.',
      confidence: 80,
    });
  }

  if (corpus.includes('failedscheduling')) {
    return result(input.applicationId, health, sync, {
      rootCause: 'Cluster lacks resources.',
      recommendedFix: 'Add node capacity or reduce requests.',
      confidence: 85,
    });
  }

  return result(input.applicationId, health, sync, {
    rootCause: 'No obvious deployment problem detected.',
    recommendedFix: 'Inspect application logs manually.',
    confidence: 40,
  });
}

function result(
  applicationId: number,
  healthStatus: string,
  syncStatus: string,
  finding: Pick<DeploymentAnalysis, 'rootCause' | 'recommendedFix' | 'confidence'>,
): DeploymentAnalysis {
  return {
    applicationId,
    healthStatus,
    syncStatus,
    ...finding,
  };
}
