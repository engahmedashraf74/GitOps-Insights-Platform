import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import type { JwtUser } from '../common/types/jwt-user';
import type { TimeRange } from '../common/dto/time-range.dto';
import {
  buildActivity,
  buildDora,
  buildSuccessFailure,
  isFailed,
  isSucceeded,
} from './workspace-metrics';
import type { Application, Deployment, Project } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async getWorkspace(user: JwtUser) {
    const organization = await this.organizations.ensureForUser(user.userId);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    };
  }

  async snapshot(user: JwtUser) {
    const organization = await this.organizations.ensureForUser(user.userId);
    const { projects, applications, deployments } =
      await this.loadGraph(user.userId);
    const integration = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: organization.id,
          provider: 'argocd',
        },
      },
    });
    return {
      projects,
      applications,
      deployments,
      argocd: {
        connected: integration?.status === 'connected',
        url: integration?.url ?? null,
        lastSyncedAt: integration?.lastSyncedAt ?? null,
      },
    };
  }

  async metrics(user: JwtUser) {
    const { applications, deployments } = await this.loadGraph(user.userId);
    const failedDeployments = deployments.filter(isFailed).length;
    const succeeded = deployments.filter(isSucceeded).length;
    const successRate =
      deployments.length === 0 ? 0 : (succeeded / deployments.length) * 100;

    const latestByApp = latestDeploymentMap(deployments);
    let healthyApplications = 0;
    for (const application of applications) {
      const latest = latestByApp.get(application.id);
      const health = (
        application.healthStatus ||
        latest?.healthStatus ||
        ''
      ).toLowerCase();
      if (health === 'healthy') {
        healthyApplications += 1;
      }
    }

    return {
      applications: applications.length,
      deployments: deployments.length,
      healthyApplications,
      failedDeployments,
      successRate,
    };
  }

  async activity(user: JwtUser, range?: TimeRange) {
    const { deployments } = await this.loadGraph(user.userId);
    return {
      series: buildActivity(deployments, range),
      successFailure: buildSuccessFailure(deployments, range),
    };
  }

  async health(user: JwtUser) {
    const { deployments } = await this.loadGraph(user.userId);
    const latest = [...latestDeploymentMap(deployments).values()];
    const breakdown = { healthy: 0, degraded: 0, progressing: 0 };
    for (const deployment of latest) {
      const health = (deployment.healthStatus || '').toLowerCase();
      if (health === 'healthy') breakdown.healthy += 1;
      else if (health === 'degraded') breakdown.degraded += 1;
      else if (health === 'progressing') breakdown.progressing += 1;
    }
    return breakdown;
  }

  async dora(user: JwtUser) {
    const { deployments } = await this.loadGraph(user.userId);
    return buildDora(deployments);
  }

  async environments(user: JwtUser) {
    const { deployments } = await this.loadGraph(user.userId);
    const map = new Map<string, { environment: string; deployments: number; failures: number }>();
    for (const deployment of deployments) {
      const environment = deployment.environment?.trim() || 'Unspecified';
      const current = map.get(environment) ?? {
        environment,
        deployments: 0,
        failures: 0,
      };
      current.deployments += 1;
      if (isFailed(deployment)) current.failures += 1;
      map.set(environment, current);
    }
    return Array.from(map.values()).sort((a, b) => b.deployments - a.deployments);
  }

  async search(user: JwtUser, q?: string) {
    const { projects, applications, deployments } = await this.loadGraph(
      user.userId,
    );
    const query = (q ?? '').trim().toLowerCase();
    const match = (value: string) =>
      !query || value.toLowerCase().includes(query);

    return {
      projects: projects
        .filter((item) => match(item.name) || match(item.description ?? ''))
        .slice(0, 10),
      applications: applications
        .filter(
          (item) =>
            match(item.name) ||
            match(item.description ?? '') ||
            match(item.repoUrl ?? ''),
        )
        .slice(0, 10),
      deployments: deployments
        .filter(
          (item) =>
            match(item.revision) ||
            match(item.status) ||
            match(item.environment),
        )
        .slice(0, 10),
    };
  }

  async notifications(user: JwtUser) {
    const organization = await this.organizations.ensureForUser(user.userId);
    await this.syncDerivedNotifications(user.userId, organization.id);
    return this.prisma.notification.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationsRead(user: JwtUser, ids?: number[]) {
    const organization = await this.organizations.ensureForUser(user.userId);
    await this.prisma.notification.updateMany({
      where: {
        organizationId: organization.id,
        ...(ids?.length ? { id: { in: ids } } : {}),
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async assertApplicationAccess(userId: number, applicationId: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, projectId: { in: projectIds } },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private async loadGraph(userId: number): Promise<{
    projects: Project[];
    applications: Application[];
    deployments: Deployment[];
  }> {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      orderBy: { createdAt: 'desc' },
    });
    const applications = await this.prisma.application.findMany({
      where: { projectId: { in: projectIds } },
    });
    const deployments = await this.prisma.deployment.findMany({
      where: { applicationId: { in: applications.map((item) => item.id) } },
      orderBy: { deployedAt: 'desc' },
    });
    return { projects, applications, deployments };
  }

  private async syncDerivedNotifications(userId: number, organizationId: number) {
    const { applications, deployments } = await this.loadGraph(userId);
    const latest = latestDeploymentMap(deployments);

    for (const application of applications) {
      const deployment = latest.get(application.id);
      if (!deployment) continue;

      if (isFailed(deployment)) {
        await this.upsertNotification(
          organizationId,
          application.id,
          `fail-${application.id}`,
          `${application.name} needs attention`,
          `${deployment.status} in ${deployment.environment}.`,
          'danger',
          `/applications/${application.id}`,
        );
      }

      if ((deployment.syncStatus || '').toLowerCase() === 'outofsync') {
        await this.upsertNotification(
          organizationId,
          application.id,
          `sync-${application.id}`,
          `${application.name} is OutOfSync`,
          'Live state does not match the desired Git revision.',
          'warning',
          `/applications/${application.id}`,
        );
      }
    }
  }

  private async upsertNotification(
    organizationId: number,
    applicationId: number,
    type: string,
    title: string,
    body: string,
    tone: string,
    href: string,
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { organizationId, applicationId, type },
    });
    if (existing) return existing;
    return this.prisma.notification.create({
      data: { organizationId, applicationId, type, title, body, tone, href },
    });
  }
}

function latestDeploymentMap(deployments: Deployment[]): Map<number, Deployment> {
  const map = new Map<number, Deployment>();
  for (const deployment of deployments) {
    const current = map.get(deployment.applicationId);
    if (!current || deployment.deployedAt > current.deployedAt) {
      map.set(deployment.applicationId, deployment);
    }
  }
  return map;
}
