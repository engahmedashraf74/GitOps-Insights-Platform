import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ArgocdModule } from '../argocd/argocd.module';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [PrismaModule, OrganizationsModule, ArgocdModule],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
