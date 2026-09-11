import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [DeploymentsService],
  controllers: [DeploymentsController],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
