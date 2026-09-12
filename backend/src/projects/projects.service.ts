import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  create() {
    throw new BadRequestException(
      'Projects are created automatically from Argo CD application projects. Connect Argo CD and sync applications.',
    );
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
