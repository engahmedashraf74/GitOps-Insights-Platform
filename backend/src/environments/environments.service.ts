import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class EnvironmentsService {
  constructor(
    private prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(userId: number, name: string, applicationId: number) {
    await this.organizations.assertApplicationAccess(userId, applicationId);
    return this.prisma.environment.create({
      data: {
        name,
        applicationId,
      },
    });
  }

  async findAll(userId: number, applicationId: number) {
    await this.organizations.assertApplicationAccess(userId, applicationId);
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
    await this.organizations.assertApplicationAccess(
      userId,
      environment.applicationId,
    );
    return this.prisma.environment.delete({
      where: {
        id,
      },
    });
  }
}
