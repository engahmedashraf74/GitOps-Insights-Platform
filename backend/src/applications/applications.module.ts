import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ArgocdModule } from '../argocd/argocd.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule, ArgocdModule, IntegrationsModule],
  providers: [ApplicationsService],
  controllers: [ApplicationsController],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
