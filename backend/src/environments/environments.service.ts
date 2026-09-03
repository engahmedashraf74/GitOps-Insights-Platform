import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnvironmentsService {
  constructor(private prisma: PrismaService) {}

  create(
    name: string,
    applicationId: number,
  ) {
    return this.prisma.environment.create({
      data: {
        name,
        applicationId,
      },
    });
  }

  findAll(applicationId: number) {
    return this.prisma.environment.findMany({
      where: {
        applicationId,
      },
    });
  }

  delete(id: number) {
    return this.prisma.environment.delete({
      where: {
        id,
      },
    });
  }
}
