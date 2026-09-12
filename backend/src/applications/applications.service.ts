import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from '../argocd/argocd.service';
import { ArgocdSyncService } from '../argocd/argocd-sync.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { isFailed, isSucceeded } from '../workspace/workspace-metrics';
import { mapArgoApplication } from '../argocd/argo-application';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly argocd: ArgocdService,
    private readonly sync: ArgocdSyncService,
    private readonly integrations: IntegrationsService,
  ) {}

  create() {
    throw new BadRequestException(
      'Applications are imported from Argo CD. Connect the integration and use Sync Applications.',
    );
  }

  syncFromArgo(userId: number) {
    return this.sync.syncForUser(userId);
  }

  async findAllForUser(userId: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    return this.prisma.application.findMany({
      where: { projectId: { in: projectIds } },
      include: { project: true },
      orderBy: { name: 'asc' },
    });
  }

  findAllByProject(projectId: number) {
    return this.prisma.application.findMany({
      where: { projectId },
      include: { project: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(userId: number, id: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const application = await this.prisma.application.findFirst({
      where: { id, projectId: { in: projectIds } },
      include: { project: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  async findRepository(userId: number, id: number) {
    const application = await this.findById(userId, id);
    return {
      id: application.id,
      name: application.name,
      repoUrl: application.repoUrl,
      branch: application.branch,
      path: application.path,
      namespace: application.namespace,
      cluster: application.cluster,
    };
  }

  async findEvents(userId: number, id: number) {
    await this.findById(userId, id);
    return this.prisma.applicationEvent.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOverview(userId: number, id: number) {
    const application = await this.findById(userId, id);
    const deployments = await this.prisma.deployment.findMany({
      where: { applicationId: id },
      orderBy: { deployedAt: 'desc' },
    });

    let live = {
      health: application.healthStatus || 'Unknown',
      sync: application.syncStatus || 'Unknown',
      revision: application.revision || '',
      repoUrl: application.repoUrl || '',
      namespace: application.namespace || '',
      cluster: application.cluster || '',
    };

    try {
      const connection = await this.integrations.getArgoConnection(userId);
      if (connection) {
        const payload = await this.argocd.getApplication(
          application.name,
          connection,
        );
        const mapped = mapArgoApplication(payload);
        if (mapped) {
          live = {
            health: mapped.healthStatus,
            sync: mapped.syncStatus,
            revision: mapped.revision,
            repoUrl: mapped.repoUrl || live.repoUrl,
            namespace: mapped.namespace || live.namespace,
            cluster: mapped.cluster || live.cluster,
          };
        }
      }
    } catch {
      /* cached Argo metadata is enough for the overview */
    }

    const latest = deployments[0];
    const total = deployments.length;
    const succeeded = deployments.filter(isSucceeded).length;
    const failed = deployments.filter(isFailed).length;
    const successRate =
      total === 0 ? 0 : Number(((succeeded / total) * 100).toFixed(2));
    const failureRate =
      total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2));

    return {
      application: {
        ...application,
        healthStatus: live.health,
        syncStatus: live.sync,
        revision: live.revision,
        repoUrl: live.repoUrl || application.repoUrl,
        namespace: live.namespace || application.namespace,
        cluster: live.cluster || application.cluster,
      },
      stats: {
        totalDeployments: total,
        healthyDeployments: succeeded,
        failedDeployments: failed,
        successRate,
      },
      frequency: { deployments: total },
      failureRate: {
        totalDeployments: total,
        failedDeployments: failed,
        failureRate,
      },
      current: {
        health: live.health,
        sync: live.sync,
        revision: live.revision,
        repoUrl: live.repoUrl,
        namespace: live.namespace,
        cluster: live.cluster,
        lastDeployment: latest?.deployedAt ?? application.lastObservedAt,
      },
      timeline: deployments,
    };
  }
}
