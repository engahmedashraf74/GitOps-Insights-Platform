import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

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
        (d: any) => d.healthStatus === 'Healthy',
      ).length;

    const failedDeployments =
      deployments.filter(
         (d: any) => d.healthStatus === 'Degraded',
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
    (d: { healthStatus: string }) =>
      d.healthStatus === 'Degraded',
  ).length;

    const failureRate =
      total === 0
        ? 0
        : ((failed / total) * 100).toFixed(
            2,
          );

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

  async getOverview(
    applicationId: number,
  ) {
    const stats =
      await this.getStats(
        applicationId,
      );

    const failureRate =
      await this.getFailureRate(
        applicationId,
      );

    const frequency =
      await this.getDeploymentFrequency(
        applicationId,
      );

    const timeline =
      await this.getTimeline(
        applicationId,
      );

    return {
      stats,
      failureRate,
      frequency,
      timeline,
    };
  }
}
