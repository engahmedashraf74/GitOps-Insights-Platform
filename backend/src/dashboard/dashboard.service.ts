import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArgocdService } from '../argocd/argocd.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { isFailed, isSucceeded } from '../workspace/workspace-metrics';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly argocdService: ArgocdService,
    private readonly integrations: IntegrationsService,
  ) {}

  async getStats(applicationId: number) {
    const deployments = await this.prisma.deployment.findMany({
      where: { applicationId },
    });
    const totalDeployments = deployments.length;
    const healthyDeployments = deployments.filter(isSucceeded).length;
    const failedDeployments = deployments.filter(isFailed).length;
    const successRate =
      totalDeployments === 0
        ? 0
        : Number(((healthyDeployments / totalDeployments) * 100).toFixed(2));

    return {
      totalDeployments,
      healthyDeployments,
      failedDeployments,
      successRate,
    };
  }

  getTimeline(applicationId: number) {
    return this.prisma.deployment.findMany({
      where: { applicationId },
      orderBy: { deployedAt: 'desc' },
      select: {
        id: true,
        revision: true,
        status: true,
        syncStatus: true,
        healthStatus: true,
        environment: true,
        deployedAt: true,
        applicationId: true,
      },
    });
  }

  async getFailureRate(applicationId: number) {
    const deployments = await this.prisma.deployment.findMany({
      where: { applicationId },
    });
    const total = deployments.length;
    const failed = deployments.filter(isFailed).length;
    return {
      totalDeployments: total,
      failedDeployments: failed,
      failureRate:
        total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2)),
    };
  }

  async getDeploymentFrequency(applicationId: number) {
    const deployments = await this.prisma.deployment.count({
      where: { applicationId },
    });
    return { deployments };
  }

  async getArgoData(applicationName: string, userId?: number) {
    const connection = userId
      ? await this.integrations.getArgoConnection(userId).catch(() => undefined)
      : undefined;
    const app = (await this.argocdService.getApplication(
      applicationName,
      connection,
    )) as {
      status?: {
        sync?: { status?: string; revision?: string };
        health?: { status?: string };
      };
      spec?: { source?: { repoURL?: string; targetRevision?: string } };
    };

    return {
      syncStatus: app.status?.sync?.status,
      healthStatus: app.status?.health?.status,
      revision: app.status?.sync?.revision,
      repoUrl: app.spec?.source?.repoURL,
      targetRevision: app.spec?.source?.targetRevision,
    };
  }

  async getOverview(applicationId: number, userId?: number) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });
    const [stats, frequency, failureRate, timeline] = await Promise.all([
      this.getStats(applicationId),
      this.getDeploymentFrequency(applicationId),
      this.getFailureRate(applicationId),
      this.getTimeline(applicationId),
    ]);

    if (application) {
      try {
        const argo = await this.getArgoData(application.name, userId);
        if (timeline.length === 0 && argo.revision) {
          return {
            stats,
            frequency,
            failureRate,
            timeline: [
              {
                revision: argo.revision,
                status: 'Succeeded',
                syncStatus: argo.syncStatus,
                healthStatus: argo.healthStatus,
                environment: undefined,
                deployedAt: new Date(),
                applicationId,
              },
            ],
          };
        }
      } catch {
        /* Argo overlay is optional */
      }
    }

    return { stats, frequency, failureRate, timeline };
  }
}
