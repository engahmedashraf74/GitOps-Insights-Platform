import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  CreateDeploymentDto,
  ListDeploymentsQueryDto,
  UpdateDeploymentDto,
} from './dto/deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  create(dto: CreateDeploymentDto) {
    return this.prisma.deployment.create({
      data: {
        revision: dto.revision,
        status: dto.status,
        environment: dto.environment,
        applicationId: dto.applicationId,
        syncStatus: dto.syncStatus,
        healthStatus: dto.healthStatus,
        commitSha: dto.commitSha,
        environmentId: dto.environmentId,
      },
    });
  }

  findAllByApplication(applicationId: number) {
    return this.prisma.deployment.findMany({
      where: { applicationId },
      orderBy: { deployedAt: 'desc' },
    });
  }

  async findAllForUser(userId: number, query: ListDeploymentsQueryDto) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const applications = await this.prisma.application.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const applicationIds = applications.map((item) => item.id);
    if (
      query.applicationId !== undefined &&
      !applicationIds.includes(query.applicationId)
    ) {
      return [];
    }

    const where: Prisma.DeploymentWhereInput = {
      applicationId: query.applicationId
        ? query.applicationId
        : { in: applicationIds },
    };

    if (query.status) {
      where.status = { contains: query.status, mode: 'insensitive' };
    }
    if (query.environment) {
      where.environment = { equals: query.environment, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.deployedAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    return this.prisma.deployment.findMany({
      where,
      orderBy: { deployedAt: 'desc' },
    });
  }

  async findById(userId: number, id: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const deployment = await this.prisma.deployment.findFirst({
      where: {
        id,
        application: { projectId: { in: projectIds } },
      },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }
    return deployment;
  }

  async updateStatus(userId: number, id: number, dto: UpdateDeploymentDto) {
    await this.findById(userId, id);
    return this.prisma.deployment.update({
      where: { id },
      data: {
        status: dto.status,
        syncStatus: dto.syncStatus,
        healthStatus: dto.healthStatus,
      },
    });
  }
}
