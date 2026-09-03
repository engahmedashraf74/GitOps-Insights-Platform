import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService) {}

  create(
    revision: string,
    status: string,
    environment: string,
    applicationId: number,
  ) {
    return this.prisma.deployment.create({
      data: {
        revision,
        status,
        environment,
        applicationId,
      },
    });
  }

  findAll(applicationId: number) {
    return this.prisma.deployment.findMany({
      where: {
        applicationId,
      },
    });
  }

  updateStatus(
    id: number,
    status: string,
    syncStatus: string,
    healthStatus: string,
  ) {
    return this.prisma.deployment.update({
      where: {
        id,
      },
      data: {
        status,
        syncStatus,
        healthStatus,
      },
    });
  }
}
