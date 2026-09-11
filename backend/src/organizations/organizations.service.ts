import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Organization } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureForUser(userId: number): Promise<Organization> {
    const existing = await this.prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { id: 'asc' },
    });

    if (existing) {
      return existing.organization;
    }

    const slug = `org-${userId}-${Date.now()}`;
    const organization = await this.prisma.organization.create({
      data: {
        name: 'Platform workspace',
        slug,
        createdById: userId,
        members: {
          create: { userId, role: 'owner' },
        },
      },
    });

    await this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await this.prisma.project.updateMany({
      where: { userId, organizationId: null },
      data: { organizationId: organization.id },
    });

    return organization;
  }

  async getAccessibleProjectIds(userId: number): Promise<number[]> {
    const organization = await this.ensureForUser(userId);
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [{ userId }, { organizationId: organization.id }],
      },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }
}
