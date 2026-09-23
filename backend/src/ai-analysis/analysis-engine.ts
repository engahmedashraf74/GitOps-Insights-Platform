export interface DeploymentAnalysis {
  applicationId: number;
  healthStatus: string;
  syncStatus: string;
  rootCause: string;
  recommendedFix: string;
  confidence: number;
  deploymentCount: number;
  successRate: number;
  failedDeploymentCount: number;
  lastDeploymentAt: string | null;
  riskScore: number;
  stabilityScore: number;
  recommendations: string[];
}

export function analyzeDeploymentSignals(input: {
  applicationId: number;
  healthStatus: string;
  syncStatus: string;
  eventText: string;
  deploymentCount: number;
  successCount: number;
  failedDeploymentCount: number;
  lastDeploymentAt: string | null;
  eventCount: number;
}): DeploymentAnalysis {
  const health = (input.healthStatus || 'Unknown').trim() || 'Unknown';
  const sync = (input.syncStatus || 'Unknown').trim() || 'Unknown';
  const corpus = input.eventText.toLowerCase();
  const healthNorm = health.toLowerCase();
  const syncNorm = sync.toLowerCase();

  const finding = matchFinding(healthNorm, syncNorm, corpus);
  const successRate =
    input.deploymentCount === 0
      ? 0
      : Number(((input.successCount / input.deploymentCount) * 100).toFixed(1));
  const riskScore = scoreRisk({
    healthNorm,
    syncNorm,
    corpus,
    deploymentCount: input.deploymentCount,
    failedDeploymentCount: input.failedDeploymentCount,
  });
  const stabilityScore = scoreStability(successRate, riskScore, input.deploymentCount, healthNorm, syncNorm);

  return {
    applicationId: input.applicationId,
    healthStatus: health,
    syncStatus: sync,
    ...finding,
    deploymentCount: input.deploymentCount,
    successRate,
    failedDeploymentCount: input.failedDeploymentCount,
    lastDeploymentAt: input.lastDeploymentAt,
    riskScore,
    stabilityScore,
    recommendations: recommendationsFor(finding.recommendedFix, input, healthNorm, syncNorm),
  };
}

function matchFinding(
  healthNorm: string,
  syncNorm: string,
  corpus: string,
): Pick<DeploymentAnalysis, 'rootCause' | 'recommendedFix' | 'confidence'> {
  if (healthNorm === 'degraded' && corpus.includes('imagepullbackoff')) {
    return {
      rootCause: 'Container image cannot be pulled.',
      recommendedFix: 'Verify image exists and imagePullSecrets are correct.',
      confidence: 85,
    };
  }

  if (healthNorm === 'degraded' && corpus.includes('crashloopbackoff')) {
    return {
      rootCause: 'Application crashes during startup.',
      recommendedFix: 'Inspect container logs and startup configuration.',
      confidence: 85,
    };
  }

  if (healthNorm === 'missing') {
    return {
      rootCause: 'Application resource not found.',
      recommendedFix: 'Verify repository path and destination namespace.',
      confidence: 90,
    };
  }

  if (syncNorm === 'outofsync') {
    return {
      rootCause: 'Cluster state differs from Git state.',
      recommendedFix: 'Run sync operation or review drift.',
      confidence: 80,
    };
  }

  if (corpus.includes('failedscheduling')) {
    return {
      rootCause: 'Cluster lacks resources.',
      recommendedFix: 'Add node capacity or reduce requests.',
      confidence: 85,
    };
  }

  return {
    rootCause: 'No obvious deployment problem detected.',
    recommendedFix: 'Inspect application logs manually.',
    confidence: 40,
  };
}

function scoreRisk(input: {
  healthNorm: string;
  syncNorm: string;
  corpus: string;
  deploymentCount: number;
  failedDeploymentCount: number;
}): number {
  let risk = 0;
  if (input.healthNorm === 'missing') risk += 45;
  else if (input.healthNorm === 'degraded') risk += 35;
  else if (input.healthNorm === 'progressing') risk += 15;
  if (input.syncNorm === 'outofsync') risk += 20;
  if (input.deploymentCount > 0) {
    risk += Math.round((input.failedDeploymentCount / input.deploymentCount) * 30);
  }
  if (
    input.corpus.includes('imagepullbackoff') ||
    input.corpus.includes('crashloopbackoff') ||
    input.corpus.includes('failedscheduling')
  ) {
    risk += 15;
  }
  return Math.max(0, Math.min(100, risk));
}

function scoreStability(
  successRate: number,
  riskScore: number,
  deploymentCount: number,
  healthNorm: string,
  syncNorm: string,
): number {
  if (deploymentCount === 0) {
    return healthNorm === 'healthy' && syncNorm === 'synced' ? 70 : 40;
  }
  return Math.max(
    0,
    Math.min(100, Math.round(successRate * 0.7 + (100 - riskScore) * 0.3)),
  );
}

function recommendationsFor(
  recommendedFix: string,
  input: {
    deploymentCount: number;
    failedDeploymentCount: number;
    eventCount: number;
  },
  healthNorm: string,
  syncNorm: string,
): string[] {
  const items = [recommendedFix];
  if (input.deploymentCount === 0) {
    items.push('No deployment history is stored for this application yet.');
  } else if (input.failedDeploymentCount > 0) {
    items.push(
      `${input.failedDeploymentCount} of ${input.deploymentCount} stored deployments are failed or degraded.`,
    );
  }
  if (input.eventCount === 0) {
    items.push('No application events are stored. The next Argo CD sync records current conditions.');
  }
  if (healthNorm === 'healthy' && syncNorm === 'synced' && input.failedDeploymentCount === 0) {
    items.push('Current health and sync do not show an active failure.');
  }
  return [...new Set(items)];
}
