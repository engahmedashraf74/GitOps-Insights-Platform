import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(name: string, description: string | undefined, userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    return this.prisma.project.create({
      data: {
        name,
        description: description ?? null,
        userId,
        organizationId: organization.id,
      },
    });
  }

  async findAll(userId: number) {
    const organization = await this.organizations.ensureForUser(userId);
    return this.prisma.project.findMany({
      where: {
        OR: [{ userId }, { organizationId: organization.id }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
