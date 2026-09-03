import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  create(
    name: string,
    description: string,
    userId: number,
  ) {
    return this.prisma.project.create({
      data: {
        name,
        description,
        userId,
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.project.findMany({
      where: {
        userId,
      },
    });
  }
}
