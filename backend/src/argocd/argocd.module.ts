import { Module } from '@nestjs/common';
import { ArgocdService } from './argocd.service';
import { ArgocdSyncService } from './argocd-sync.service';
import { ArgocdSyncJob } from './argocd-sync.job';
import { ArgocdDebugController } from './argocd-debug.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, OrganizationsModule],
  providers: [ArgocdService, ArgocdSyncService, ArgocdSyncJob],
  controllers: [ArgocdDebugController],
  exports: [ArgocdService, ArgocdSyncService],
})
export class ArgocdModule {}
