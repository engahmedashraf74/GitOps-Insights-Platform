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
  if (corpus.includes('imagepullbackoff')) {
    return {
      rootCause: 'Container image cannot be pulled.',
      recommendedFix: 'Verify the image name, tag, registry access, and imagePullSecrets.',
      confidence: 85,
    };
  }

  if (corpus.includes('crashloopbackoff')) {
    return {
      rootCause: 'The container is crashing after start.',
      recommendedFix: 'Inspect container logs, probes, and startup configuration.',
      confidence: 85,
    };
  }

  if (corpus.includes('progressdeadlineexceeded')) {
    return {
      rootCause: 'The workload did not become ready before its progress deadline.',
      recommendedFix: 'Check the new pods, probes, and the Deployment progress deadline.',
      confidence: 85,
    };
  }

  if (corpus.includes('failedscheduling')) {
    return {
      rootCause: 'The pod could not be placed on a node.',
      recommendedFix: 'Check CPU, memory, and node selectors.',
      confidence: 85,
    };
  }

  if (healthNorm === 'missing') {
    return {
      rootCause: 'A declared resource is not in the cluster.',
      recommendedFix: 'Verify the Git path and the destination namespace.',
      confidence: 90,
    };
  }

  if (
    corpus.includes('syncerror') ||
    corpus.includes('comparisonerror') ||
    (corpus.includes('sync') && (corpus.includes('fail') || corpus.includes('error')))
  ) {
    return {
      rootCause: 'The last sync did not finish successfully.',
      recommendedFix: 'Read the operation message and sync again after fixing the Git or cluster error.',
      confidence: 80,
    };
  }

  if (syncNorm === 'outofsync') {
    return {
      rootCause: 'Cluster state differs from Git.',
      recommendedFix: 'Review the diff, then sync.',
      confidence: 80,
    };
  }

  if (healthNorm === 'degraded') {
    return {
      rootCause: 'The application is unhealthy without a more specific error.',
      recommendedFix: 'Open the resource health messages stored for this application.',
      confidence: 70,
    };
  }

  if (!healthNorm || healthNorm === 'unknown') {
    return {
      rootCause: 'Argo CD has not reported health.',
      recommendedFix: 'Confirm the application exists in Argo CD and that a sync has completed.',
      confidence: 55,
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
    input.corpus.includes('failedscheduling') ||
    input.corpus.includes('progressdeadlineexceeded')
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
