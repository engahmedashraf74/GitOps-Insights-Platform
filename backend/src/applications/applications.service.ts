import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationsService {
  constructor(private prisma: PrismaService) {}

  create(
    name: string,
    description: string,
    repoUrl: string,
    branch: string,
    path: string,
    projectId: number,
  ) {
    return this.prisma.application.create({
      data: {
        name,
        description,
        repoUrl,
        branch,
        path,
        projectId,
      },
    });
  }

  findAll(projectId: number) {
    return this.prisma.application.findMany({
      where: {
        projectId,
      },
    });
  }

  findRepository(id: number) {
    return this.prisma.application.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        repoUrl: true,
        branch: true,
        path: true,
      },
    });
  }
}
