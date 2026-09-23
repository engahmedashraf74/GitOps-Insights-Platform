import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ArgocdService } from '../argocd/argocd.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { mapArgoApplication } from '../argocd/argo-application';
import { isFailed, isSucceeded } from '../workspace/workspace-metrics';
import {
  analyzeDeploymentSignals,
  type DeploymentAnalysis,
} from './analysis-engine';

@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly argocd: ArgocdService,
    private readonly integrations: IntegrationsService,
  ) {}

  async analyze(userId: number, applicationId: number): Promise<DeploymentAnalysis> {
    const application = await this.applications.findById(userId, applicationId);
    const [events, deployments] = await Promise.all([
      this.prisma.applicationEvent.findMany({
        where: { applicationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.deployment.findMany({
        where: { applicationId },
        orderBy: { deployedAt: 'desc' },
      }),
    ]);

    let healthStatus = application.healthStatus || 'Unknown';
    let syncStatus = application.syncStatus || 'Unknown';
    const liveFragments: string[] = [];

    try {
      const connection = await this.integrations.getArgoConnection(userId);
      if (connection) {
        const payload = await this.argocd.getApplication(
          application.name,
          connection,
        );
        const mapped = mapArgoApplication(payload);
        if (mapped) {
          healthStatus = mapped.healthStatus || healthStatus;
          syncStatus = mapped.syncStatus || syncStatus;
        }
        liveFragments.push(...extractArgoSignals(payload));
      }
    } catch {
      /* cached application rows and events are enough */
    }

    const eventText = [
      ...events.map((item) => `${item.type} ${item.message}`),
      ...events.map((item) => stringifyMetadata(item.metadata)),
      ...deployments.map(
        (item) =>
          `${item.status} ${item.healthStatus ?? ''} ${item.syncStatus ?? ''} ${item.revision}`,
      ),
      application.healthStatus ?? '',
      application.syncStatus ?? '',
      ...liveFragments,
    ]
      .filter(Boolean)
      .join('\n');

    const failedDeploymentCount = deployments.filter(isFailed).length;
    const successCount = deployments.filter(isSucceeded).length;
    const last = deployments[0]?.deployedAt;

    return analyzeDeploymentSignals({
      applicationId,
      healthStatus,
      syncStatus,
      eventText,
      deploymentCount: deployments.length,
      successCount,
      failedDeploymentCount,
      lastDeploymentAt: last ? last.toISOString() : null,
      eventCount: events.length,
    });
  }
}

function stringifyMetadata(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function extractArgoSignals(payload: unknown): string[] {
  const root = asRecord(payload);
  if (!root) return [];
  const status = asRecord(root.status);
  const health = asRecord(status?.health);
  const operation = asRecord(status?.operationState);
  const fragments: string[] = [];

  if (typeof health?.message === 'string') fragments.push(health.message);
  if (typeof operation?.message === 'string') fragments.push(operation.message);

  const conditions = status?.conditions;
  if (Array.isArray(conditions)) {
    for (const item of conditions) {
      const condition = asRecord(item);
      if (!condition) continue;
      fragments.push(String(condition.type ?? ''), String(condition.message ?? ''));
    }
  }

  const resources = status?.resources;
  if (Array.isArray(resources)) {
    for (const item of resources) {
      const resource = asRecord(item);
      if (!resource) continue;
      const resourceHealth = asRecord(resource.health);
      fragments.push(
        String(resource.status ?? ''),
        String(resourceHealth?.status ?? ''),
        String(resourceHealth?.message ?? ''),
      );
    }
  }

  return fragments;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
