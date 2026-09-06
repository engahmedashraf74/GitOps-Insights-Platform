import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArgocdService } from '../argocd/argocd.service';

@Injectable()
export class DashboardService {
  constructor(
  private prisma: PrismaService,
  private argocdService: ArgocdService,
) {}

  async getStats(applicationId: number) {
    const deployments =
      await this.prisma.deployment.findMany({
        where: {
          applicationId,
        },
      });

    const totalDeployments =
      deployments.length;

    const healthyDeployments =
      deployments.filter(
        (deployment: any) =>
          deployment.healthStatus ===
          'Healthy',
      ).length;

    const failedDeployments =
      deployments.filter(
        (deployment: any) =>
          deployment.healthStatus ===
          'Degraded',
      ).length;

    const successRate =
      totalDeployments === 0
        ? 0
        : (
            (healthyDeployments /
              totalDeployments) *
            100
          ).toFixed(2);

    return {
      totalDeployments,
      healthyDeployments,
      failedDeployments,
      successRate,
    };
  }

  async getTimeline(
    applicationId: number,
  ) {
    return this.prisma.deployment.findMany({
      where: {
        applicationId,
      },
      orderBy: {
        deployedAt: 'desc',
      },
      select: {
        revision: true,
        status: true,
        syncStatus: true,
        healthStatus: true,
        deployedAt: true,
      },
    });
  }

  async getFailureRate(
    applicationId: number,
  ) {
    const deployments =
      await this.prisma.deployment.findMany({
        where: {
          applicationId,
        },
      });

    const total =
      deployments.length;

    const failed =
      deployments.filter(
        (deployment: any) =>
          deployment.healthStatus ===
          'Degraded',
      ).length;

    const failureRate =
      total === 0
        ? 0
        : (
            (failed / total) *
            100
          ).toFixed(2);

    return {
      totalDeployments: total,
      failedDeployments: failed,
      failureRate,
    };
  }

  async getDeploymentFrequency(
    applicationId: number,
  ) {
    const total =
      await this.prisma.deployment.count({
        where: {
          applicationId,
        },
      });

    return {
      deployments: total,
    };
  }
async getArgoData(applicationName: string) {
  const app =
    await this.argocdService.getApplication(
      applicationName,
    );

  return {
    syncStatus:
      app.status?.sync?.status,

    healthStatus:
      app.status?.health?.status,

    revision:
      app.status?.sync?.revision,

    repoUrl:
      app.spec?.source?.repoURL,

    targetRevision:
      app.spec?.source?.targetRevision,
  };
}
  async getOverview(
  applicationId: number,
) {
  const app =
    await this.argocdService.getApplication(
      'gitops-insights',
    );

  return {
    stats: {
      totalDeployments: 1,

      healthyDeployments:
        app.status?.health?.status ===
        'Healthy'
          ? 1
          : 0,

      failedDeployments:
        app.status?.health?.status ===
        'Degraded'
          ? 1
          : 0,

      successRate:
        app.status?.health?.status ===
        'Healthy'
          ? 100
          : 0,
    },

    frequency: {
      deployments: 1,
    },

    failureRate: {
      failureRate:
        app.status?.health?.status ===
        'Healthy'
          ? 0
          : 100,
    },

    timeline: [
      {
        revision:
          app.status?.sync?.revision,

        status: 'Succeeded',

        syncStatus:
          app.status?.sync?.status,

        healthStatus:
          app.status?.health?.status,

        deployedAt:
          new Date(),
      },
    ],
  };
}

    
}