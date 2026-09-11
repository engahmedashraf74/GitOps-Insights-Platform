import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ArgocdService } from '../argocd/argocd.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { isFailed, isSucceeded } from '../workspace/workspace-metrics';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly argocd: ArgocdService,
    private readonly integrations: IntegrationsService,
  ) {}

  async create(userId: number, dto: CreateApplicationDto) {
    await this.assertProjectAccess(userId, dto.projectId);
    return this.prisma.application.create({
      data: {
        name: dto.name,
        description: dto.description,
        repoUrl: dto.repoUrl,
        branch: dto.branch,
        path: dto.path,
        projectId: dto.projectId,
      },
    });
  }

  async findAllForUser(userId: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    return this.prisma.application.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllByProject(projectId: number) {
    return this.prisma.application.findMany({
      where: { projectId },
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

    const total = deployments.length;
    const succeeded = deployments.filter(isSucceeded).length;
    const failed = deployments.filter(isFailed).length;
    const successRate = total === 0 ? 0 : Number(((succeeded / total) * 100).toFixed(2));
    const failureRate = total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2));
    const latest = deployments[0];

    let argo: Record<string, unknown> | null = null;
    try {
      const connection = await this.integrations.getArgoConnection(userId);
      const payload = await this.argocd.getApplication(application.name, connection);
      argo = payload;
    } catch {
      argo = null;
    }

    const argoStatus = asRecord(asRecord(argo)?.status);
    const health = String(
      asRecord(argoStatus?.health)?.status || latest?.healthStatus || 'Unknown',
    );
    const sync = String(
      asRecord(argoStatus?.sync)?.status || latest?.syncStatus || 'Unknown',
    );
    const revision = String(
      asRecord(argoStatus?.sync)?.revision || latest?.revision || '',
    );

    return {
      application,
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
        health,
        sync,
        revision,
        lastDeployment: latest?.deployedAt ?? null,
      },
      timeline: deployments,
    };
  }

  private async assertProjectAccess(userId: number, projectId: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    if (!projectIds.includes(projectId)) {
      throw new ForbiddenException('Project is not in this workspace');
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
