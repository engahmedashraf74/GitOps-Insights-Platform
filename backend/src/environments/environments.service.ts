import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(userId: number, name: string, applicationId: number) {
    await this.assertApplication(userId, applicationId);
    return this.prisma.environment.create({
      data: {
        name,
        applicationId,
      },
    });
  }

  async findAll(userId: number, applicationId: number) {
    await this.assertApplication(userId, applicationId);
    return this.prisma.environment.findMany({
      where: {
        applicationId,
      },
    });
  }

  async delete(userId: number, id: number) {
    const environment = await this.prisma.environment.findUnique({
      where: { id },
      select: { id: true, applicationId: true },
    });
    if (!environment) {
      throw new NotFoundException('Environment not found');
    }
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const application = await this.prisma.application.findFirst({
      where: {
        id: environment.applicationId,
        projectId: { in: projectIds },
      },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Environment not found');
    }
    return this.prisma.environment.delete({
      where: { id },
    });
  }

  private async assertApplication(userId: number, applicationId: number) {
    const projectIds = await this.organizations.getAccessibleProjectIds(userId);
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, projectId: { in: projectIds } },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }
}
